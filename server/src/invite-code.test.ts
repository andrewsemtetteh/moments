import { describe, expect, it } from 'vitest';

import { newInviteCode, withFreshInviteCode } from './db';

const TAKEN = new Error('D1_ERROR: UNIQUE constraint failed: relationships.invite_code: SQLITE_CONSTRAINT');

describe('invite codes', () => {
  it('are 8 characters with no 0/O or 1/I', () => {
    for (let i = 0; i < 200; i++) expect(newInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('try a fresh code when the database says one is taken', async () => {
    const tried: string[] = [];
    const code = await withFreshInviteCode(async (c) => {
      tried.push(c);
      if (tried.length < 3) throw TAKEN;
      return c;
    });
    expect(tried).toHaveLength(3);
    expect(code).toBe(tried[2]);
  });

  it('give up after 5 tries', async () => {
    let tries = 0;
    await expect(
      withFreshInviteCode(async () => {
        tries++;
        throw TAKEN;
      }),
    ).rejects.toBe(TAKEN);
    expect(tries).toBe(5);
  });

  it('pass any other error straight through', async () => {
    const other = new Error('D1_ERROR: no such table');
    let tries = 0;
    await expect(
      withFreshInviteCode(async () => {
        tries++;
        throw other;
      }),
    ).rejects.toBe(other);
    expect(tries).toBe(1);
  });
});
