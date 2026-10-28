// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/game/ThreeGameRenderer.ts', () => {
  class RendererStub {
    setCharacterFocus() {}
    setSkin() {}
    setMap() {}
    resize() {}
    render() {}
    destroy() {}
    resetCamera() {}
    resetTrack() {}
    setReducedMotion() {}
    setShakeEnabled() {}
    triggerHitFreeze() {}
    triggerShake() {}
  }
  return { ThreeGameRenderer: RendererStub };
});

import { GameEngine } from '../src/game/GameEngine.ts';
import { ROAD_LANES } from '../src/game/constants.ts';
import type { Bystander } from '../src/game/types.ts';

type Tickable = { update(dtFactor: number): void };

function walker(x: number, y: number, walkSpeed: number): Bystander {
  return {
    id: 1,
    x,
    y,
    type: 'fruitseller',
    name: 'Walker',
    points: 50,
    bodyColor: '#000',
    shirtColor: '#fff',
    accessory: 'hat',
    slapped: false,
    wobble: 0,
    walking: walkSpeed !== 0,
    walkSpeed,
    walkPhase: 0,
  };
}

function setup(lane: number, bystanderX: number, walkSpeed: number, walkerAhead = 260, startY = 100) {
  const canvas = document.createElement('canvas');
  const engine = new GameEngine(canvas, () => {}, () => {});
  engine.startGame();
  engine.introState.active = false;
  engine.tutorialState.active = false;
  engine.obstacles = [];
  engine.powerups = [];
  engine.bystanders = [];
  const p = engine.player;
  p.x = ROAD_LANES[lane];
  p.prevX = p.x;
  p.y = startY;
  p.prevY = startY;
  p.z = 0;
  p.vz = 0;
  p.stamina = 100;
  engine.currentLaneIndex = lane;
  engine.stats.distanceRun = Math.floor(startY / 10);
  // Jumping the runner to a later distance must not make the generator backfill
  // the skipped stretch around the player; park it ahead of the test walker.
  (engine as unknown as { nextSpawnY: number }).nextSpawnY = startY + 1_500;

  const target = walker(bystanderX, p.y + walkerAhead, walkSpeed);
  engine.bystanders = [target];
  return { engine, p, target };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

describe('whip reach', () => {
  it('lands on every frame the target is highlighted, for walkers on both curbs', () => {
    // Center lane reaches the far curb (dx ≈ 159); right lane reaches the near
    // one (dx ≈ 69). Both directions of sidewalk traffic are covered, because a
    // walker drifting toward the runner used to have the shortest window.
    // Hugging a curb must also whip the opposite sidewalk: x = ±163 against
    // lane ±90 is 253 across, and at the front of the cue it is ~277 away.
    // dt = 2 is a 30 fps phone step: the same real-time window is only half as
    // many frames, and each frame covers twice the ground.
    const cases: Array<[number, number, number, number, number]> = [
      [1, 159, -0.6, 100, 1],
      [1, 159, 0, 100, 1],
      [1, 159, 0.6, 100, 1],
      [2, 159, -0.6, 100, 1],
      [2, 159, 0, 100, 1],
      [2, 159, 0.6, 100, 1],
      [0, 163, -0.6, 100, 1],
      [2, -163, 0.6, 100, 1],
      [0, 163, -0.6, 7_500, 1],
      [2, -163, 0.6, 7_500, 1],
      [0, 163, 0.6, 7_500, 2],
      [2, -163, -0.6, 7_500, 2],
      // Where the screenshot was taken (~740 m), the runner is twice as fast
      // and the strike window is half as long. Both curbs must still work.
      [1, 163, -0.6, 7_500, 1],
      [2, 163, 0.6, 7_500, 1],
      [1, 163, -0.6, 7_500, 2],
      [2, 163, 0.6, 7_500, 2],
    ];

    for (const [lane, x, speed, startY, dt] of cases) {
      let cueFrames = 0;
      let whiffs = 0;
      for (let frame = 0; frame < 70; frame++) {
        const { engine, target } = setup(lane, x, speed, 260, startY);
        const state = engine as unknown as Tickable;
        for (let i = 0; i < frame; i++) state.update(dt);
        if (!target.inStrikeRange) continue;
        cueFrames++;
        engine.requestSlap();
        state.update(dt);
        if (!target.slapped) whiffs++;
      }
      expect(cueFrames, `cue at ${startY}, dt ${dt}`).toBeGreaterThan(12 / dt);
      expect(whiffs, `lane ${lane}, x ${x}, walk ${speed}, y ${startY}, dt ${dt}`).toBe(0);
    }
  });

  it('queues a whip pressed during cooldown instead of swallowing it', () => {
    const { engine, p } = setup(1, 159, -0.6, 40);
    // Two targets in reach, and a stationary runner so both stay in range.
    p.baseSpeed = 0;
    engine.bystanders.push({
      ...walker(-159, p.y + 55, 0),
      id: 2,
    });
    const state = engine as unknown as Tickable;
    const [first, second] = engine.bystanders;

    engine.requestSlap();
    state.update(1);
    expect(first.slapped).toBe(true);

    // The second tap arrives while the 18-frame whip cooldown is still running.
    engine.requestSlap();
    for (let i = 0; i < 20; i++) state.update(1);

    expect(second.slapped).toBe(true);
  });
});
