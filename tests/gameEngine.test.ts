// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { isRampType } from '../src/game/obstacleRules.ts';

function setTouchEnvironment(touch: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: touch,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touch ? 5 : 0 });
  if (touch) {
    (window as unknown as Record<string, unknown>).ontouchstart = null;
  } else {
    delete (window as unknown as Record<string, unknown>).ontouchstart;
  }
}

function makeEngine() {
  const canvas = document.createElement('canvas');
  return new GameEngine(canvas, () => {}, () => {});
}

/** Spawn segments at a fixed distance and report how many contain obstacles. */
function sampleSegments(engine: GameEngine, distance: number, trials: number) {
  engine.stats.distanceRun = distance;
  let obstacleSegments = 0;
  let doubleLaneSegments = 0;
  for (let i = 0; i < trials; i++) {
    engine.obstacles = [];
    (engine as unknown as { spawnMarketSegment(y: number): void }).spawnMarketSegment(400 + i * 180);
    // A boost ramp in the open lane is not a blocker, so it must not count here.
    const blockers = engine.obstacles.filter((obstacle) => !isRampType(obstacle.type));
    if (blockers.length > 0) obstacleSegments++;
    if (blockers.length === 2) doubleLaneSegments++;
  }
  return { obstacleRate: obstacleSegments / trials, doubleLaneShare: doubleLaneSegments / Math.max(1, obstacleSegments) };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GameEngine touch mode', () => {
  it('freezes touch detection once at construction', () => {
    setTouchEnvironment(true);
    const touchEngine = makeEngine();
    expect(touchEngine.touchInputMode).toBe(true);

    // Flipping the device after construction must not change the run's tuning.
    setTouchEnvironment(false);
    expect(touchEngine.touchInputMode).toBe(true);

    const desktopEngine = makeEngine();
    expect(desktopEngine.touchInputMode).toBe(false);
  });

  it('uses the reduced touch obstacle rules', () => {
    setTouchEnvironment(true);
    const engine = makeEngine();
    const opening = sampleSegments(engine, 50, 2500);
    const late = sampleSegments(engine, 400, 2500);

    expect(opening.obstacleRate).toBeGreaterThan(0.36);
    expect(opening.obstacleRate).toBeLessThan(0.48);
    expect(late.obstacleRate).toBeGreaterThan(0.56);
    expect(late.obstacleRate).toBeLessThan(0.68);
    expect(late.doubleLaneShare).toBeGreaterThan(0.05);
    expect(late.doubleLaneShare).toBeLessThan(0.15);
  });

  it('keeps the original desktop obstacle rules', () => {
    setTouchEnvironment(false);
    const engine = makeEngine();
    const opening = sampleSegments(engine, 50, 2500);
    const late = sampleSegments(engine, 400, 2500);

    expect(opening.obstacleRate).toBeGreaterThan(0.49);
    expect(opening.obstacleRate).toBeLessThan(0.61);
    expect(late.obstacleRate).toBeGreaterThan(0.69);
    expect(late.obstacleRate).toBeLessThan(0.81);
    // Desktop late game still uses two-lane blocks more often than touch.
    expect(late.doubleLaneShare).toBeGreaterThan(0.22);
    expect(late.doubleLaneShare).toBeLessThan(0.38);
  });
});

describe('jump and ramp physics', () => {
  function setup(): GameEngine {
    const engine = makeEngine();
    engine.startGame();
    engine.introState.active = false;
    engine.obstacles = [];
    const p = engine.player;
    p.x = 0;
    p.prevX = 0;
    p.y = 100;
    p.prevY = 100;
    p.z = 0;
    p.vz = 0;
    p.stamina = 100;
    p.invulnerableTimer = 0;
    engine.stats.distanceRun = 100;
    return engine;
  }

  function touchObstacle(engine: GameEngine, type: 'crate' | 'cart' | 'ramp', z: number) {
    const p = engine.player;
    p.z = z;
    p.vz = 0;
    p.stamina = 100;
    p.invulnerableTimer = 0;
    engine.obstacles = [
      {
        id: 1,
        x: 0,
        y: p.y + 12,
        type,
        width: 46,
        height: 34,
        hit: false,
        rollSpeed: 0,
        vx: 0,
        isShifting: false,
        shiftMinX: -100,
        shiftMaxX: 100,
      },
    ];
    (engine as unknown as { update(dtFactor: number): void }).update(1);
    return engine;
  }

  it('lets a jump clear a crate at the top of the arc', () => {
    const engine = touchObstacle(setup(), 'crate', 34);
    expect(engine.player.stamina).toBe(100);
    expect(engine.obstacles[0].hit).toBe(false);
  });

  it('does not let the same jump clear a solid cart', () => {
    const engine = touchObstacle(setup(), 'cart', 34);
    expect(engine.player.stamina).toBe(55);
    expect(engine.obstacles[0].hit).toBe(true);
  });

  it('does not re-launch from a ramp in mid-air', () => {
    const engine = touchObstacle(setup(), 'ramp', 30);
    expect(engine.player.vz).toBeLessThanOrEqual(0);
    expect(engine.player.stamina).toBe(100);
    expect(engine.obstacles[0].hit).toBe(false);
  });

  it('launches from a ramp when grounded', () => {
    const engine = touchObstacle(setup(), 'ramp', 0);
    expect(engine.player.vz).toBeGreaterThan(5);
    expect(engine.obstacles[0].hit).toBe(true);
  });

  /**
   * Jumping is only fair if the timing window is wider than a frame. This runs
   * the real update loop at cruising speed and checks how many take-off
   * distances actually carry the dino over a crate.
   */
  it('gives a real timing window to hop a crate at cruising speed', () => {
    const clearLeads: number[] = [];
    for (let lead = 40; lead <= 170; lead += 2) {
      const engine = setup();
      const p = engine.player;
      const crate = {
        id: 1,
        x: 0,
        y: p.y + lead,
        type: 'crate' as const,
        width: 46,
        height: 34,
        hit: false,
        rollSpeed: 0,
        vx: 0,
        isShifting: false,
        shiftMinX: -100,
        shiftMaxX: 100,
      };
      engine.requestJump();
      for (let frame = 0; frame < 60; frame++) {
        engine.obstacles = [crate];
        (engine as unknown as { update(dtFactor: number): void }).update(1);
      }
      if (p.stamina === 100 && !crate.hit) clearLeads.push(lead);
    }

    // A 2-unit step of take-off distance is roughly one frame of input timing.
    expect(clearLeads.length).toBeGreaterThanOrEqual(6);
  });
});

describe('spawn cadence at speed', () => {
  it('uses a wider world gap at the speed cap so rows still arrive about a second apart', () => {
    const engine = makeEngine();
    engine.startGame();
    engine.introState.active = false;

    const p = engine.player;
    p.y = 13_000; // past the 1,267 m speed cap
    p.prevY = p.y;
    p.z = 0;
    p.vz = 0;
    p.stamina = 100;

    const before = (engine as unknown as { nextSpawnY: number }).nextSpawnY;
    (engine as unknown as { update(dtFactor: number): void }).update(1);
    const after = (engine as unknown as { nextSpawnY: number }).nextSpawnY;

    expect(p.speed).toBeCloseTo(9, 5);

    const gap = after - before;
    expect(gap).toBeGreaterThan(500);
    expect(gap).toBeLessThan(630);
    expect(gap / (p.speed * 60)).toBeGreaterThanOrEqual(0.95);
    expect(gap / (p.speed * 60)).toBeLessThanOrEqual(1.16);
  });

  it('spawns rows earlier at the cap, so the warning window does not collapse', () => {
    const engine = makeEngine();
    engine.startGame();
    engine.introState.active = false;

    const p = engine.player;
    p.y = 13_000;
    p.prevY = p.y;
    p.z = 0;
    p.vz = 0;
    p.stamina = 100;

    // 900 units ahead is inside today's 1,212-unit lookahead at the cap, but was
    // outside the old fixed 700, which is exactly the regression this guards.
    const state = engine as unknown as { nextSpawnY: number; update(dtFactor: number): void };
    state.nextSpawnY = p.y + 900;
    state.update(1);

    expect(state.nextSpawnY).toBeGreaterThan(p.y + 900);
  });
});

describe('personal best banner', () => {
  it('does not flag a score that only ties the previous best', () => {
    const engine = makeEngine();
    engine.stats.highScore = 1000;
    engine.startGame();
    engine.stats.score = 1000;
    (engine as unknown as { triggerGameOver(reason: string): void }).triggerGameOver('BUSTED');

    expect(engine.stats.highScore).toBe(1000);
    expect(engine.stats.isNewPersonalBest).toBe(false);
  });

  it('flags a strictly higher score', () => {
    const engine = makeEngine();
    engine.stats.highScore = 1000;
    engine.startGame();
    engine.stats.score = 1001;
    (engine as unknown as { triggerGameOver(reason: string): void }).triggerGameOver('BUSTED');

    expect(engine.stats.highScore).toBe(1001);
    expect(engine.stats.isNewPersonalBest).toBe(true);
  });
});

describe('stamina boost', () => {
  it('applies the banked boost to one run only', () => {
    const engine = makeEngine();
    engine.staminaBonus = 20;
    engine.startGame();

    expect(engine.stats.maxStamina).toBe(120);
    expect(engine.stats.stamina).toBe(120);
    expect(engine.player.stamina).toBe(120);

    // The next run starts plain unless another boost is banked.
    engine.startGame();
    expect(engine.stats.maxStamina).toBe(100);
    expect(engine.stats.stamina).toBe(100);
  });
});
