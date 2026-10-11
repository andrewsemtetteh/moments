import { DurableObject } from 'cloudflare:workers';

import './env';

/**
 * One Durable Object per relationship. It replaces Supabase Realtime for the app:
 *   - broadcast   : fan a message out to every other socket joined to the same topic
 *   - presence    : per-topic key -> payload map with join/leave/sync
 *   - table events: the Worker POSTs /notify after writes; sockets that joined a topic with
 *                   that table in their `tables` list receive it (`pg` frames)
 *
 * Frames (client -> hub):  join | leave | bc | track | untrack | ping
 * Frames (hub -> client):  joined | bc | presence | pg | pong
 */

type Sub = { self: boolean; key: string; tables: Set<string>; presence: unknown | null };
type Conn = { userId: string; subs: Map<string, Sub> };

type ClientFrame =
  | { t: 'join'; topic: string; self?: boolean; key?: string; tables?: string[] }
  | { t: 'leave'; topic: string }
  | { t: 'bc'; topic: string; event: string; payload: unknown }
  | { t: 'track'; topic: string; payload: unknown }
  | { t: 'untrack'; topic: string }
  | { t: 'ping' };

export type HubEvent = {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  /** When set, only this user's sockets receive the event (per-user tables like notifications). */
  userId?: string;
};

export class Hub extends DurableObject<Env> {
  private conns = new Map<WebSocket, Conn>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/notify') {
      this.notify((await request.json()) as HubEvent);
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const userId = url.searchParams.get('uid');
    if (!userId) return new Response('Missing user', { status: 400 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const conn: Conn = { userId, subs: new Map() };
    this.conns.set(server, conn);

    server.addEventListener('message', (event) => {
      try {
        this.onFrame(server, conn, JSON.parse(String(event.data)) as ClientFrame);
      } catch {
        /* ignore malformed frames */
      }
    });
    const close = () => this.onClose(server, conn);
    server.addEventListener('close', close);
    server.addEventListener('error', close);

    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, frame: unknown) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      /* socket already closed */
    }
  }

  private presenceState(topic: string): Record<string, unknown[]> {
    const state: Record<string, unknown[]> = {};
    for (const conn of this.conns.values()) {
      const sub = conn.subs.get(topic);
      if (!sub || sub.presence === null) continue;
      (state[sub.key] ??= []).push(sub.presence);
    }
    return state;
  }

  private broadcastPresence(
    topic: string,
    delta: { joins?: { key: string; payload: unknown }[]; leaves?: { key: string; payload: unknown }[] },
  ) {
    const state = this.presenceState(topic);
    for (const [ws, conn] of this.conns) {
      if (conn.subs.has(topic)) this.send(ws, { t: 'presence', topic, state, ...delta });
    }
  }

  private onFrame(ws: WebSocket, conn: Conn, frame: ClientFrame) {
    switch (frame.t) {
      case 'ping':
        this.send(ws, { t: 'pong' });
        return;

      case 'join':
        conn.subs.set(frame.topic, {
          self: frame.self === true,
          key: frame.key ?? conn.userId,
          tables: new Set(frame.tables ?? []),
          presence: null,
        });
        this.send(ws, { t: 'joined', topic: frame.topic, state: this.presenceState(frame.topic) });
        return;

      case 'leave': {
        const sub = conn.subs.get(frame.topic);
        conn.subs.delete(frame.topic);
        if (sub?.presence != null) {
          this.broadcastPresence(frame.topic, { leaves: [{ key: sub.key, payload: sub.presence }] });
        }
        return;
      }

      case 'bc':
        for (const [other, otherConn] of this.conns) {
          const sub = otherConn.subs.get(frame.topic);
          if (!sub) continue;
          if (other === ws && !conn.subs.get(frame.topic)?.self) continue;
          this.send(other, { t: 'bc', topic: frame.topic, event: frame.event, payload: frame.payload });
        }
        return;

      case 'track': {
        const sub = conn.subs.get(frame.topic);
        if (!sub) return;
        const wasTracked = sub.presence !== null;
        sub.presence = frame.payload ?? {};
        this.broadcastPresence(frame.topic, wasTracked ? {} : { joins: [{ key: sub.key, payload: sub.presence }] });
        return;
      }

      case 'untrack': {
        const sub = conn.subs.get(frame.topic);
        if (!sub || sub.presence === null) return;
        const payload = sub.presence;
        sub.presence = null;
        this.broadcastPresence(frame.topic, { leaves: [{ key: sub.key, payload }] });
        return;
      }
    }
  }

  private onClose(ws: WebSocket, conn: Conn) {
    if (!this.conns.delete(ws)) return;
    for (const [topic, sub] of conn.subs) {
      if (sub.presence !== null) {
        this.broadcastPresence(topic, { leaves: [{ key: sub.key, payload: sub.presence }] });
      }
    }
  }

  private notify(event: HubEvent) {
    for (const [ws, conn] of this.conns) {
      if (event.userId && conn.userId !== event.userId) continue;
      for (const [topic, sub] of conn.subs) {
        if (!sub.tables.has(event.table)) continue;
        this.send(ws, {
          t: 'pg',
          topic,
          table: event.table,
          eventType: event.eventType,
          new: event.new,
          old: event.old,
        });
      }
    }
  }
}
