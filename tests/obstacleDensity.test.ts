import { describe, expect, it } from 'vitest';
import {
  BASE_RUN_SPEED,
  DESKTOP_OBSTACLE_RULES,
  ROW_INTERVAL_JITTER_SECONDS,
  ROW_INTERVAL_MIN_SECONDS,
  SPAWN_LOOKAHEAD_SECONDS,
  TOUCH_OBSTACLE_RULES,
  getObstacleRule,
  getRowGapUnits,
  getSpawnLookaheadUnits,
  resolveCorridorSpawn,
  resolveObstacleSpawn,
} from '../src/game/obstacleDensity.ts';

/** Deterministic PRNG so distribution checks are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe('obstacle density rule table', () => {
  it('leaves the first 40 metres clear in both modes', () => {
    for (const touch of [false, true]) {
      expect(resolveObstacleSpawn(0, touch, () => 0)).toEqual({ isObstacleSegment: false, laneCount: 0 });
      expect(resolveObstacleSpawn(40, touch, () => 0)).toEqual({ isObstacleSegment: false, laneCount: 0 });
      expect(getObstacleRule(40, touch)).toBeNull();
      expect(getObstacleRule(40.1, touch)).toEqual(
        touch ? TOUCH_OBSTACLE_RULES.opening : DESKTOP_OBSTACLE_RULES.opening
      );
    }
  });

  it('uses the two-lane desktop curve', () => {
    expect(DESKTOP_OBSTACLE_RULES.opening).toEqual({ chance: 0.7, oneLaneShare: 0.3 });
    expect(DESKTOP_OBSTACLE_RULES.mid).toEqual({ chance: 0.9, oneLaneShare: 0.3 });
    expect(DESKTOP_OBSTACLE_RULES.late).toEqual({ chance: 1, oneLaneShare: 0.3 });
    expect(getObstacleRule(50, false)).toEqual(DESKTOP_OBSTACLE_RULES.opening);
    expect(getObstacleRule(80, false)).toEqual(DESKTOP_OBSTACLE_RULES.opening);
    expect(getObstacleRule(80.1, false)).toEqual(DESKTOP_OBSTACLE_RULES.mid);
    expect(getObstacleRule(250, false)).toEqual(DESKTOP_OBSTACLE_RULES.mid);
    expect(getObstacleRule(250.1, false)).toEqual(DESKTOP_OBSTACLE_RULES.late);
  });

  it('uses the touch curve with the same lane split', () => {
    expect(TOUCH_OBSTACLE_RULES.opening).toEqual({ chance: 0.55, oneLaneShare: 0.3 });
    expect(TOUCH_OBSTACLE_RULES.mid).toEqual({ chance: 0.8, oneLaneShare: 0.3 });
    expect(TOUCH_OBSTACLE_RULES.late).toEqual({ chance: 1, oneLaneShare: 0.3 });
    expect(getObstacleRule(50, true)).toEqual(TOUCH_OBSTACLE_RULES.opening);
    expect(getObstacleRule(120, true)).toEqual(TOUCH_OBSTACLE_RULES.mid);
    expect(getObstacleRule(600, true)).toEqual(TOUCH_OBSTACLE_RULES.late);
  });

  it('rolls desktop thresholds on the new bands', () => {
    // Opening band: 70% chance, 30% of obstacle rows use one lane.
    expect(resolveObstacleSpawn(50, false, sequence(0.69, 0.29))).toEqual({
      isObstacleSegment: true,
      laneCount: 1,
    });
    expect(resolveObstacleSpawn(50, false, sequence(0.69, 0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });
    expect(resolveObstacleSpawn(50, false, sequence(0.7))).toEqual({
      isObstacleSegment: false,
      laneCount: 0,
    });

    // Mid band: 90% chance, same 30/70 single/double lane split.
    expect(resolveObstacleSpawn(100, false, sequence(0.89, 0.29))).toEqual({
      isObstacleSegment: true,
      laneCount: 1,
    });
    expect(resolveObstacleSpawn(100, false, sequence(0.89, 0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });
    expect(resolveObstacleSpawn(100, false, sequence(0.9))).toEqual({
      isObstacleSegment: false,
      laneCount: 0,
    });

    // Late band: every row blocks one or two lanes.
    expect(resolveObstacleSpawn(300, false, sequence(0.29))).toEqual({
      isObstacleSegment: true,
      laneCount: 1,
    });
    expect(resolveObstacleSpawn(300, false, sequence(0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });
  });

  it('rolls touch thresholds on the same lane split', () => {
    expect(resolveObstacleSpawn(50, true, sequence(0.54, 0.29))).toEqual({
      isObstacleSegment: true,
      laneCount: 1,
    });
    expect(resolveObstacleSpawn(50, true, sequence(0.54, 0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });
    expect(resolveObstacleSpawn(50, true, sequence(0.55))).toEqual({
      isObstacleSegment: false,
      laneCount: 0,
    });

    expect(resolveObstacleSpawn(150, true, sequence(0.79, 0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });

    expect(resolveObstacleSpawn(300, true, sequence(0.29))).toEqual({
      isObstacleSegment: true,
      laneCount: 1,
    });
    expect(resolveObstacleSpawn(300, true, sequence(0.3))).toEqual({
      isObstacleSegment: true,
      laneCount: 2,
    });
  });

  it('never occupies all three lanes in either mode', () => {
    const rand = mulberry32(7);
    let maxLanes = 0;
    for (let i = 0; i < 20_000; i++) {
      const distance = rand() * 900;
      for (const touch of [false, true]) {
        maxLanes = Math.max(maxLanes, resolveObstacleSpawn(distance, touch, rand).laneCount);
      }
    }
    expect(maxLanes).toBe(2);
  });
});

describe('obstacle density distributions', () => {
  it('desktop keeps roughly 70/90/100 percent obstacle coverage', () => {
    const rand = mulberry32(11);
    const bands = [
      { distance: 50, chance: 0.7 },
      { distance: 150, chance: 0.9 },
      { distance: 400, chance: 1 },
    ];
    for (const band of bands) {
      let obstacles = 0;
      const trials = 20_000;
      for (let i = 0; i < trials; i++) {
        if (resolveObstacleSpawn(band.distance, false, rand).isObstacleSegment) obstacles++;
      }
      expect(obstacles / trials).toBeCloseTo(band.chance, 1);
    }
  });

  it('touch keeps coverage at roughly 55/80/100 percent', () => {
    const rand = mulberry32(13);
    const bands = [
      { distance: 50, chance: 0.55 },
      { distance: 150, chance: 0.8 },
      { distance: 400, chance: 1 },
    ];
    for (const band of bands) {
      let obstacles = 0;
      const trials = 20_000;
      for (let i = 0; i < trials; i++) {
        if (resolveObstacleSpawn(band.distance, true, rand).isObstacleSegment) obstacles++;
      }
      expect(obstacles / trials).toBeCloseTo(band.chance, 1);
    }
  });

  it('uses two lanes on about seven obstacle rows in ten', () => {
    for (const touch of [false, true]) {
      const rand = mulberry32(touch ? 17 : 19);
      let obstacleSegments = 0;
      let doubleLaneSegments = 0;
      for (let i = 0; i < 60_000; i++) {
        const decision = resolveObstacleSpawn(400, touch, rand);
        if (!decision.isObstacleSegment) continue;
        obstacleSegments++;
        if (decision.laneCount === 2) doubleLaneSegments++;
      }
      expect(doubleLaneSegments / obstacleSegments).toBeCloseTo(0.7, 1);
    }
  });
});

describe('time-based spawn cadence', () => {
  const CAP_SPEED = 9.0; // base 5.2 + the 3.8 speed cap

  it('reproduces the old 300-360 unit gap at the starting speed', () => {
    expect(getRowGapUnits(BASE_RUN_SPEED, () => 0)).toBeCloseTo(300, 5);
    expect(getRowGapUnits(BASE_RUN_SPEED, () => 0.999999)).toBeCloseTo(360, 3);
  });

  it('widens the gap with speed so rows keep arriving about a second apart', () => {
    for (const speed of [BASE_RUN_SPEED, 6.7, 8.0, CAP_SPEED]) {
      const secondsPerRow = getRowGapUnits(speed, () => 0) / (speed * 60);
      expect(secondsPerRow).toBeCloseTo(ROW_INTERVAL_MIN_SECONDS, 6);
      expect(secondsPerRow).toBeGreaterThanOrEqual(0.96);
      expect(secondsPerRow).toBeLessThanOrEqual(1.15);
    }

    // At the cap the gap is 1.45x wider in world units, not 1.45x shorter in time.
    expect(getRowGapUnits(CAP_SPEED, () => 0)).toBeCloseTo(519.23, 2);
    expect(getRowGapUnits(CAP_SPEED, () => 0.999999)).toBeCloseTo(623.08, 2);
  });

  it('keeps the warning window constant as the runner speeds up', () => {
    expect(getSpawnLookaheadUnits(BASE_RUN_SPEED) / (BASE_RUN_SPEED * 60)).toBeCloseTo(
      SPAWN_LOOKAHEAD_SECONDS,
      6
    );
    expect(getSpawnLookaheadUnits(CAP_SPEED) / (CAP_SPEED * 60)).toBeCloseTo(
      SPAWN_LOOKAHEAD_SECONDS,
      6
    );
    // 700 units at 312 units/s becomes ~1,211.5 units at 540 units/s.
    expect(getSpawnLookaheadUnits(BASE_RUN_SPEED)).toBeCloseTo(700, 5);
    expect(getSpawnLookaheadUnits(CAP_SPEED)).toBeCloseTo(1211.54, 2);
  });

  it('falls back to the starting speed for nonsense input', () => {
    for (const speed of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(getRowGapUnits(speed, () => 0)).toBeCloseTo(300, 5);
      expect(getSpawnLookaheadUnits(speed)).toBeCloseTo(700, 5);
    }
  });

  it('uses the jitter window exactly once per call', () => {
    let calls = 0;
    const rand = () => {
      calls++;
      return 0.5;
    };
    getRowGapUnits(BASE_RUN_SPEED, rand);
    expect(calls).toBe(1);
    expect(ROW_INTERVAL_JITTER_SECONDS).toBeCloseTo(0.19, 2);
  });
});

describe('reachable corridor', () => {
  it('never moves the open lane more than one lane between segments', () => {
    const rand = mulberry32(23);
    let previous: number | null = null;
    let outOfRangeFreeLane = 0;
    let wrongBlockerCount = 0;
    let blockedFreeLane = 0;
    let unreachableJump = 0;

    for (let i = 0; i < 10_000; i++) {
      const laneCount = rand() < 0.7 ? 1 : 2;
      const corridor = resolveCorridorSpawn(previous, laneCount, rand);

      if (corridor.freeLane < 0 || corridor.freeLane > 2) outOfRangeFreeLane++;
      if (corridor.occupiedLanes.length !== laneCount) wrongBlockerCount++;
      if (corridor.occupiedLanes.includes(corridor.freeLane)) blockedFreeLane++;
      if (previous !== null && Math.abs(corridor.freeLane - previous) > 1) unreachableJump++;

      previous = corridor.freeLane;
    }

    expect(outOfRangeFreeLane).toBe(0);
    expect(wrongBlockerCount).toBe(0);
    expect(blockedFreeLane).toBe(0);
    expect(unreachableJump).toBe(0);
  });

  it('always leaves a lane open, even for a two-lane block', () => {
    const rand = mulberry32(29);
    let overlappingLanes = 0;
    let wrongCount = 0;

    for (let i = 0; i < 5_000; i++) {
      const corridor = resolveCorridorSpawn(i % 3, 2, rand);
      if (new Set(corridor.occupiedLanes).size !== 2) overlappingLanes++;
      if (corridor.occupiedLanes.length !== 2) wrongCount++;
      if (corridor.occupiedLanes.includes(corridor.freeLane)) wrongCount++;
    }

    expect(overlappingLanes).toBe(0);
    expect(wrongCount).toBe(0);
  });
});
