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
 *
 * Uses the WebSocket Hibernation API: per-socket state lives in the socket attachment so the
 * object can be evicted between messages without being billed for idle connected time.
 */

type Sub = { self: boolean; key: string; tables: string[]; presence: unknown | null };
type Conn = { userId: string; subs: Record<string, Sub> };

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
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Must match the client heartbeat byte-for-byte; answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

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
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, subs: {} } satisfies Conn);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let frame: ClientFrame;
    try {
      frame = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    this.onFrame(ws, frame);
  }

  async webSocketClose(ws: WebSocket) {
    this.onClose(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.onClose(ws);
  }

  private conn(ws: WebSocket): Conn | null {
    return (ws.deserializeAttachment() as Conn | null) ?? null;
  }

  private save(ws: WebSocket, conn: Conn) {
    ws.serializeAttachment(conn);
  }

  private *conns(): Generator<[WebSocket, Conn]> {
    for (const ws of this.ctx.getWebSockets()) {
      const conn = this.conn(ws);
      if (conn) yield [ws, conn];
    }
  }

  private send(ws: WebSocket, frame: unknown) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      /* socket already closed */
    }
  }

  private presenceState(topic: string, exclude?: WebSocket): Record<string, unknown[]> {
    const state: Record<string, unknown[]> = {};
    for (const [ws, conn] of this.conns()) {
      if (ws === exclude) continue;
      const sub = conn.subs[topic];
      if (!sub || sub.presence === null) continue;
      (state[sub.key] ??= []).push(sub.presence);
    }
    return state;
  }

  private broadcastPresence(
    topic: string,
    delta: { joins?: { key: string; payload: unknown }[]; leaves?: { key: string; payload: unknown }[] },
    exclude?: WebSocket,
  ) {
    const state = this.presenceState(topic, exclude);
    for (const [ws, conn] of this.conns()) {
      if (ws === exclude) continue;
      if (conn.subs[topic]) this.send(ws, { t: 'presence', topic, state, ...delta });
    }
  }

  private onFrame(ws: WebSocket, frame: ClientFrame) {
    const conn = this.conn(ws);
    if (!conn) return;

    switch (frame.t) {
      case 'ping':
        this.send(ws, { t: 'pong' });
        return;

      case 'join':
        conn.subs[frame.topic] = {
          self: frame.self === true,
          key: frame.key ?? conn.userId,
          tables: frame.tables ?? [],
          presence: null,
        };
        this.save(ws, conn);
        this.send(ws, { t: 'joined', topic: frame.topic, state: this.presenceState(frame.topic) });
        return;

      case 'leave': {
        const sub = conn.subs[frame.topic];
        delete conn.subs[frame.topic];
        this.save(ws, conn);
        if (sub?.presence != null) {
          this.broadcastPresence(frame.topic, { leaves: [{ key: sub.key, payload: sub.presence }] });
        }
        return;
      }

      case 'bc': {
        const selfEcho = conn.subs[frame.topic]?.self === true;
        for (const [other, otherConn] of this.conns()) {
          if (!otherConn.subs[frame.topic]) continue;
          if (other === ws && !selfEcho) continue;
          this.send(other, { t: 'bc', topic: frame.topic, event: frame.event, payload: frame.payload });
        }
        return;
      }

      case 'track': {
        const sub = conn.subs[frame.topic];
        if (!sub) return;
        const wasTracked = sub.presence !== null;
        sub.presence = frame.payload ?? {};
        this.save(ws, conn);
        this.broadcastPresence(frame.topic, wasTracked ? {} : { joins: [{ key: sub.key, payload: sub.presence }] });
        return;
      }

      case 'untrack': {
        const sub = conn.subs[frame.topic];
        if (!sub || sub.presence === null) return;
        const payload = sub.presence;
        sub.presence = null;
        this.save(ws, conn);
        this.broadcastPresence(frame.topic, { leaves: [{ key: sub.key, payload }] });
        return;
      }
    }
  }

  private onClose(ws: WebSocket) {
    const conn = this.conn(ws);
    if (!conn) return;
    // Clear first so a duplicate close/error event doesn't broadcast the leave twice.
    ws.serializeAttachment(null);
    for (const [topic, sub] of Object.entries(conn.subs)) {
      if (sub.presence !== null) {
        this.broadcastPresence(topic, { leaves: [{ key: sub.key, payload: sub.presence }] }, ws);
      }
    }
  }

  private notify(event: HubEvent) {
    for (const [ws, conn] of this.conns()) {
      if (event.userId && conn.userId !== event.userId) continue;
      for (const [topic, sub] of Object.entries(conn.subs)) {
        if (!sub.tables.includes(event.table)) continue;
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
