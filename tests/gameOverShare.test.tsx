// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStats } from '../src/game/types.ts';
import { GameOverModal } from '../src/components/GameOverModal.tsx';
import { setLanguage } from '../src/game/i18n.ts';
import { buildShareCard } from '../src/game/shareCard.ts';

// React reads this flag (normally set by @testing-library) to allow act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The card itself is a canvas painting routine; the wiring is what this test owns.
vi.mock('../src/game/shareCard.ts', () => ({
  buildShareCard: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

function makeStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    score: 12_340,
    highScore: 20_000,
    coins: 41,
    totalCoinsCollected: 900,
    slapsCount: 23,
    chaosLevel: 3,
    chaosMultiplier: 4,
    feverActive: false,
    distanceRun: 812,
    comboStreak: 0,
    maxCombo: 14,
    longestChaseEscape: 0,
    stamina: 0,
    maxStamina: 100,
    chaserOnScreen: false,
    chaserAlertTimer: 0,
    mobDistance: 200,
    currentLevel: 1,
    isLevelMode: false,
    currentMapId: 'market',
    boostJumpsCount: 0,
    nearMissesCount: 0,
    escapedCount: 0,
    gameOverReason: 'EXHAUSTED',
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderModal(props: { onShare?: () => void } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <GameOverModal
        stats={makeStats()}
        paceName="ပုံမှန်"
        onRestart={() => {}}
        onHome={props.onShare ?? (() => {})}
        onOpenLeaderboard={() => {}}
      />
    );
  });
  return container;
}

function buttonByText(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((button) =>
    (button.textContent ?? '').includes(text)
  );
  if (!match) throw new Error(`No button containing "${text}"`);
  return match as HTMLButtonElement;
}

beforeEach(() => {
  localStorage.clear();
  setLanguage('en');
  (buildShareCard as unknown as ReturnType<typeof vi.fn>).mockClear();
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:share'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  // jsdom cannot navigate; the downloaded anchor click is what we assert instead.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  delete (navigator as unknown as { share?: unknown }).share;
  delete (navigator as unknown as { canShare?: unknown }).canShare;
});

describe('Game Over share card', () => {
  it('builds a card from the finished run and falls back to a download', async () => {
    renderModal();

    await act(async () => {
      buttonByText('SHARE THIS RIDE').click();
    });

    expect(buildShareCard).toHaveBeenCalledTimes(1);
    expect((buildShareCard as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      score: 12_340,
      highScore: 20_000,
      slapsCount: 23,
      maxCombo: 14,
      coins: 41,
      distanceRun: 812,
      // 812 m with a 14x roar is an A on the shared grade ladder.
      grade: 'A',
      playerName: expect.any(String),
      paceName: 'ပုံမှန်',
    });
    // No share sheet in jsdom, so the PNG download is the delivered behaviour.
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(buttonByText('SHARE CARD SAVED')).toBeTruthy();
  });

  it('uses the platform share sheet when the browser can share files', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    renderModal();

    await act(async () => {
      buttonByText('SHARE THIS RIDE').click();
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(buttonByText('SHARE CARD SAVED')).toBeTruthy();
  });

  it('reports a failed card instead of pretending it shared', async () => {
    (buildShareCard as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('canvas blocked'));

    renderModal();

    await act(async () => {
      buttonByText('SHARE THIS RIDE').click();
    });

    expect(buttonByText('SHARE NOT AVAILABLE')).toBeTruthy();
  });

  it('keeps the button idle when the player dismisses the share sheet', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { value: vi.fn(async () => Promise.reject(abort)), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    renderModal();

    await act(async () => {
      buttonByText('SHARE THIS RIDE').click();
    });

    expect(buttonByText('SHARE THIS RIDE')).toBeTruthy();
  });
});
