import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SKIN_IDS,
  MAX_LEADERBOARD_SCORE,
  MAX_PLAYER_NAME_LENGTH,
  formatRunDate,
  generatePlayerName,
  isValidPlayerId,
  rankOfRun,
  sanitizePlayerName,
  sortLeaderboard,
  validateRunPayload,
} from '../src/game/leaderboardCore.ts';
import { CHARACTER_SKINS } from '../src/game/constants.ts';

const validPayload = {
  playerId: '4f0c5f3e-2a11-4a8e-9b21-0c1d2e3f4a5b',
  runId: 'run-1a2b3c4d',
  name: 'SITHU',
  score: 12_345,
  maxCombo: 17,
  skinId: 'rex_red',
};

describe('validateRunPayload', () => {
  it('accepts a well-formed run', () => {
    const result = validateRunPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run).toEqual({
        playerId: '4f0c5f3e-2a11-4a8e-9b21-0c1d2e3f4a5b',
        runId: 'run-1a2b3c4d',
        name: 'SITHU',
        score: 12_345,
        maxCombo: 17,
        skinId: 'rex_red',
      });
    }
  });

  it('rejects scores that are not finite positive integers', () => {
    for (const score of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_LEADERBOARD_SCORE + 1, '100']) {
      expect(validateRunPayload({ ...validPayload, score }).ok).toBe(false);
    }
    // The absolute ceiling still applies, but a score that large now also has to
    // arrive with a run length that could have produced it.
    expect(validateRunPayload({ ...validPayload, score: MAX_LEADERBOARD_SCORE }).ok).toBe(false);
  });

  it('rejects a big score that the run time could not produce', () => {
    // 120,000 points in 20 s is 6,000/s, far above what the game can pay out.
    expect(validateRunPayload({ ...validPayload, score: 120_000, durationMs: 20_000 }).ok).toBe(false);
  });

  it('requires a run length for a big score, and one in a believable range', () => {
    expect(validateRunPayload({ ...validPayload, score: 120_000 }).ok).toBe(false);
    for (const durationMs of [-1, 0, 1_000, 21 * 60_000, 1.5, '60000']) {
      expect(validateRunPayload({ ...validPayload, score: 120_000, durationMs }).ok).toBe(false);
    }
  });

  it('accepts a big score that its run length could produce, and carries it through', () => {
    const result = validateRunPayload({ ...validPayload, score: 120_000, durationMs: 90_000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.score).toBe(120_000);
      expect(result.run.durationMs).toBe(90_000);
    }
  });

  it('leaves ordinary scores alone when a duration is missing or zero', () => {
    const result = validateRunPayload({ ...validPayload, durationMs: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.run.durationMs).toBeUndefined();
    expect(validateRunPayload({ ...validPayload, score: 900, maxCombo: 2 }).ok).toBe(true);
  });

  it('rejects out-of-range or fractional combos', () => {
    for (const maxCombo of [-1, 2.5, 251, Number.NaN, '5']) {
      expect(validateRunPayload({ ...validPayload, maxCombo }).ok).toBe(false);
    }
  });

  it('rejects unknown skins and malformed run ids', () => {
    expect(validateRunPayload({ ...validPayload, skinId: 'not_a_dino' }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, skinId: 42 }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, runId: 'short' }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, runId: 'has spaces in it' }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, runId: 12345678 }).ok).toBe(false);
  });

  it('requires a player id so each player owns exactly one row', () => {
    expect(validateRunPayload({ ...validPayload, playerId: undefined }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, playerId: 'short' }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, playerId: 'has spaces' }).ok).toBe(false);
    expect(validateRunPayload({ ...validPayload, playerId: 42 }).ok).toBe(false);
    expect(isValidPlayerId(validPayload.playerId)).toBe(true);
  });

  it('rejects missing payloads', () => {
    expect(validateRunPayload(null).ok).toBe(false);
    expect(validateRunPayload(undefined).ok).toBe(false);
    expect(validateRunPayload('run').ok).toBe(false);
  });

  it('sanitizes names instead of trusting them', () => {
    expect(sanitizePlayerName('  Sithu\u0000   Nyein  ')).toBe('Sithu Nyein');
    expect(sanitizePlayerName('')).toBe('YOU');
    expect(sanitizePlayerName(undefined)).toBe('YOU');
    expect(sanitizePlayerName('X'.repeat(50))).toHaveLength(MAX_PLAYER_NAME_LENGTH);

    const result = validateRunPayload({ ...validPayload, name: '  REX\u001b[31m  ' });
    expect(result.ok && result.run.name).toBe('REX [31m');
  });

  it('uses the same skin roster as the game', () => {
    const gameSkins = CHARACTER_SKINS.map((skin) => skin.id).sort();
    expect([...ALLOWED_SKIN_IDS].sort()).toEqual(gameSkins);
  });
});

describe('generated player names', () => {
  it('builds a short name a new player never has to type', () => {
    expect(generatePlayerName(() => 0)).toBe('SWIFT_REX10');
    expect(generatePlayerName(() => 0.999)).toBe('FERAL_DINO99');
  });

  it('always fits the board name rules', () => {
    for (let i = 0; i < 200; i++) {
      const name = generatePlayerName();
      expect(name.length).toBeLessThanOrEqual(MAX_PLAYER_NAME_LENGTH);
      expect(name).toMatch(/^[A-Z]+_[A-Z]+\d{2}$/);
      expect(sanitizePlayerName(name)).toBe(name);
    }
  });
});

describe('board helpers', () => {
  it('ranks by descending score with combo as the tie-break', () => {
    const entries = [
      { id: 'a', score: 100, maxCombo: 2 },
      { id: 'b', score: 300, maxCombo: 4 },
      { id: 'c', score: 100, maxCombo: 9 },
    ];
    expect(sortLeaderboard(entries).map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    expect(rankOfRun(sortLeaderboard(entries), 'a')).toBe(3);
    expect(rankOfRun(entries, 'missing')).toBe(0);
  });

  it('labels recent runs without inventing absolute dates', () => {
    const now = Date.UTC(2026, 9, 24, 12, 0, 0);
    expect(formatRunDate(now - 30_000, now)).toBe('Just now');
    expect(formatRunDate(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRunDate(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatRunDate(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});
