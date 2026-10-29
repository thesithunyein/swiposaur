import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLeaderboardHandler } from '../api/leaderboard.ts';
import { FileLeaderboardStore, type LeaderboardStore } from '../server/leaderboardStore.ts';

interface RecordedResponse {
  statusCode: number;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string | string[]>;
}

function createRes() {
  const recorded: RecordedResponse = { statusCode: 200, body: undefined, headers: {} };
  const res = {
    status(code: number) {
      recorded.statusCode = code;
      return res;
    },
    json(body: unknown) {
      recorded.body = body as Record<string, unknown>;
      return body;
    },
    setHeader(name: string, value: string | string[]) {
      recorded.headers[name] = value;
      return res;
    },
    end(body?: string) {
      recorded.body = body ? { raw: body } : undefined;
      return res;
    },
  };
  return { res, recorded };
}

const validBody = {
  playerId: 'player-aaaabbbb',
  runId: 'run-aaaabbbb',
  name: 'SITHU',
  score: 1200,
  maxCombo: 8,
  skinId: 'rex_red',
};

let dir: string;
let file: string;
let store: FileLeaderboardStore;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swiposaur-api-'));
  file = path.join(dir, 'leaderboard.json');
  store = new FileLeaderboardStore(file);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('/api/leaderboard handler', () => {
  it('disables online mode cleanly when no durable store is configured', async () => {
    const handler = createLeaderboardHandler(() => null);
    const { res, recorded } = createRes();
    await handler({ method: 'GET' }, res);

    expect(recorded.statusCode).toBe(503);
    expect(recorded.body).toMatchObject({ storage: 'unavailable', status: 'disabled' });
    expect(recorded.body).not.toHaveProperty('entries');
  });

  it('reports durable storage and real entries only', async () => {
    const handler = createLeaderboardHandler(() => store);
    const { res, recorded } = createRes();
    await handler({ method: 'GET' }, res);

    expect(recorded.statusCode).toBe(200);
    expect(recorded.body).toMatchObject({ status: 'ok', storage: 'durable' });
    expect(recorded.body?.entries).toEqual([]);
    expect(recorded.headers['Cache-Control']).toBe('no-store');
  });

  it('creates one record when the same runId is submitted twice', async () => {
    const handler = createLeaderboardHandler(() => store);
    const first = createRes();
    await handler({ method: 'POST', body: validBody }, first.res);
    expect(first.recorded.statusCode).toBe(200);
    expect(first.recorded.body).toMatchObject({ rank: 1, duplicate: false, storage: 'durable' });

    const retry = createRes();
    await handler({ method: 'POST', body: validBody }, retry.res);
    expect(retry.recorded.statusCode).toBe(200);
    expect(retry.recorded.body).toMatchObject({ rank: 1, duplicate: true });
    expect(await store.list()).toHaveLength(1);
  });

  it('rejects malformed submissions without writing', async () => {
    const handler = createLeaderboardHandler(() => store);
    for (const body of [
      { ...validBody, score: -5 },
      { ...validBody, score: 1.2 },
      { ...validBody, maxCombo: 999 },
      { ...validBody, skinId: 'fake_skin' },
      { ...validBody, runId: 'nope' },
      { ...validBody, playerId: 'nope' },
      { ...validBody, playerId: undefined },
    ]) {
      const { res, recorded } = createRes();
      await handler({ method: 'POST', body }, res);
      expect(recorded.statusCode).toBe(400);
    }
    expect(await store.list()).toEqual([]);
  });

  it('rejects an impossible score that has no run time behind it', async () => {
    const handler = createLeaderboardHandler(() => store);

    const bare = createRes();
    await handler({ method: 'POST', body: { ...validBody, score: 5_000_000 } }, bare.res);
    expect(bare.recorded.statusCode).toBe(400);

    // A claimed duration that is far too short for the score is refused too.
    const tooFast = createRes();
    await handler(
      { method: 'POST', body: { ...validBody, score: 5_000_000, durationMs: 30_000 } },
      tooFast.res
    );
    expect(tooFast.recorded.statusCode).toBe(400);

    // A score that fits inside a real-length run is accepted.
    const honest = createRes();
    await handler(
      { method: 'POST', body: { ...validBody, score: 2_000_000, durationMs: 900_000 } },
      honest.res
    );
    expect(honest.recorded.statusCode).toBe(200);
    expect(await store.list()).toHaveLength(1);
  });

  it('sanitizes a non-string name instead of rejecting the run', async () => {
    const handler = createLeaderboardHandler(() => store);
    const { res, recorded } = createRes();
    await handler({ method: 'POST', body: { ...validBody, name: 42 } }, res);

    expect(recorded.statusCode).toBe(200);
    expect((await store.list())[0].name).toBe('YOU');
  });

  it('keeps one row per player across separate runs', async () => {
    const handler = createLeaderboardHandler(() => store);

    const first = createRes();
    await handler(
      { method: 'POST', body: { ...validBody, runId: 'run-first-001', score: 500 } },
      first.res
    );
    expect(first.recorded.body).toMatchObject({ improved: true, rank: 1 });

    // A worse follow-up run must not take over the player's row.
    const worse = createRes();
    await handler(
      { method: 'POST', body: { ...validBody, runId: 'run-second-01', score: 400 } },
      worse.res
    );
    expect(worse.recorded.body).toMatchObject({ improved: false, rank: 1 });
    expect(await store.list()).toHaveLength(1);
    expect((await store.list())[0].score).toBe(500);

    const better = createRes();
    await handler(
      { method: 'POST', body: { ...validBody, runId: 'run-third-001', score: 900 } },
      better.res
    );
    expect(better.recorded.body).toMatchObject({ improved: true, rank: 1 });
    expect(await store.list()).toHaveLength(1);
    expect((await store.list())[0].score).toBe(900);
  });

  it('renames the player row without adding a run', async () => {
    const handler = createLeaderboardHandler(() => store);
    const submitted = createRes();
    await handler({ method: 'POST', body: validBody }, submitted.res);

    const renamed = createRes();
    await handler(
      {
        method: 'POST',
        body: { action: 'rename', playerId: validBody.playerId, name: '  Sir   Sithu  ' },
      },
      renamed.res
    );

    expect(renamed.recorded.statusCode).toBe(200);
    expect(renamed.recorded.body).toMatchObject({ status: 'ok', name: 'Sir Sithu' });
    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Sir Sithu', score: 1200 });
  });

  it('rejects a rename from an invalid player id', async () => {
    const handler = createLeaderboardHandler(() => store);
    const { res, recorded } = createRes();
    await handler(
      { method: 'POST', body: { action: 'rename', playerId: 'nope', name: 'X' } },
      res
    );
    expect(recorded.statusCode).toBe(400);
    expect(await store.list()).toEqual([]);
  });

  it('rate limits repeated submissions from one client', async () => {
    const handler = createLeaderboardHandler(() => store);
    const headers = { 'x-forwarded-for': '203.0.113.5' };
    // 6 submissions per minute, then 429 with no extra row.
    for (let i = 0; i < 6; i++) {
      const { res, recorded } = createRes();
      await handler({ method: 'POST', body: { ...validBody, runId: `run-ratelimit-${i}` }, headers }, res);
      expect(recorded.statusCode).toBe(200);
    }
    const blocked = createRes();
    await handler({ method: 'POST', body: { ...validBody, runId: 'run-ratelimit-x' }, headers }, blocked.res);
    expect(blocked.recorded.statusCode).toBe(429);
  });

  it('returns 500 instead of a rank when persistence throws', async () => {
    const brokenStore: LeaderboardStore = {
      durable: true,
      description: 'broken',
      list: async () => [],
      rename: async () => [],
      consumeRateLimit: async () => true,
      submit: async () => {
        throw new Error('datastore offline');
      },
    };
    const handler = createLeaderboardHandler(() => brokenStore);
    const { res, recorded } = createRes();
    await handler({ method: 'POST', body: validBody }, res);

    expect(recorded.statusCode).toBe(500);
    expect(recorded.body).not.toHaveProperty('rank');
    expect(recorded.body).toMatchObject({ status: 'error' });
  });

  it('returns 500 instead of hanging when the rate limiter storage fails', async () => {
    const brokenStore: LeaderboardStore = {
      durable: true,
      description: 'broken',
      list: async () => [],
      rename: async () => [],
      consumeRateLimit: async () => {
        throw new Error('redis unavailable');
      },
      submit: async () => {
        throw new Error('should not be reached');
      },
    };
    const handler = createLeaderboardHandler(() => brokenStore);
    const { res, recorded } = createRes();
    await handler({ method: 'POST', body: validBody }, res);

    expect(recorded.statusCode).toBe(500);
    expect(recorded.body).toMatchObject({ status: 'error' });
    expect(recorded.body).not.toHaveProperty('rank');
  });
});
