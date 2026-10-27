import { describe, expect, it } from 'vitest';
import {
  GRAVITY,
  JUMP_APEX,
  JUMP_VELOCITY,
  MIN_JUMP_MARGIN,
  OBSTACLE_TYPES,
  canClearObstacle,
  canLaunchFromRamp,
  getObstacleClearance,
  getObstacleKind,
  isRampType,
} from '../src/game/obstacleRules.ts';

describe('obstacle height rules', () => {
  it('derives the jump apex from the shipped velocity and gravity', () => {
    expect((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY)).toBeCloseTo(JUMP_APEX, 6);
  });

  it('gives every shipped obstacle an explicit rule', () => {
    expect(OBSTACLE_TYPES.length).toBeGreaterThan(20);
    for (const type of OBSTACLE_TYPES) {
      expect(['low', 'solid', 'ramp']).toContain(getObstacleKind(type));
      expect(getObstacleClearance(type)).toBeGreaterThanOrEqual(0);
    }
  });

  it('clears low clutter only when the feet are above its top', () => {
    expect(canClearObstacle('crate', getObstacleClearance('crate') - 1)).toBe(false);
    expect(canClearObstacle('crate', getObstacleClearance('crate'))).toBe(true);
    expect(canClearObstacle('barrier', 22)).toBe(true);
    expect(canClearObstacle('barrier', 21)).toBe(false);
    // A boost arc is higher than a jump, so it can clear a cart roof.
    expect(canClearObstacle('cart', 60)).toBe(true);
    expect(canClearObstacle('cart', 48)).toBe(false);
  });

  it('keeps every jumpable prop far enough below the jump arc to time', () => {
    for (const type of OBSTACLE_TYPES.filter((candidate) => getObstacleKind(candidate) === 'low')) {
      // Height above the prop, in game units. Converted to frames of airtime this
      // is the usable input window; a prop near the apex would only be clearable
      // for a frame or two at running speed.
      expect(JUMP_APEX - getObstacleClearance(type)).toBeGreaterThanOrEqual(MIN_JUMP_MARGIN);
    }
  });

  it('never lets a jump clear a solid prop', () => {
    const solids = OBSTACLE_TYPES.filter((type) => getObstacleKind(type) === 'solid');
    expect(solids).toContain('cart');
    expect(solids).toContain('shifting_block');
    for (const type of solids) {
      expect(canClearObstacle(type, JUMP_APEX)).toBe(false);
      expect(getObstacleClearance(type)).toBeGreaterThan(JUMP_APEX);
      // The top is finite: a higher boost arc can still carry you over it.
      expect(canClearObstacle(type, 100)).toBe(true);
    }
  });

  it('does not treat ramps as obstacles to clear', () => {
    expect(isRampType('ramp')).toBe(true);
    expect(isRampType('terminal_ramp')).toBe(true);
    expect(isRampType('barrier')).toBe(false);
    expect(canClearObstacle('ramp', 100)).toBe(false);
  });

  it('launches from a ramp only while grounded', () => {
    expect(canLaunchFromRamp(0, 0)).toBe(true);
    expect(canLaunchFromRamp(2, 2)).toBe(true);
    expect(canLaunchFromRamp(2.1, 0)).toBe(false);
    expect(canLaunchFromRamp(0, 2.1)).toBe(false);
    expect(canLaunchFromRamp(20, -4)).toBe(false);
  });
});
