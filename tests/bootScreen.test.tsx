// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BootScreen } from '../src/components/BootScreen.tsx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(progress: number, leaving = false) {
  act(() => {
    root.render(<BootScreen progress={progress} label="Warming up the arena" leaving={leaving} />);
  });
}

describe('BootScreen', () => {
  it('shows the logo, one progress bar and nothing else', () => {
    render(64);
    const text = container.textContent ?? '';
    expect(text).toContain('TIP ·');
    // No launch chrome, build tag, stage checklist or duplicated subtitle.
    expect(text).not.toContain('DIGIT7');
    expect(text).not.toContain('V1.0.0');
    expect(text).not.toContain('Typeface');
    // The logo keeps its own banner; no second, duplicated subtitle underneath.
    expect(text.split('TAIL FRENZY').length - 1).toBeLessThanOrEqual(2);
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('lays animated clouds and pollen behind the content, without extra copy', () => {
    render(30);
    const clouds = container.querySelectorAll('.boot-cloud');
    const motes = container.querySelectorAll('.boot-mote');

    expect(clouds.length).toBe(4);
    expect(motes.length).toBe(13);
    clouds.forEach((cloud) => {
      expect(cloud.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(cloud.querySelectorAll('.boot-cloud-art rect').length).toBeGreaterThan(40);
      expect(cloud.querySelector('.boot-cloud-art')?.getAttribute('viewBox')).toBe('0 0 200 64');
    });
    motes.forEach((mote) => {
      expect(mote.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(mote.querySelectorAll('.boot-pixel rect')).toHaveLength(1);
    });

    // Atmosphere must never add visible text of its own.
    const sky = clouds[0].closest('[aria-hidden="true"]') as HTMLElement;
    expect((sky.textContent ?? '').trim()).toBe('');
  });

  it('exposes honest progress through the progressbar role', () => {
    render(64);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('64');
    expect(bar?.getAttribute('aria-label')).toBe('Warming up the arena');

    const fill = bar?.firstElementChild as HTMLElement | null;
    expect(fill?.style.width).toBe('64%');
  });

  it('clamps progress and fades out when released', () => {
    render(140, true);
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(container.firstElementChild?.className).toContain('boot-fade-out');
  });

  it('announces loading state without blocking assistive tech', () => {
    render(10);
    const shell = container.querySelector('[role="status"]');
    expect(shell?.getAttribute('aria-busy')).toBe('true');
    expect(shell?.getAttribute('aria-label')).toBe('Loading Swiposaur');
  });
});
