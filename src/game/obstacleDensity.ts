/**
 * Obstacle density by distance band.
 *
 * Every obstacle row now blocks two of the three lanes, leaving exactly one
 * clear escape lane. Rows are still spaced in time rather than world units, so
 * the warning window stays the same at every speed.
 *
 * Variety comes from the blocked-lane count: roughly seven rows in ten fill two
 * lanes and three in ten fill only one. A row is never allowed to fill all three
 * lanes, so a clean route always exists.
 *
 * The opening band is slightly gentler while the player reads the first rows;
 * after 80 m the street is relentless. Obstacle type still depends on the biome.
 */
export interface ObstacleRule {
  /** Chance that a segment contains any obstacle at all. */
  chance: number;
  /** Share of obstacle rows that occupy a single lane (the rest use two). */
  oneLaneShare: number;
}

export interface ObstacleDensityTable {
  opening: ObstacleRule; // 15m - 80m
  mid: ObstacleRule; // 80m - 250m
  late: ObstacleRule; // 250m+
}

/** 30% single-lane, 70% two-lane: the requested 3/10 and 7/10 split. */
const ONE_LANE_SHARE = 0.3;

/** Desktop: the full requested density. */
export const DESKTOP_OBSTACLE_RULES: ObstacleDensityTable = {
  opening: { chance: 0.7, oneLaneShare: ONE_LANE_SHARE },
  mid: { chance: 0.9, oneLaneShare: ONE_LANE_SHARE },
  late: { chance: 1, oneLaneShare: ONE_LANE_SHARE },
};

/**
 * Touch keeps the same two-lane / one-lane split but a slightly softer chance of
 * a row in the opening band, because a swipe needs a moment to read the lane.
 */
export const TOUCH_OBSTACLE_RULES: ObstacleDensityTable = {
  opening: { chance: 0.55, oneLaneShare: ONE_LANE_SHARE },
  mid: { chance: 0.8, oneLaneShare: ONE_LANE_SHARE },
  late: { chance: 1, oneLaneShare: ONE_LANE_SHARE },
};

export interface ObstacleSpawnDecision {
  isObstacleSegment: boolean;
  /** 0 when the segment is empty, otherwise 1 or 2 (a 3-lane road keeps one open). */
  laneCount: number;
}

/**
 * Spawn rhythm, measured in seconds instead of world units.
 *
 * The runner accelerates from 5.2 to 9.0 units per frame over a run. When rows
 * were spaced by a flat 300-360 world units, that same gap covered 0.96 s at the
 * start but only 0.56 s at the speed cap, so speed, density and a shrinking
 * warning window all stacked on one dial. Converting through the current speed
 * keeps the cadence and the warning window constant, and leaves density as the
 * only distance-based difficulty knob.
 */
export const BASE_RUN_SPEED = 5.2; // units per 60 Hz frame (312 units/s)
const UNITS_PER_SECOND_AT_BASE = BASE_RUN_SPEED * 60;

/** Seconds between obstacle rows: the old 300-360 units at the starting speed. */
export const ROW_INTERVAL_MIN_SECONDS = 300 / UNITS_PER_SECOND_AT_BASE; // 0.96 s
export const ROW_INTERVAL_JITTER_SECONDS = 60 / UNITS_PER_SECOND_AT_BASE; // 0.19 s

/** Seconds of road a row stays visible before it reaches the player (700 units at start). */
export const SPAWN_LOOKAHEAD_SECONDS = 700 / UNITS_PER_SECOND_AT_BASE; // 2.24 s

function unitsPerSecond(speed: number): number {
  const safe = Number.isFinite(speed) && speed > 0 ? speed : BASE_RUN_SPEED;
  return safe * 60;
}

/**
 * World-unit gap before the next obstacle row.
 *
 * `speed` is the player's per-frame speed, `rand` is injected for deterministic
 * tests. At the starting speed this reproduces the previous 300-360 units; at the
 * 9.0 cap it widens to roughly 518-622 units so the row still arrives ~1 s later.
 */
export function getRowGapUnits(speed: number, rand: () => number = Math.random): number {
  return unitsPerSecond(speed) * (ROW_INTERVAL_MIN_SECONDS + rand() * ROW_INTERVAL_JITTER_SECONDS);
}

/**
 * How far ahead a row is spawned, in world units, so it stays visible for the
 * same number of seconds no matter how fast the runner is going.
 */
export function getSpawnLookaheadUnits(speed: number): number {
  return unitsPerSecond(speed) * SPAWN_LOOKAHEAD_SECONDS;
}

export function getObstacleRule(distance: number, touchInput: boolean): ObstacleRule | null {
  // Safe start: the first 40m never spawn obstacles in either mode.
  if (!Number.isFinite(distance) || distance <= 40) return null;
  const table = touchInput ? TOUCH_OBSTACLE_RULES : DESKTOP_OBSTACLE_RULES;
  if (distance <= 80) return table.opening;
  if (distance <= 250) return table.mid;
  return table.late;
}

/**
 * Picks the obstacle layout for one market segment.
 *
 * `rand` is injected so the calls are testable and the engine keeps using
 * Math.random in production.
 */
export function resolveObstacleSpawn(
  distance: number,
  touchInput: boolean,
  rand: () => number = Math.random
): ObstacleSpawnDecision {
  const rule = getObstacleRule(distance, touchInput);
  if (!rule) return { isObstacleSegment: false, laneCount: 0 };

  if (rand() >= rule.chance) return { isObstacleSegment: false, laneCount: 0 };

  // Never occupy more than 2 of the 3 lanes: at least one escape route always
  // stays open. The 70/30 split lives in oneLaneShare.
  const laneCount = rand() < rule.oneLaneShare ? 1 : 2;
  return { isObstacleSegment: true, laneCount };
}

export interface CorridorSpawnDecision {
  /** Lane index (0..laneTotal-1) that stays open. */
  freeLane: number;
  /** Lane indices that carry blockers, never including `freeLane`. */
  occupiedLanes: number[];
}

/**
 * Places blockers so the open lane is never more than one lane away from the
 * previous segment's open lane. With a 2-lane block that still leaves a route
 * the player can physically reach in one move.
 *
 * `rand` is injected so the corridor can be simulated deterministically.
 */
export function resolveCorridorSpawn(
  previousFreeLane: number | null,
  laneCount: number,
  rand: () => number = Math.random,
  laneTotal: number = 3
): CorridorSpawnDecision {
  const total = Math.max(1, Math.floor(laneTotal));
  const previous =
    previousFreeLane === null
      ? Math.min(total - 1, Math.floor(rand() * total))
      : Math.min(total - 1, Math.max(0, Math.floor(previousFreeLane)));

  // Keep the escape route within one lane of where it was, so it is reachable
  // without a two-lane dash between segments.
  const minFree = Math.max(0, previous - 1);
  const maxFree = Math.min(total - 1, previous + 1);
  const freeLane = Math.min(maxFree, minFree + Math.floor(rand() * (maxFree - minFree + 1)));

  const pool: number[] = [];
  for (let lane = 0; lane < total; lane++) {
    if (lane !== freeLane) pool.push(lane);
  }

  const occupiedLanes: number[] = [];
  const count = Math.min(Math.max(0, Math.floor(laneCount)), pool.length);
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(rand() * pool.length);
    occupiedLanes.push(pool.splice(pick, 1)[0]);
  }

  return { freeLane, occupiedLanes };
}
