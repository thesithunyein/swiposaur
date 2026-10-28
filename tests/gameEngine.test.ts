// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/game/ThreeGameRenderer.ts', () => {
  class RendererStub {
    setTouchLayout() {}
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

  it('uses the two-lane touch rules', () => {
    setTouchEnvironment(true);
    const engine = makeEngine();
    const opening = sampleSegments(engine, 50, 2500);
    const late = sampleSegments(engine, 400, 2500);

    expect(opening.obstacleRate).toBeGreaterThan(0.49);
    expect(opening.obstacleRate).toBeLessThan(0.61);
    expect(late.obstacleRate).toBeGreaterThan(0.97);
    // Roughly seven rows in ten fill two lanes.
    expect(late.doubleLaneShare).toBeGreaterThan(0.64);
    expect(late.doubleLaneShare).toBeLessThan(0.76);
  });

  it('uses the same two-lane split on desktop with denser rows', () => {
    setTouchEnvironment(false);
    const engine = makeEngine();
    const opening = sampleSegments(engine, 50, 2500);
    const late = sampleSegments(engine, 400, 2500);

    expect(opening.obstacleRate).toBeGreaterThan(0.64);
    expect(opening.obstacleRate).toBeLessThan(0.76);
    expect(late.obstacleRate).toBeGreaterThan(0.97);
    expect(late.doubleLaneShare).toBeGreaterThan(0.64);
    expect(late.doubleLaneShare).toBeLessThan(0.76);
  });

  it('widens the street ~12% on touch and keeps the desktop numbers', () => {
    setTouchEnvironment(true);
    const touchEngine = makeEngine();
    expect(touchEngine.roadWidth).toBe(314); // 280 * 1.12
    expect(touchEngine.roadLanes).toEqual([-101, 0, 101]);
    // The whip has to follow the wider street: walkers stand farther out.
    expect(touchEngine.slapReach).toBe(310);

    setTouchEnvironment(false);
    const desktopEngine = makeEngine();
    expect(desktopEngine.roadWidth).toBe(280);
    expect(desktopEngine.roadLanes).toEqual([-90, 0, 90]);
    expect(desktopEngine.slapReach).toBe(282);
  });

  it('drops coins in a single lane per row, and far fewer of them', () => {
    setTouchEnvironment(false);
    const engine = makeEngine();
    engine.stats.distanceRun = 400;

    let total = 0;
    const lanesUsed = new Set<number>();
    for (let row = 0; row < 12; row++) {
      engine.obstacles = [];
      engine.coins = [];
      (engine as unknown as { spawnMarketSegment(y: number): void }).spawnMarketSegment(900 + row * 180);

      // A row pays at most three coins, and they all sit in the same lane.
      expect(engine.coins.length).toBeGreaterThan(0);
      expect(engine.coins.length).toBeLessThanOrEqual(3);
      expect(new Set(engine.coins.map((coin) => coin.x)).size).toBe(1);

      total += engine.coins.length;
      engine.coins.forEach((coin) => lanesUsed.add(Math.round(coin.x)));
    }

    // Twelve rows used to bank well over thirty coins; now it is a quarter of that.
    expect(total).toBeLessThanOrEqual(30);
    // The coin lane still moves, so it is never the same lane every time.
    expect(lanesUsed.size).toBeGreaterThan(1);
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

  it('jumps high enough to clear a crate at a higher point of the arc', () => {
    const engine = touchObstacle(setup(), 'crate', 40);
    expect(engine.player.stamina).toBe(100);
    expect(engine.obstacles[0].hit).toBe(false);
  });

  it('still treats solid props as walls at the raised apex', () => {
    const engine = touchObstacle(setup(), 'cart', 40);
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
    p.y = 13_000; // past the ~853 m speed cap
    p.prevY = p.y;
    p.z = 0;
    p.vz = 0;
    p.stamina = 100;

    const before = (engine as unknown as { nextSpawnY: number }).nextSpawnY;
    (engine as unknown as { update(dtFactor: number): void }).update(1);
    const after = (engine as unknown as { nextSpawnY: number }).nextSpawnY;

    // The cap now climbs to 6.4 units/frame of bonus instead of flattening at 3.8.
    expect(p.speed).toBeCloseTo(p.baseSpeed + 6.4, 5);

    const gap = after - before;
    expect(gap).toBeGreaterThan(650);
    expect(gap).toBeLessThan(820);
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

describe('flame mode', () => {
  function fireSetup(): GameEngine {
    const engine = makeEngine();
    setTouchEnvironment(false);
    engine.startGame();
    engine.introState.active = false;
    engine.obstacles = [];
    engine.powerups = [];
    const p = engine.player;
    p.y = 100;
    p.prevY = 100;
    p.z = 0;
    p.vz = 0;
    p.x = 0;
    p.prevX = 0;
    p.stamina = 100;
    engine.stats.distanceRun = 100;
    return engine;
  }

  it('starts a five-second flame mode from a flame pickup', () => {
    const engine = fireSetup();
    const p = engine.player;
    engine.powerups = [
      {
        id: 7,
        x: p.x,
        y: p.y,
        type: 'fire',
        collected: false,
        bobPhase: 0,
      },
    ];
    (engine as unknown as { update(dtFactor: number): void }).update(1);

    expect(p.fireTime).toBeGreaterThan(4_900);
    expect(p.fireTime).toBeLessThanOrEqual(5_000);
    expect(engine.stats.fireActive).toBe(true);
    expect(engine.stats.fireTimeLeft).toBe(5);
  });

  it('burns an obstacle instead of costing stamina', () => {
    const engine = fireSetup();
    const p = engine.player;
    p.fireTime = 5_000;
    engine.obstacles = [
      {
        id: 1,
        x: 0,
        y: p.y + 12,
        type: 'cart',
        width: 52,
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

    expect(p.stamina).toBe(100);
    expect(engine.obstacles[0].hit).toBe(true);
    expect(engine.stats.fireActive).toBe(true);
  });

  it('breathes fire at an obstacle it reaches without jumping', () => {
    const engine = fireSetup();
    const p = engine.player;
    p.fireTime = 6_000;
    engine.obstacles = [
      {
        id: 1,
        x: 0,
        // Close enough to be burned, far enough that no body contact happens.
        y: p.y + 60,
        type: 'crate',
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

    expect(engine.obstacles[0].hit).toBe(true);
    expect(p.stamina).toBe(100);
    expect(engine.stats.fireActive).toBe(true);
  });

  it('burns the prop in place instead of kicking it away', () => {
    const engine = fireSetup();
    const p = engine.player;
    p.fireTime = 5_000;
    const startY = p.y;
    engine.obstacles = [
      {
        id: 1,
        x: 0,
        y: startY + 60,
        type: 'crate',
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
    const state = engine as unknown as { update(dtFactor: number): void };
    state.update(1);

    const obs = engine.obstacles[0];
    expect(obs.hit).toBe(true);
    expect(obs.burning).toBe(true);
    // No launch velocity: fire burns it, it does not throw it.
    expect(obs.hitVy).toBeUndefined();
    expect(obs.hitVx).toBeUndefined();
    expect(obs.burnProgress).toBeCloseTo(0, 2);
    // The jet is streamed from the mouth by the renderer.
    expect(engine.fireBreath.active).toBe(true);
    expect(engine.fireBreath.targetY).toBeCloseTo(startY + 60, 5);

    // It burns all the way down, then the cleanup pass takes it away.
    for (let i = 0; i < 45; i++) {
      engine.obstacles = engine.obstacles.filter((o) => o.id === 1);
      state.update(1);
    }
    expect(engine.obstacles.some((o) => o.id === 1)).toBe(false);
    expect(engine.fireBreath.active).toBe(false);
  });

  it('holds the first flame pickup back until 45 seconds of running', () => {
    const engine = fireSetup();
    const state = engine as unknown as { spawnMarketSegment(y: number): void; runTimeSeconds: number };

    state.runTimeSeconds = 44.9;
    engine.powerups = [];
    state.spawnMarketSegment(1_200);
    expect(engine.powerups.some((pickup) => pickup.type === 'fire')).toBe(false);

    state.runTimeSeconds = 45.1;
    engine.powerups = [];
    state.spawnMarketSegment(1_400);
    expect(engine.powerups.some((pickup) => pickup.type === 'fire')).toBe(true);

    // Then one every sixty seconds, and not before.
    state.runTimeSeconds = 104.9;
    engine.powerups = [];
    state.spawnMarketSegment(1_600);
    expect(engine.powerups.some((pickup) => pickup.type === 'fire')).toBe(false);

    state.runTimeSeconds = 105.1;
    engine.powerups = [];
    state.spawnMarketSegment(1_800);
    expect(engine.powerups.some((pickup) => pickup.type === 'fire')).toBe(true);
  });
});

describe('first-run mobile tutorial', () => {
  it('only arms the lesson on a touch device and only once', () => {
    setTouchEnvironment(true);
    const engine = makeEngine();
    engine.startGame();
    expect(engine.tutorialState.pending).toBe(true);

    // Simulate finishing the lesson, then a second run starts clean.
    engine.introState.active = false;
    engine.tutorialState.active = true;
    engine.tutorialState.pending = false;
    engine.changeLane(1);
    engine.startGame();
    expect(engine.tutorialState.pending).toBe(false);

    setTouchEnvironment(false);
    const desktop = makeEngine();
    desktop.startGame();
    expect(desktop.tutorialState.pending).toBe(false);
  });

  it('accepts only the cued direction while the lesson is active', () => {
    setTouchEnvironment(true);
    const engine = makeEngine();
    engine.startGame();
    engine.introState.active = false;
    engine.tutorialState.active = true;
    engine.tutorialState.pending = false;
    engine.tutorialState.direction = 1;
    engine.currentLaneIndex = 1;
    engine.stats.tutorialActive = true;

    engine.changeLane(-1);
    expect(engine.currentLaneIndex).toBe(1);
    engine.requestJump();
    expect(engine.player.vz).toBe(0);
    engine.requestSlap();
    expect(engine.input.slapRequested).toBe(false);

    engine.changeLane(1);
    expect(engine.currentLaneIndex).toBe(2);
    expect(engine.stats.tutorialActive).toBe(false);
    expect(engine.tutorialState.active).toBe(false);
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

describe('stamina economy', () => {
  function setup(): GameEngine {
    // Set the environment first: touch mode is frozen at construction, so
    // anything a previous test left behind would silently retune this run.
    setTouchEnvironment(false);
    const engine = makeEngine();
    engine.startGame();
    engine.introState.active = false;
    engine.tutorialState.active = false;
    engine.obstacles = [];
    engine.powerups = [];
    engine.bystanders = [];
    const p = engine.player;
    p.x = 0;
    p.prevX = 0;
    p.y = 100;
    p.prevY = 100;
    p.z = 0;
    p.vz = 0;
    p.stamina = 100;
    engine.stats.distanceRun = 100;
    return engine;
  }

  function shopper(id: number, x: number, y: number) {
    return {
      id,
      x,
      y,
      type: 'fruitseller' as const,
      name: 'Shopper',
      points: 50,
      bodyColor: '#000',
      shirtColor: '#fff',
      accessory: 'hat' as const,
      slapped: false,
      wobble: 0,
      walking: false,
      walkSpeed: 0,
      walkPhase: 0,
    };
  }

  it('refunds a bounded slice of stamina per whip instead of a full heal', () => {
    const engine = setup();
    const p = engine.player;
    p.stamina = 40;
    engine.bystanders = [shopper(1, 0, p.y + 10)];

    engine.requestSlap();
    (engine as unknown as { update(dtFactor: number): void }).update(1);

    expect(engine.stats.slapsCount).toBe(1);
    // 40 + 22, not the old +35 that let a whip outrun every drain.
    expect(p.stamina).toBeCloseTo(62, 2);
  });

  it('pays +26 per whip on a touch build instead of the keyboard +22', () => {
    // Detection is frozen at construction, so the touch env must be set first.
    setTouchEnvironment(true);
    const engine = makeEngine();
    setTouchEnvironment(false);
    engine.startGame();
    engine.introState.active = false;
    engine.tutorialState.active = false;
    engine.obstacles = [];
    engine.powerups = [];
    engine.bystanders = [];
    const p = engine.player;
    p.x = 0;
    p.prevX = 0;
    p.y = 100;
    p.prevY = 100;
    p.z = 0;
    p.vz = 0;
    p.stamina = 40;
    engine.stats.distanceRun = 100;
    engine.bystanders = [shopper(1, 0, p.y + 10)];

    engine.requestSlap();
    (engine as unknown as { update(dtFactor: number): void }).update(1);

    expect(engine.stats.slapsCount).toBe(1);
    // 40 + 26: the phone refund is a little richer, but still far below the
    // +35 that made a full heal possible.
    expect(p.stamina).toBeCloseTo(66, 2);
    // Still below the cap, so the value is a slice, not a refill.
    expect(p.stamina).toBeLessThan(engine.stats.maxStamina);
  });

  it('enforces a whip cooldown so a crowd cannot be farmed', () => {
    const engine = setup();
    const p = engine.player;
    engine.bystanders = [shopper(1, 0, p.y + 10), shopper(2, 40, p.y + 30)];
    const state = engine as unknown as { update(dtFactor: number): void };

    engine.requestSlap();
    state.update(1);
    expect(engine.stats.slapsCount).toBe(1);
    expect(p.slapCooldown).toBeGreaterThan(10);

    // A second press inside the cooldown is swallowed, not a free second hit.
    engine.requestSlap();
    state.update(1);
    expect(engine.stats.slapsCount).toBe(1);
    expect(engine.bystanders.filter((b) => b.slapped)).toHaveLength(1);
  });

  it('does not bleed stamina during the opening seconds', () => {
    const engine = setup();
    const p = engine.player;
    const state = engine as unknown as { update(dtFactor: number): void; runTimeSeconds: number };
    state.runTimeSeconds = 3;

    for (let i = 0; i < 120; i++) state.update(1);

    expect(p.stamina).toBe(100);
  });

  it('burns stamina while running once fatigue starts', () => {
    const engine = setup();
    const p = engine.player;
    const state = engine as unknown as { update(dtFactor: number): void; runTimeSeconds: number };
    state.runTimeSeconds = 70;

    for (let i = 0; i < 60; i++) state.update(1);

    // ~13 stamina in one second at the 70 s drain rate, so the bar falls visibly.
    expect(p.stamina).toBeGreaterThan(84);
    expect(p.stamina).toBeLessThan(88);
  });

  it('ends a perfectly dodged run by exhaustion, not forever', () => {
    const engine = setup();
    const p = engine.player;
    const state = engine as unknown as { update(dtFactor: number): void; runTimeSeconds: number };
    state.runTimeSeconds = 120;
    p.stamina = 4;

    for (let i = 0; i < 30; i++) state.update(1);

    expect(engine.state).toBe('GAMEOVER');
    expect(engine.stats.gameOverReason).toBe('EXHAUSTED');
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
