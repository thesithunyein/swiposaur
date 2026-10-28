// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOT_FIRST_LOAD_MS,
  BOOT_REPEAT_LOAD_MS,
  BOOT_SEEN_KEY,
  BOOT_STAGES,
  useBootSequence,
  type BootSequence,
} from '../src/game/useBootSequence.ts';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let boot: BootSequence | null = null;
let clock = 0;
let queue: FrameRequestCallback[] = [];
let frameId = 1;

function Harness() {
  const sequence = useBootSequence({
    firstLoadMs: 500,
    repeatLoadMs: 200,
    maxExtraMs: 300,
    holdMs: 40,
    fadeMs: 30,
  });
  useEffect(() => {
    boot = sequence;
  });
  return (
    <div
      data-testid="probe"
      data-progress={Math.round(sequence.progress)}
      data-label={sequence.label}
      data-visible={String(sequence.visible)}
    />
  );
}

async function frame(advanceMs = 16) {
  clock += advanceMs;
  const pending = queue;
  queue = [];
  await act(async () => {
    pending.forEach((cb) => cb(clock));
    await Promise.resolve();
  });
}

async function frames(count: number, advanceMs = 16) {
  for (let i = 0; i < count; i++) await frame(advanceMs);
}

function probe() {
  return container.querySelector('[data-testid="probe"]') as HTMLElement;
}

function progress() {
  return Number(probe().getAttribute('data-progress'));
}

function completeAll() {
  act(() => {
    BOOT_STAGES.forEach((stage) => boot?.complete(stage.id));
  });
}

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 0;
  queue = [];
  frameId = 1;
  boot = null;
  sessionStorage.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return frameId++;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  if (container) container.remove();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBootSequence', () => {
  it('ships an 8s first-load window and a 2s repeat window', () => {
    expect(BOOT_FIRST_LOAD_MS).toBe(8000);
    expect(BOOT_REPEAT_LOAD_MS).toBe(2000);
  });

  it('eases across the first-load window and releases at the end', async () => {
    mount();
    await frames(2);
    completeAll();

    // Half of the 500ms window: ease-out has already covered most of the bar.
    await frames(1, 250);
    const halfway = progress();
    expect(halfway).toBeGreaterThan(70);
    expect(halfway).toBeLessThan(95);
    expect(probe().getAttribute('data-visible')).toBe('true');

    await frames(1, 260);
    expect(progress()).toBe(100);
    await frames(1, 50);
    act(() => vi.advanceTimersByTime(40));
    expect(probe().getAttribute('data-visible')).toBe('false');
  });

  it('runs the repeat-load window much shorter once the session has seen it', async () => {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
    mount();
    await frames(2);
    completeAll();

    await frames(1, 150);
    // 150ms is 75% of the 200ms repeat window: nearly full.
    expect(progress()).toBeGreaterThan(85);

    await frames(1, 60);
    await frames(1, 50);
    act(() => vi.advanceTimersByTime(40));
    expect(probe().getAttribute('data-visible')).toBe('false');
  });

  it('parks at 96% until every real stage reports in', async () => {
    mount();
    await frames(2);
    act(() => boot?.complete('typeface'));

    // Past the duration, but two stages are still outstanding.
    await frames(8, 80);
    expect(progress()).toBe(96);
    expect(probe().getAttribute('data-visible')).toBe('true');

    act(() => {
      boot?.complete('arena');
      boot?.complete('progress');
    });
    await frames(1);
    expect(progress()).toBe(100);
  });

  it('releases the screen when a stage never arrives', async () => {
    mount();
    await frames(2);

    for (let i = 0; i < 40; i++) {
      await frame(50);
      act(() => vi.advanceTimersByTime(45));
      if (probe().getAttribute('data-visible') === 'false') break;
    }

    expect(probe().getAttribute('data-visible')).toBe('false');
  });
});
