import { getClerkInstance } from '@clerk/expo';

/**
 * Cloudflare backend client. It exposes a small query-builder API (`from().select().eq()…`, `rpc`, `storage`, `functions.invoke`,
 * `channel().on().subscribe()`), so feature code stays untouched while every call now lands on
 * the Moments Worker (D1 + R2 + Durable Object realtime hub).
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export type DbError = { message: string; code?: string; details?: string };
export type DbResult<T = any> = { data: T; error: DbError | null; count?: number | null };

async function authToken(): Promise<string | null> {
  try {
    return (await getClerkInstance().session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

async function callWorker<T>(path: string, body: unknown): Promise<DbResult<T>> {
  if (!API_URL) return { data: null as T, error: { message: 'EXPO_PUBLIC_API_URL is not set' } };
  try {
    const token = await authToken();
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => null)) as DbResult<T> | { error?: string } | null;
    if (!json) return { data: null as T, error: { message: res.statusText || 'Request failed' } };
    if ('data' in json || 'count' in json) return json as DbResult<T>;
    const message = typeof json.error === 'string' ? json.error : 'Request failed';
    return { data: null as T, error: { message, code: String(res.status) } };
  } catch (e) {
    return { data: null as T, error: { message: e instanceof Error ? e.message : 'Network request failed' } };
  }
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

type Filter = { col: string; op: string; val: unknown; negate?: boolean };

function parseListValue(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return val;
}

function coerce(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

class QueryBuilder<T = any[]> implements PromiseLike<DbResult<T>> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private columns = '*';
  private filters: Filter[] = [];
  private ors: Filter[][] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN?: number;
  private countExact = false;
  private headOnly = false;
  private values: unknown;
  private onConflict?: string;
  private singleMode: 'single' | 'maybe' | null = null;

  constructor(private readonly table: string) {}

  select(columns = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    // After insert/update/upsert/delete, `.select()` only asks for the affected rows back.
    if (this.op === 'select') this.columns = columns || '*';
    if (opts?.count) this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(values: unknown) {
    this.op = 'insert';
    this.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.values = values;
    this.onConflict = opts?.onConflict;
    return this;
  }
  update(values: unknown) {
    this.op = 'update';
    this.values = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }

  private add(col: string, op: string, val: unknown, negate = false) {
    this.filters.push({ col, op, val, negate });
    return this;
  }
  eq(col: string, val: unknown) {
    return this.add(col, 'eq', val);
  }
  neq(col: string, val: unknown) {
    return this.add(col, 'neq', val);
  }
  gt(col: string, val: unknown) {
    return this.add(col, 'gt', val);
  }
  gte(col: string, val: unknown) {
    return this.add(col, 'gte', val);
  }
  lt(col: string, val: unknown) {
    return this.add(col, 'lt', val);
  }
  lte(col: string, val: unknown) {
    return this.add(col, 'lte', val);
  }
  is(col: string, val: unknown) {
    return this.add(col, 'is', val);
  }
  in(col: string, vals: unknown[]) {
    return this.add(col, 'in', vals);
  }
  not(col: string, op: string, val: unknown) {
    return this.add(col, op, op === 'in' ? parseListValue(val) : val, true);
  }
  or(expr: string) {
    const group: Filter[] = [];
    for (const part of expr.split(',')) {
      const [col, op, ...rest] = part.trim().split('.');
      if (col && op) group.push({ col, op, val: coerce(rest.join('.')) });
    }
    this.ors.push(group);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single(): QueryBuilder<any> {
    this.singleMode = 'single';
    return this as unknown as QueryBuilder<any>;
  }
  maybeSingle(): QueryBuilder<any> {
    this.singleMode = 'maybe';
    return this as unknown as QueryBuilder<any>;
  }

  private run(): Promise<DbResult<T>> {
    return callWorker<T>('/db', {
      table: this.table,
      op: this.op,
      columns: this.columns,
      filters: this.filters,
      or: this.ors,
      order: this.orders,
      limit: this.limitN,
      count: this.countExact,
      head: this.headOnly,
      values: this.values,
      onConflict: this.onConflict,
      single: this.singleMode,
    });
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// Storage + functions
// ---------------------------------------------------------------------------

function storageBucket(bucket: string) {
  const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
  return {
    async upload(path: string, body: ArrayBuffer | Blob, opts?: { contentType?: string; upsert?: boolean }) {
      if (!API_URL) return { data: null, error: { message: 'EXPO_PUBLIC_API_URL is not set' } };
      try {
        const token = await authToken();
        const res = await fetch(`${API_URL}/storage/${bucket}/${encodePath(path)}`, {
          method: 'POST',
          headers: {
            'Content-Type': opts?.contentType ?? 'application/octet-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body as any,
        });
        const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!res.ok) return { data: null, error: { message: json.error ?? res.statusText } };
        return { data: { path: json.path ?? path }, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : 'Upload failed' } };
      }
    },
    async remove(paths: string[]) {
      const res = await callWorker(`/storage-remove/${bucket}`, { paths });
      return { data: null, error: res.error };
    },
    /**
     * Moment and chat files are only served with a signature that expires (see the server's
     * media-sign.ts), so a link the app makes itself (right after an upload) is signed by the
     * server. Avatars are public and need no signature.
     */
    async createSignedUrl(path: string, _ttl?: number, _opts?: unknown) {
      const plain = `${API_URL}/media/${bucket}/${encodePath(path)}`;
      if (bucket !== 'moments' && bucket !== 'chat') return { data: { signedUrl: plain }, error: null };
      try {
        const token = await authToken();
        const res = await fetch(`${API_URL}/media/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ key: `${bucket}/${path}` }),
        });
        const json = (await res.json().catch(() => null)) as { signedUrl?: string; error?: string } | null;
        if (!res.ok || !json?.signedUrl) return { data: null, error: { message: json?.error ?? 'Could not sign the link' } };
        return { data: { signedUrl: json.signedUrl }, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : 'Could not sign the link' } };
      }
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${API_URL}/media/${bucket}/${encodePath(path)}` } };
    },
  };
}

// ---------------------------------------------------------------------------
// Realtime (WebSocket to the relationship's Durable Object hub)
// ---------------------------------------------------------------------------

type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'TIMED_OUT';
type PresenceEvent = { key: string; newPresences: any[]; leftPresences: any[] };
type PgFilter = { event?: string; schema?: string; table: string; filter?: string };

type Listener =
  | { kind: 'broadcast'; event: string; cb: (msg: any) => void }
  | { kind: 'presence'; event: 'sync' | 'join' | 'leave'; cb: (msg: PresenceEvent) => void }
  | { kind: 'pg'; filter: PgFilter; cb: (msg: any) => void };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function activeRelationshipId(): string | null {
  try {
    // Lazy: the store imports call-manager, which imports this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRelationshipStore } = require('@/stores') as typeof import('@/stores');
    return useRelationshipStore.getState().relationship?.id ?? null;
  } catch {
    return null;
  }
}

function matchesFilter(filter: string | undefined, row: Record<string, any> | null): boolean {
  if (!filter) return true;
  const m = /^([a-z_0-9]+)=eq\.(.+)$/i.exec(filter);
  if (!m) return true;
  return !!row && String(row[m[1]]) === m[2];
}

export class RealtimeChannel {
  readonly topic: string;
  readonly listeners: Listener[] = [];
  readonly config: { broadcast?: { self?: boolean }; presence?: { key?: string } };
  private status: ((status: ChannelStatus) => void) | null = null;
  private presence: Record<string, any[]> = {};
  private tracked: unknown | null = null;
  joined = false;
  relationshipId: string | null;

  constructor(
    readonly name: string,
    opts: { config?: { broadcast?: { self?: boolean }; presence?: { key?: string } } } = {},
    private readonly hub: HubManager,
  ) {
    this.config = opts.config ?? {};
    this.topic = `realtime:${name}`;
    this.relationshipId = UUID.exec(name)?.[0] ?? null;
  }

  on(type: 'broadcast', filter: { event: string }, cb: (msg: { type: string; event: string; payload: any }) => void): this;
  on(type: 'presence', filter: { event: 'sync' | 'join' | 'leave' }, cb: (msg: PresenceEvent) => void): this;
  on(type: 'postgres_changes', filter: PgFilter | { event: string; schema: string; table: string; filter?: string }, cb: (msg: any) => void): this;
  on(type: string, filter: any, cb: (msg: any) => void): this {
    if (type === 'broadcast') this.listeners.push({ kind: 'broadcast', event: filter.event, cb });
    else if (type === 'presence') this.listeners.push({ kind: 'presence', event: filter.event, cb });
    else this.listeners.push({ kind: 'pg', filter, cb });
    return this;
  }

  subscribe(cb?: (status: ChannelStatus, err?: Error) => void) {
    this.status = cb ?? null;
    this.hub.join(this);
    return this;
  }

  async send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<'ok' | 'error'> {
    return this.hub.frame(this, { t: 'bc', topic: this.name, event: msg.event, payload: msg.payload }) ? 'ok' : 'error';
  }

  async track(payload: unknown): Promise<'ok' | 'error'> {
    this.tracked = payload;
    return this.hub.frame(this, { t: 'track', topic: this.name, payload }) ? 'ok' : 'error';
  }

  async untrack(): Promise<'ok' | 'error'> {
    this.tracked = null;
    return this.hub.frame(this, { t: 'untrack', topic: this.name }) ? 'ok' : 'error';
  }

  presenceState<T = any>(): Record<string, T[]> {
    return this.presence as Record<string, T[]>;
  }

  // -- called by HubManager ---------------------------------------------------

  get tables(): string[] {
    return [...new Set(this.listeners.filter((l): l is Extract<Listener, { kind: 'pg' }> => l.kind === 'pg').map((l) => l.filter.table))];
  }

  onJoined(state: Record<string, any[]>) {
    this.joined = true;
    this.presence = state;
    if (this.tracked !== null) void this.track(this.tracked);
    this.status?.('SUBSCRIBED');
  }

  onDisconnected(status: ChannelStatus) {
    this.joined = false;
    this.status?.(status);
  }

  onBroadcast(event: string, payload: unknown) {
    for (const l of this.listeners) {
      if (l.kind === 'broadcast' && (l.event === event || l.event === '*')) l.cb({ type: 'broadcast', event, payload });
    }
  }

  onPresence(state: Record<string, any[]>, joins?: { key: string; payload: any }[], leaves?: { key: string; payload: any }[]) {
    this.presence = state;
    for (const l of this.listeners) {
      if (l.kind !== 'presence') continue;
      if (l.event === 'sync') l.cb({ key: '', newPresences: [], leftPresences: [] });
      else if (l.event === 'join') for (const j of joins ?? []) l.cb({ key: j.key, newPresences: [j.payload], leftPresences: [] });
      else if (l.event === 'leave') for (const v of leaves ?? []) l.cb({ key: v.key, newPresences: [], leftPresences: [v.payload] });
    }
  }

  onTableEvent(table: string, eventType: string, next: any, old: any) {
    for (const l of this.listeners) {
      if (l.kind !== 'pg' || l.filter.table !== table) continue;
      const wanted = l.filter.event ?? '*';
      if (wanted !== '*' && wanted !== eventType) continue;
      if (!matchesFilter(l.filter.filter, next ?? old)) continue;
      l.cb({ schema: 'public', table, eventType, new: next ?? {}, old: old ?? {} });
    }
  }
}

class HubConnection {
  private ws: WebSocket | null = null;
  private channels = new Set<RealtimeChannel>();
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private connecting = false;

  constructor(private readonly relationshipId: string, private readonly onEmpty: () => void) {}

  get isOpen() {
    return this.ws?.readyState === 1;
  }

  add(channel: RealtimeChannel) {
    this.channels.add(channel);
    if (this.isOpen) this.sendJoin(channel);
    else void this.connect();
  }

  remove(channel: RealtimeChannel) {
    this.channels.delete(channel);
    if (this.isOpen) this.send({ t: 'leave', topic: channel.name });
    channel.joined = false;
    if (this.channels.size === 0) {
      this.close();
      this.onEmpty();
    }
  }

  send(frame: unknown): boolean {
    if (!this.isOpen) return false;
    this.ws!.send(JSON.stringify(frame));
    return true;
  }

  private sendJoin(channel: RealtimeChannel) {
    this.send({
      t: 'join',
      topic: channel.name,
      self: channel.config.broadcast?.self === true,
      key: channel.config.presence?.key,
      tables: channel.tables,
    });
  }

  private async connect() {
    if (this.connecting || this.ws || this.closed || !API_URL) return;
    this.connecting = true;
    const token = await authToken();
    this.connecting = false;
    if (!token || this.closed || this.channels.size === 0) {
      this.scheduleRetry();
      return;
    }

    const ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/${this.relationshipId}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      for (const channel of this.channels) this.sendJoin(channel);
      this.heartbeat = setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (event) => this.onFrame(String(event.data));
    ws.onclose = () => this.onClosed(ws);
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private onClosed(ws: WebSocket) {
    if (this.ws !== ws) return;
    this.ws = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const channel of this.channels) channel.onDisconnected('CLOSED');
    if (!this.closed && this.channels.size > 0) this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retryTimer || this.closed) return;
    const delay = Math.min(1000 * 2 ** this.retry++, 15_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private channelFor(topic: string) {
    for (const channel of this.channels) if (channel.name === topic) return channel;
    return null;
  }

  private onFrame(raw: string) {
    let frame: any;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }
    const channel = frame.topic ? this.channelFor(frame.topic) : null;
    switch (frame.t) {
      case 'joined':
        channel?.onJoined(frame.state ?? {});
        break;
      case 'bc':
        channel?.onBroadcast(frame.event, frame.payload);
        break;
      case 'presence':
        channel?.onPresence(frame.state ?? {}, frame.joins, frame.leaves);
        break;
      case 'pg':
        channel?.onTableEvent(frame.table, frame.eventType, frame.new, frame.old);
        break;
    }
  }

  close() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retryTimer = null;
    this.heartbeat = null;
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  }
}

class HubManager {
  private connections = new Map<string, HubConnection>();
  readonly channels = new Set<RealtimeChannel>();

  private connectionFor(channel: RealtimeChannel): HubConnection | null {
    const relId = channel.relationshipId ?? activeRelationshipId();
    if (!relId) return null;
    channel.relationshipId = relId;
    let conn = this.connections.get(relId);
    if (!conn) {
      conn = new HubConnection(relId, () => this.connections.delete(relId));
      this.connections.set(relId, conn);
    }
    return conn;
  }

  join(channel: RealtimeChannel) {
    this.channels.add(channel);
    this.connectionFor(channel)?.add(channel);
  }

  frame(channel: RealtimeChannel, frame: unknown): boolean {
    if (!channel.joined) return false;
    return this.connectionFor(channel)?.send(frame) ?? false;
  }

  remove(channel: RealtimeChannel) {
    this.channels.delete(channel);
    const relId = channel.relationshipId;
    if (relId) this.connections.get(relId)?.remove(channel);
  }
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

const hub = new HubManager();

export const cloudflare = {
  from: (table: string) => new QueryBuilder(table),
  rpc: (name: string, args?: Record<string, unknown>) => callWorker(`/rpc/${name}`, args ?? {}),
  storage: { from: storageBucket },
  functions: {
    invoke: (name: string, opts?: { body?: unknown }) => callWorker(`/fn/${name}`, opts?.body ?? {}),
  },
  channel: (name: string, opts?: ConstructorParameters<typeof RealtimeChannel>[1]) =>
    new RealtimeChannel(name, opts, hub),
  removeChannel: async (channel: RealtimeChannel) => {
    hub.remove(channel);
    return 'ok' as const;
  },
  getChannels: () => [...hub.channels],
};

export type CloudflareClient = typeof cloudflare;
