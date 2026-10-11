export function generateId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Mirrors the Postgres `user_relationship_ids()` RLS helper: every non-ended relationship the user belongs to. */
export async function relationshipIdsForUser(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT id FROM relationships WHERE status <> 'ended' AND (user_1_id = ?1 OR user_2_id = ?1)`)
    .bind(userId)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Throws-as-401-equivalent guard: use in route handlers to enforce relationship membership. */
export async function isRelationshipMember(
  db: D1Database,
  userId: string,
  relationshipId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM relationships WHERE id = ?1 AND status <> 'ended' AND (user_1_id = ?2 OR user_2_id = ?2)`,
    )
    .bind(relationshipId, userId)
    .first();
  return row !== null;
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Builds `SET col = ?n, ...` + bound values for a whitelisted partial update. Booleans become 0/1. */
export function buildUpdate(
  body: Record<string, unknown>,
  allowedFields: readonly string[],
): { setClause: string; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowedFields) {
    if (body[key] === undefined) continue;
    const value = body[key];
    fields.push(`${key} = ?${fields.length + 1}`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }

  if (fields.length === 0) return null;
  return { setClause: fields.join(', '), values };
}
