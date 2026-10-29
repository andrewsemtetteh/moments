# Moments API: security and scalability audit

Written 2026-10-29; fixes applied the same day (see **Status** at the end). This audit covers the Cloudflare Worker in `server/` (Hono, D1, R2, a Durable
Object for realtime, a Queue, Clerk auth). It was checked against Cloudflare's current Workers best
practices. Line numbers refer to the code as it was on this date.

**Overall:** the foundations are good.

- Every query uses bound parameters.
- Table and column names in the generic `/db` API are checked against a fixed list and the real
  schema.
- Billing and Plus columns are protected from clients.
- The billing webhook checks its signature and protects against replays.
- Private media links are signed and expire.
- Realtime uses the Durable Object Hibernation API.
- Push retries go through a Queue.
- Secrets are stored as Wrangler secrets, and none are committed to git.

The serious issues are:

- Invite codes can be guessed or chosen, and two people can join the same space at once (pairing).
- The API runs on `workers.dev`, so the zone-level protections (WAF, rate-limit rules, edge cache)
  aren't active.
- Several write routes have no size limits or rate limits.
- The hourly cron jobs won't scale as the number of couples grows.

---

## Fix first (high)

### H1. Invite codes are short, made on the phone with `Math.random`, and can be chosen by the client

- **Where:**
  - `src/services/api.ts:49` (the app makes the code)
  - `server/src/compat.ts:346-351` and `:451-456` (the server accepts any 6–12 character code the
    app sends)
  - `migrations/*: idx_relationships_invite` (a plain index, not a unique one)
- **Why it matters:** a code is the only thing between a stranger and joining someone's space.
  Once they join, they see everything that person posts.
  - The code is 6 characters from a 32-letter alphabet (about 1 billion combinations) and is
    predictable (`Math.random`).
  - A client can pick its own code, for example `AAAAAA`.
  - (Correction: `invite_code` already has a `UNIQUE` constraint, so two spaces can't share a code.)
  - The guess limit is 10 tries per account per 10 minutes. Making new accounts gets around it.
- **Fix:**
  - Only the server makes codes. Ignore `invite_code` in `/db` inserts and updates; the existing
    `POST /relationships/:id/invite-code` route already does this.
  - Use `crypto.getRandomValues` and 8–10 characters from the same unambiguous alphabet.
  - Add `CREATE UNIQUE INDEX … ON relationships(invite_code) WHERE invite_code IS NOT NULL`.
  - Add a per-IP limit on joining (see M3), and consider codes that expire after a few days.

### H2. Two people can join the same space at the same moment

- **Where:** `server/src/index.ts:481-489`, `server/src/compat.ts:659-666`.
- **Why it matters:** the update that sets `user_2_id` doesn't check that the seat is still empty.
  If two people submit the same code at the same moment, the second one silently replaces the
  first. The first person was told they'd joined, and their own pending space has already been
  ended.
- **Fix:**
  - Add `AND user_2_id IS NULL AND status = 'pending'` to that update and check
    `meta.changes === 1`.
  - Run the "end my own pending space" update only after the join has succeeded (in the same
    batch, guarded by the same condition), or return 409 "That space was just joined".

### H3. The API runs on `workers.dev`, so zone protections and edge caching are off

- **Where:** `server/wrangler.jsonc` (`routes` is commented out), and the app's
  `EXPO_PUBLIC_API_URL`, which points to `*.workers.dev`.
- **Why it matters:**
  - Cloudflare's automatic DDoS protection still applies.
  - WAF managed rules, rate-limiting rules, Bot Fight Mode, and the edge media cache in
    `index.ts:71-85` (which its own comment says only works on a custom domain) all need a zone.
  - Every photo view currently goes to R2.
- **Fix:**
  - Add `vasemti.com` as a zone and set `"routes": [{ "pattern": "api.vasemti.com",
    "custom_domain": true }]`.
  - Point the app at the new address.
  - Once the app has moved over, set `"workers_dev": false` and `"preview_urls": false`, so the old
    address can't be used to bypass the WAF.

---

## Fix soon (medium)

### M1. Request bodies have no size limit

- **Where:** almost every `c.req.json()`. Examples: `index.ts:293, 507, 550, 615`, `compat.ts:299`,
  and `billing.ts:493`, which reads the whole body before checking the signature.
- **Why it matters:** Workers accept bodies up to 100 MB. One large JSON body can use up an
  isolate's 128 MB of memory and CPU before any of the checks run.
- **Fix:** use Hono's `bodyLimit` middleware:
  - about 256 KB on JSON routes
  - about 1 MB on the webhook
  - keep the existing per-route limits on uploads (`/storage`, `/me/avatar`)

### M2. Text and list sizes aren't checked

- **Where:**
  - `index.ts:550-556`: moment `type` and `content` are free text with no length limit.
  - `index.ts:615-621`: message `content`, `media_url` and `media_type`.
  - `index.ts:729-734`: `mood`.
  - `index.ts:643` and `compat.ts:729,750`: the reaction `emoji` can be any string.
  - `compat.ts:334`: `/db` insert accepts any number of rows in one request.
  - `index.ts:766` and `compat.ts:842`: `ids` lists have no cap. D1 allows 100 bound parameters, so
    a long list errors.
  - `index.ts:380`: push token.
- **Why it matters:** one user can store megabytes per row, slow everyone's queries, and push
  D1 toward its 10 GB limit.
- **Fix:**
  - Cap each field, for example: message 4,000 characters, moment 2,000, mood and emoji 32,
    token 256.
  - Allow at most 50 rows per `/db` insert and 100 `ids`.
  - Check `type` and `media_type` against a list of allowed values.

### M3. Some routes have no rate limit, and nothing limits by IP before sign-in

- **No limit:**
  - `/db`, which includes unlimited `analytics_events` inserts (`compat.ts:81`)
  - most of `/rpc/*`
  - `POST /users`
  - `POST /relationships`, where each call creates a new space
  - `GET /username-available` (`index.ts:345`), which calls Clerk's API on every keystroke and can
    run into Clerk's own limits
  - `POST /me/push-token`
  - `POST /relationships/:id/moods`
  - message reactions, hide and pin
- **Before sign-in:** `/health` queries D1 with no login (`index.ts:50-53`), and `/ws` checks the
  token without any IP limit.
- **Fix:**
  - Add a catch-all per-user limiter after `requireAuth`, for example 600 requests a minute,
    using the existing `RL_*` bindings or a new one.
  - Add tighter limits on the routes above.
  - Once H3 is done, add a zone rate-limiting rule per IP: for example 300 requests per 10 seconds
    on `/*`, and 20 a minute on `/rpc/join_relationship_by_invite` and `/relationships/join`.
  - Make `/health` return without touching D1, and add a separate authenticated deep check.

### M4. Any private media URL in a response gets re-signed, including links users paste in

- **Where:** `index.ts:42-48` together with `media-sign.ts:70-83`.
- **Why it matters:** the middleware re-signs every `/media/moments/...` or `/media/chat/...` URL
  found in any JSON response, including message and moment text the user wrote.
  - Example: someone who once had a link, such as an ex-partner after the relationship ends, can
    paste the old expired URL into a new chat and get a fresh valid link back.
  - That gets around both the two-week expiry and the membership check.
- **Fix:**
  - Sign only when the key's relationship id (`moments/<relId>/…`) is one of the caller's
    relationships. The middleware already runs after `requireAuth` for those routes; pass `userId`
    in.
  - Or sign only the known media columns (`media_url`, `avatar_url`) rather than scanning all text.

### M5. Retried posts create duplicate moments and messages

- **Where:** `index.ts:552,617`, and `compat.ts:682-709` (`create_moment`).
- **Why it matters:** if the phone times out but the server already saved the post, the app's
  retry creates a duplicate. It also counts twice against the free daily moment allowance and
  sends two pushes.
- **Fix:** accept a client-generated `id` (a UUID) or an `Idempotency-Key` header, and insert with
  `ON CONFLICT(id) DO NOTHING`. The `/db` path already supports client-supplied ids.

### M6. No timeouts on calls to OpenAI, Gemini, Expo and TURN

- **Where:** `functions.ts:28, 50, 610` and `push.ts:122`.
- **Why it matters:** a slow provider holds the request open (the app gives up after 12 seconds)
  and uses up the cron's time budget.
- **Fix:**
  - Pass `signal: AbortSignal.timeout(8000)` on these calls; use about 10 seconds for AI calls.
  - On a timeout, fall back to what's already there: the content bank for AI, the queue for push.

### M7. The hourly cron jobs scan every couple in one run

- **Where:** `index.ts:808-823`; `core.ts` (`sendStreakRiskReminders`, `settleBrokenStreaks`,
  `sendStreakRestoreReminders`, `sendMoodCheckins`); `birthdays.ts`.
- **Why it matters:**
  - Each job loads every active couple with no `LIMIT`, then loops through them one at a time with
    extra queries per couple.
  - `sendMoodCheckins` groups the entire `mood_logs` table every hour, and that table only grows.
  - At around 10,000 or more couples, a run will hit the cron's CPU limit and stop part-way. Some
    couples then get no reminder, or their streak never gets settled.
  - It also makes D1 busy for user requests, because D1 runs one query at a time per database.
- **Fix:**
  - Have the cron only send work to a Queue, in pages of about 500 couples, or grouped by
    timezone hour, since most jobs only matter in one hour of the day for each person. Queue
    consumers then process the pages in parallel.
  - Rewrite `sendMoodCheckins` to read only recent rows, using the existing
    `idx_mood_relationship` index, or keep a `last_mood_at` column on users.
  - Set `"limits": { "cpu_ms": 300000 }` for headroom on the paid plan.

### M8. Joining with a WebSocket puts the session token in the URL

- **Where:** `index.ts:133-153`.
- **Why it matters:** the Clerk token is in the query string. Workers Logs and traces record
  request URLs, so live tokens end up in logs. Clerk tokens are short-lived (about 60 seconds),
  which limits but doesn't remove the risk.
- **Fix:**
  - Swap the token for a single-use ticket. The app calls `POST /ws-ticket`, the server saves
    `{userId, relId}` under a random id for 30 seconds, and the socket connects with `?ticket=`.
  - Or send the token in the first WebSocket message, and close the socket if it doesn't arrive
    within 5 seconds.

---

## Tidy up (low)

| # | Issue | Where | Fix |
| --- | --- | --- | --- |
| L1 | Database error text goes straight back to the client, revealing table and column names. | `compat.ts:289-293`, `index.ts:329,340` | Log the full error and return a generic message plus a code. |
| L2 | Reactions, `viewed_by` and `hidden_for` read a JSON value, change it and write it back, so two people reacting at once can lose one update. | `index.ts:645-664`, `compat.ts:725-765` | Do the update in one SQL statement with `json_set` / `json_remove`, or retry when `meta.changes` is 0 and the row has changed. |
| L3 | Two copies of the same webhook event arriving at once can both be applied. The check-then-insert isn't atomic. | `billing.ts:516-524` | `INSERT … ON CONFLICT DO NOTHING RETURNING id` first, and only apply the event if a row came back. |
| L4 | Clients can insert their own `streaks` row (for example, a fake 500-day streak on a new couple). | `compat.ts:67` | Remove `insert` from the `streaks` policy; the server already creates that row. |
| L5 | Every token check fetches Clerk's signing keys over the network (once per isolate), and doesn't check `authorizedParties`. | `auth.ts:20`, `index.ts:140` | Pass `jwtKey` (Clerk's PEM public key, as a secret) so checks need no network call and keep working during a Clerk outage, and set `authorizedParties`. |
| L6 | The media signing key is derived from the Clerk secret, so rotating Clerk's key breaks every photo link. | `media-sign.ts:18` | Set a separate `MEDIA_SIGNING_SECRET` with `wrangler secret put`. |
| L7 | Every JSON response is copied, scanned with a regex and rebuilt. That costs CPU on every call, and up to 1,000 rows on `/db` selects. | `index.ts:42-48` | Covered by the M4 fix: sign only the known media columns, as the data is shaped. |
| L8 | Missing index: registering a push token scans every user. | `index.ts:384`, `compat.ts:854` | `CREATE INDEX idx_users_push_token ON users(expo_push_token)`. |
| L9 | ~~Duplicate moments index~~. Not a real issue: migration 0003 rebuilt the table, so only the composite index exists. | migrations | Nothing to do. |
| L10 | Realtime broadcast frames have no size or rate limit inside the hub. | `hub.ts:160-170` | Ignore frames over about 16 KB, and close a socket that sends more than about 50 frames a second. |
| L11 | Logs aren't structured JSON, have no sampling rate set, and source maps aren't uploaded. | `wrangler.jsonc`, `console.*` | `"observability": { "enabled": true, "head_sampling_rate": 1 }` (lower it as traffic grows), `"upload_source_maps": true`, and `console.log(JSON.stringify({ event, userId, … }))`. |
| L12 | Rate-limit rows are cleaned up in the cron with a call that isn't awaited, so it can fail without anyone knowing. | `index.ts:822` | Add `.catch(…)` with a log line, like the jobs around it. |

---

## Topic by topic

| Topic | Today | Recommendation |
| --- | --- | --- |
| **SQL injection** | Safe. Every value is bound. Table, column and order names in `/db` come from a fixed list or are checked against the schema (`IDENT` plus `PRAGMA table_info`). Dynamic `SET` lists come from fixed lists. | Keep it that way. Never put request values into `prepare()` text. |
| **CORS** | No CORS headers, so browsers can't call the API from other sites. That's the right default for a phone app. | If a web app is added, use `hono/cors` and allow only its exact address. Never use `*` with credentials. |
| **Encryption in transit** | TLS from phone to Cloudflare. Worker to D1, R2 and the Durable Object travels inside Cloudflare, encrypted. | Enable HSTS on the custom domain (H3). Consider certificate pinning in the app later. |
| **Encryption at rest** | D1, R2 and Durable Object storage are encrypted at rest by Cloudflare (AES-256). | Location, birthdays and messages are stored as plain values inside that encrypted storage. End-to-end encrypted chat would be a product decision; it's not required. |
| **DDoS** | Cloudflare's automatic network and application-level DDoS protection applies even on `workers.dev`. | H3 (custom domain) plus WAF managed rules and rate-limiting rules (M3). Turn on Bot Fight Mode. |
| **Rate limiting** | Good for the busy routes (the in-memory `RL_*` limiters) and for rare exact limits (counted in D1). | M3: a catch-all per-user limit and per-IP zone rules. |
| **API gateway** | The Worker is the gateway: auth, routing and limits in one place. | API Shield (schema validation, JWT checks at the edge) becomes worth it on a paid zone once H3 is done. |
| **Load balancing** | Not needed. Cloudflare routes every request to the nearest location, and Smart Placement runs the Worker near D1. | Nothing to do. Load Balancing is only for your own origin servers. |
| **Horizontal and vertical scaling** | Workers and Durable Objects scale automatically, with one hub per couple. **The single D1 database is the limit:** one query at a time per database, and 10 GB maximum. | In order: (1) keep every hot query indexed (L8, M7); (2) turn on D1 read replication and use the Sessions API (`env.DB.withSession()`) for reads; (3) move chat (the fastest-growing table) into each couple's Durable Object SQLite, which scales one object per couple; (4) archive old notifications, analytics and rate-limit rows. |
| **Connection pooling** | Not applicable. D1 is a binding, with no connections to manage. | Hyperdrive only if you ever add an outside Postgres or MySQL. |
| **Database indexing** | Good coverage on the per-couple tables. | L8 (push token), L9 (drop the duplicate). Check `wrangler d1 insights` for slow queries every month. |
| **Query optimisation** | `SELECT *` everywhere. Lists default to 300–1,000 rows (`index.ts:529`, `compat.ts:427`). | Select only the columns needed for lists, page by `created_at` (already supported), and lower the defaults to 50–100. |
| **Caching / CDN / edge** | Media uses the edge cache plus `immutable` on the phone, but only once H3 is done. | Cache shared content that rarely changes (`experiences`, `content_bank`, `daily_questions`) in KV or the Cache API, for example 5–60 minutes. Consider R2 behind a custom domain with Cloudflare Images for thumbnails. |
| **Realtime (WebSockets / SSE / long polling)** | WebSockets on Durable Objects with Hibernation and an automatic ping/pong. This is the right choice; SSE and long polling would cost more. | M8 (token in the URL), L10 (frame limits). |
| **Message queues** | Push retries go through a Queue with growing delays (up to 8 tries). | Add a dead-letter queue (`dead_letter_queue` on the consumer) so failures can be seen. Also use queues for the cron fan-out (M7), account deletion (many R2 deletes) and AI bank refills. |
| **Retries** | Push retries are queue-based. AI and push calls have no timeouts. | M6. Retry D1 only for errors that are safe to repeat, and only for idempotent writes (M5). |
| **Idempotency** | Webhook: yes (L3 race aside). `/db` upsert: yes. Moments and messages: no. | M5. |
| **Timeouts** | None on outgoing calls. | M6. |
| **Cron jobs** | One hourly cron running seven jobs side by side. | M7: fan out to a queue, and process each timezone in its own hour. Consider Workflows for multi-step jobs that need to resume. |
| **Logging and monitoring** | Workers Logs are on. Logs are plain text. | L11. Add Cloudflare Notifications for error-rate spikes, an outside uptime check on `/health`, Logpush to R2 for longer retention, and Sentry for the Worker (the app already uses Sentry). |
| **Rollbacks** | `wrangler deploy` goes straight to 100% of traffic. Migrations only move forward. | Deploy with `wrangler versions upload` and then `wrangler versions deploy` at 10% → 50% → 100%. Roll back with `wrangler rollback`. For the database, D1 Time Travel restores to any minute in the last 30 days (`wrangler d1 time-travel restore`). Write every migration so the previous Worker version still works with it (add, then backfill, then remove later). |
| **Secrets** | Stored as Wrangler secrets. `.dev.vars` is git-ignored. Nothing is committed. | L6. Rotate the Clerk, Superwall and AI keys once a year. |

---

## Status (2026-10-29)

**Fixed in code:**

| Finding | What changed |
| --- | --- |
| H1 | Codes are made only on the server: 8 characters from secure randomness (`newInviteCode`, about 10^12 combinations). Codes sent by the app are ignored. New `ensure_invite_code` RPC. The app no longer makes codes. |
| H2 | One shared `joinWithInviteCode` takes the seat only if it's still empty, closes your own waiting space only after the join succeeds, and returns 409 if someone got there first. The join route also stopped returning the partner's full private row; it now sends their public profile. |
| H3 (partly) | HSTS and `nosniff` headers on every response. Config is ready to switch to the custom domain (`routes`, `workers_dev: false`, `preview_urls: false`, still commented out). |
| M1 | Body limit: 512 KB for JSON, 16 MB for the avatar route. Uploads keep their own 50 MB streaming cap. |
| M2 | `limits.ts`: caps on text fields, ids, rows per insert and filter lists, on both the direct routes and `/db` / `/rpc`. |
| M3 | Catch-all limit of 600 requests a minute per user (new `RL_600_PER_MIN`). Limits on creating spaces, the username check, push tokens and moods. Per-IP limits on `/ws` and on both join paths. `/health` no longer touches D1. |
| M4 | Signing only covers files in the caller's own spaces. Realtime only signs the target couple's files. |
| M5 | App-chosen ids (UUIDs) for moments and messages. A replay returns the saved row, without running side effects again or using up the allowance twice. |
| M6 | Timeouts: 10 s for AI calls, 8 s for Expo push, 5 s for TURN. Each falls back to the existing path. |
| M7 | `jobs.ts`: the cron queues pages of 200 couples to `moments-jobs`, and each page queues the next. Without the queue, the cron pages through couples itself. |
| M8 | One-minute, single-space realtime tickets (`POST /ws-ticket`, `ws-ticket.ts`). The app uses them. The old `?token=` path stays working for builds already installed. |
| L1 | Database errors are logged, and the app gets a generic message plus a code. |
| L2 | `updateJsonColumn`: a write only lands if the value hasn't changed since it was read, otherwise it retries. Used for reactions, `viewed_by` and `hidden_for`. |
| L3 | The webhook claims the event id first (atomic insert), and releases it if applying fails. |
| L4 | A client streak insert can only set `relationship_id`. |
| L5 | Optional `CLERK_JWT_KEY` lets token checks run with no network call to Clerk. |
| L8 | Migration `0023_push_token_index.sql`. |
| L10 | The hub ignores frames over 16 KB and closes a socket sending more than 50 frames a second. |
| L11 | `head_sampling_rate`, `upload_source_maps`, and JSON log lines. |
| L12 | The cron cleanup handles and logs errors. |
| Rollbacks | `npm run deploy:gradual` / `promote` / `rollback` / `migrate` in `server/`. |
| Queues | A dead-letter queue `moments-push-dlq` for pushes that fail every retry. |

**Needs you (can't be done from code):**

- **H3:** add `vasemti.com` as a zone in Cloudflare, uncomment `routes`, and point
  `EXPO_PUBLIC_API_URL` at the new domain. Then add WAF managed rules, a per-IP rate-limit rule
  and Bot Fight Mode. Once old app builds are gone, uncomment `workers_dev: false` and
  `preview_urls: false`.
- **L5:** `wrangler secret put CLERK_JWT_KEY`, using the PEM key from the Clerk dashboard (API
  keys, then "Show JWT public key").
- **Alerts:** in Cloudflare Notifications, turn on Workers error-rate alerts, and add an outside
  uptime check on `/health`.

**Left for later (growth work, not bugs):** D1 read replication with the Sessions API, moving
chat into per-couple Durable Objects, caching shared content in KV, lowering the default list
sizes (this needs matching changes in the app), and archiving old rows.
