// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStats } from '../src/game/types.ts';
import { setLanguage } from '../src/game/i18n.ts';

// React reads this flag (normally set by @testing-library) to allow act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const engineInstances: MockEngine[] = [];

interface MockEngine {
  onStatsUpdate?: (stats: GameStats, state: string) => void;
  destroy: ReturnType<typeof vi.fn>;
}

vi.mock('../src/game/GameEngine.ts', () => {
  class GameEngineMock {
    state = 'MENU';
    paceMultiplier = 1;
    isLevelMode = true;
    touchInputMode = false;
    introState = { active: false, phase: 'DONE', timer: 0, victim: null };
    input = {
      joystick: { active: false, x: 0, y: 0 },
      keys: { left: false, right: false, up: false, down: false, slap: false },
      slapRequested: false,
    };
    onAchievementUnlocked?: unknown;
    onLevelCompleted?: unknown;
    onStatsUpdate?: (stats: GameStats, state: string) => void;
    destroy = vi.fn();

    constructor(
      _canvas: HTMLCanvasElement,
      onStatsUpdate?: (stats: GameStats, state: string) => void
    ) {
      this.onStatsUpdate = onStatsUpdate;
      engineInstances.push(this as unknown as MockEngine);
    }

    setSkin() {}
    setMap() {}
    setLevel() {}
    setCharacterFocus() {}
    resize() {}
    applySettings() {}
    startGame() {}
    restartGame() {}
    resetToMenu() {}
    pauseGame() {}
    resumeGame() {}
    requestJump() {}
    requestSlap() {}
    changeLane() {}
    triggerIntroSlapNow() {}
  }
  return { GameEngine: GameEngineMock };
});

import App from '../src/App.tsx';

function baseStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    score: 0,
    highScore: 0,
    coins: 0,
    totalCoinsCollected: 0,
    slapsCount: 0,
    chaosLevel: 0,
    chaosMultiplier: 1,
    feverActive: false,
    distanceRun: 0,
    comboStreak: 0,
    maxCombo: 0,
    longestChaseEscape: 0,
    stamina: 100,
    maxStamina: 100,
    chaserOnScreen: false,
    chaserAlertTimer: 0,
    mobDistance: 180,
    currentLevel: 1,
    isLevelMode: true,
    currentMapId: 'market',
    boostJumpsCount: 0,
    nearMissesCount: 0,
    escapedCount: 0,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderApp(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function finishRun(stats: GameStats): void {
  const engine = engineInstances[engineInstances.length - 1];
  if (!engine?.onStatsUpdate) throw new Error('GameEngine mock was not constructed');
  act(() => {
    engine.onStatsUpdate!(stats, 'GAMEOVER');
  });
}

beforeEach(() => {
  engineInstances.length = 0;
  localStorage.clear();
  // Burmese ships as the default; this suite asserts the English copy, so it
  // configures the device for English the same way a player would.
  localStorage.setItem('slap_run_game_settings', JSON.stringify({ language: 'en' }));
  setLanguage('en');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
    });
    root = undefined as unknown as Root;
  }
  container?.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('App leaderboard lifecycle', () => {
  it('does not rebuild the GameEngine when leaderboard rows change', async () => {
    vi.stubEnv('VITE_LEADERBOARD_API', 'false');
    await renderApp();
    expect(engineInstances).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();

    finishRun(baseStats({ score: 500, maxCombo: 4 }));
    await flush();

    expect(engineInstances).toHaveLength(1);
    expect(engineInstances[0].destroy).not.toHaveBeenCalled();

    const saved = JSON.parse(localStorage.getItem('slap_run_hall_of_fame') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ score: 500 });

    // A repeated update for the same run must not create another row or engine.
    finishRun(baseStats({ score: 500, maxCombo: 4 }));
    await flush();
    expect(engineInstances).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('slap_run_hall_of_fame') ?? '[]')).toHaveLength(1);
  });

  it('saves locally and never shows a global rank when the API submission fails', async () => {
    vi.stubEnv('VITE_LEADERBOARD_API', 'true');
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/leaderboard') && (!init || init.method !== 'POST')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', storage: 'durable', entries: [] }),
        });
      }
      return Promise.reject(new Error('network down'));
    });

    await renderApp();
    await flush();

    finishRun(baseStats({ score: 640, maxCombo: 6, isNewPersonalBest: true }));
    await flush();
    await flush();

    const saved = JSON.parse(localStorage.getItem('slap_run_hall_of_fame') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ score: 640 });

    expect(container.textContent).toContain('Saved locally — not submitted online.');
    expect(container.textContent).not.toContain('GLOBAL RANK');
    expect(container.textContent).toContain('NEW PERSONAL BEST!');
  });

  it('shows a global rank only after the persisted submission succeeds', async () => {
    vi.stubEnv('VITE_LEADERBOARD_API', 'true');
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/leaderboard') && (!init || init.method !== 'POST')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', storage: 'durable', entries: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', storage: 'durable', rank: 1, duplicate: false, entries: [] }),
      });
    });

    await renderApp();
    await flush();

    finishRun(baseStats({ score: 750, maxCombo: 5 }));
    await flush();
    await flush();

    expect(container.textContent).toContain('GLOBAL RANK #1');
    expect(container.textContent).not.toContain('LOCAL RANK');
    expect(container.textContent).not.toContain('Saved locally — not submitted online.');
  });

  it('submits a stable player id and an auto-generated name', async () => {
    vi.stubEnv('VITE_LEADERBOARD_API', 'true');
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', storage: 'durable', entries: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          storage: 'durable',
          rank: 1,
          improved: true,
          duplicate: false,
          entries: [],
        }),
      });
    });

    await renderApp();
    await flush();

    const generatedName = localStorage.getItem('slap_run_share_name');
    const playerId = localStorage.getItem('slap_run_player_id');
    expect(generatedName).toMatch(/^[A-Z]+_[A-Z]+\d{2}$/);
    expect(playerId).toBeTruthy();

    finishRun(baseStats({ score: 880, maxCombo: 6 }));
    await flush();
    await flush();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    const posted = JSON.parse(String(postCall?.[1]?.body));
    expect(posted).toMatchObject({ playerId, name: generatedName, score: 880 });

    // The same identity is reused for the next run, so it stays one row per player.
    expect(localStorage.getItem('slap_run_player_id')).toBe(playerId);
  });
});
