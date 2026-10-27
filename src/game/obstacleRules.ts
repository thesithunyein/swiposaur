import type { ObstacleType } from './types.ts';

/**
 * Physical obstacle rules, in the same game units as `player.z`.
 *
 * A jump peaks at JUMP_APEX. Low street clutter can be cleared when the dino's
 * feet are above its top; solid props are taller than a jump and must be dodged
 * sideways. Ramps are not hazards at all: they launch a grounded runner, and
 * their higher arc can carry you over a solid prop that a jump could not clear.
 */
export type ObstacleKind = 'low' | 'solid' | 'ramp';

export const GRAVITY = 0.42;
/** Peak height of a normal jump, in game units (raised from the original 34). */
export const JUMP_APEX = 44;
/**
 * A jump only clears a prop while the feet are above its top. Low props cap at
 * 24, which leaves a generous window above them at every speed.
 */
export const MIN_JUMP_MARGIN = 20;
export const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_APEX);
/** Boost pads fly higher than a jump, but only from the ground. */
export const RAMP_VELOCITY = 7.8;
export const TERMINAL_RAMP_VELOCITY = 8.2;
interface ObstacleRule {
  kind: ObstacleKind;
  /** Feet height needed to pass over it, in game units. */
  clearance: number;
}

/**
 * Curated from the actual meshes. Low = ankle-to-waist clutter the dino can
 * visibly hop; solid = carts, blocks, gates and racks that read as walls.
 */
export const OBSTACLE_RULES: Record<ObstacleType, ObstacleRule> = {
  // Ramps
  ramp: { kind: 'ramp', clearance: 0 },
  terminal_ramp: { kind: 'ramp', clearance: 0 },

  // Low, jumpable street clutter. Tops stay at or below JUMP_APEX - MIN_JUMP_MARGIN
  // so hopping one is a timing decision, not a frame-perfect trick.
  spikes: { kind: 'low', clearance: 18 },
  bug: { kind: 'low', clearance: 10 },
  watermelon: { kind: 'low', clearance: 12 },
  beach_lounger: { kind: 'low', clearance: 14 },
  hydrant: { kind: 'low', clearance: 16 },
  planter: { kind: 'low', clearance: 18 },
  timber_sled: { kind: 'low', clearance: 18 },
  cafe_table: { kind: 'low', clearance: 20 },
  barrier: { kind: 'low', clearance: 22 },
  snow_bale: { kind: 'low', clearance: 22 },
  dino_skull: { kind: 'low', clearance: 22 },
  barrel: { kind: 'low', clearance: 22 },
  loop_boulder: { kind: 'low', clearance: 22 },
  crate: { kind: 'low', clearance: 22 },
  coconut_crate: { kind: 'low', clearance: 22 },
  ice_spikes: { kind: 'low', clearance: 22 },
  firewall: { kind: 'low', clearance: 24 },

  // Solid props: dodge, never jump. Their tops sit above JUMP_APEX but below a
  // boost-ramp arc, so a ramp rewards clearing them while a jump does not.
  zen_barrier: { kind: 'solid', clearance: 46 },
  canyon_mesa: { kind: 'solid', clearance: 48 },
  shifting_block: { kind: 'solid', clearance: 48 },
  drone_hazard: { kind: 'solid', clearance: 50 },
  cactus_cluster: { kind: 'solid', clearance: 52 },
  stone_lantern: { kind: 'solid', clearance: 52 },
  cart: { kind: 'solid', clearance: 54 },
  surf_rack: { kind: 'solid', clearance: 54 },
  holo_barrier: { kind: 'solid', clearance: 54 },
  cyber_server: { kind: 'solid', clearance: 54 },
  cherry_wagon: { kind: 'solid', clearance: 54 },
  tiki_totem: { kind: 'solid', clearance: 60 },
  torii_gate: { kind: 'solid', clearance: 68 },
};

export const OBSTACLE_TYPES = Object.keys(OBSTACLE_RULES) as ObstacleType[];

export function getObstacleKind(type: ObstacleType): ObstacleKind {
  return OBSTACLE_RULES[type].kind;
}

export function getObstacleClearance(type: ObstacleType): number {
  return OBSTACLE_RULES[type].clearance;
}

/** True when the dino's feet are above the prop's top. Ramps never block. */
export function canClearObstacle(type: ObstacleType, feetZ: number): boolean {
  const rule = OBSTACLE_RULES[type];
  if (rule.kind === 'ramp') return false;
  return feetZ >= rule.clearance;
}

export function isRampType(type: ObstacleType): boolean {
  return OBSTACLE_RULES[type].kind === 'ramp';
}

/**
 * A ramp launches only a grounded runner moving into it. Without this check a
 * ramp touched mid-jump re-launched the dino and made it hang in the air.
 */
export function canLaunchFromRamp(feetZ: number, verticalSpeed: number): boolean {
  return feetZ <= 2 && verticalSpeed <= 2;
}
