import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Boot sequence for the loading screen in front of the title menu.
 *
 * Timing is deliberate:
 * - first page load in a browser session: 8s, so the logo and wordmark have
 *   time to arrive fully painted before the title menu takes over
 * - repeat loads in the same session: ~2s, because the player already saw it
 *
 * The bar follows an ease-out curve over that window (fast out of the gate,
 * slow at the end) instead of ticking linearly, and it is still gated by the
 * real stages: it parks at 96% until the work actually reports in. A guard
 * releases the screen if a stage never resolves.
 */
export type BootStageId = 'typeface' | 'arena' | 'progress';

export interface BootStageDefinition {
  id: BootStageId;
  label: string;
  short: string;
  weight: number;
}

export const BOOT_STAGES: BootStageDefinition[] = [
  { id: 'typeface', label: 'Loading typeface', short: 'Typeface', weight: 0.32 },
  { id: 'arena', label: 'Warming up the arena', short: 'Arena', weight: 0.48 },
  { id: 'progress', label: 'Syncing your progress', short: 'Progress', weight: 0.2 },
];

export const BOOT_SEEN_KEY = 'swiposaur.boot_seen';

/** Splash length on the first load of a session (the full brand moment). */
export const BOOT_FIRST_LOAD_MS = 8000;
/** Splash length on later loads: the player has already seen it, keep it brief. */
export const BOOT_REPEAT_LOAD_MS = 2000;

export interface BootStageState extends BootStageDefinition {
  complete: boolean;
}

export interface BootSequence {
  progress: number;
  label: string;
  leaving: boolean;
  visible: boolean;
  stages: BootStageState[];
  complete: (id: BootStageId) => void;
}

interface BootSequenceOptions {
  /** Splash length on the first load of a session. */
  firstLoadMs?: number;
  /** Splash length on later loads within the same session. */
  repeatLoadMs?: number;
  /** Extra wait before the guard releases a stage that never reports. */
  maxExtraMs?: number;
  /** Pause at 100% before the screen fades. */
  holdMs?: number;
  /** Must match the .boot-shell opacity transition. */
  fadeMs?: number;
}

export function hasBootedThisSession(): boolean {
  try {
    return sessionStorage.getItem(BOOT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markBootSeen() {
  try {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
  } catch {}
}

export function useBootSequence(options: BootSequenceOptions = {}): BootSequence {
  const {
    firstLoadMs = BOOT_FIRST_LOAD_MS,
    repeatLoadMs = BOOT_REPEAT_LOAD_MS,
    maxExtraMs = 2500,
    holdMs = 350,
    fadeMs = 480,
  } = options;

  const [completedIds, setCompletedIds] = useState<BootStageId[]>([]);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  const completedRef = useRef<Set<BootStageId>>(new Set());
  const mountedRef = useRef(true);
  const durationRef = useRef<number | null>(null);
  if (durationRef.current === null) {
    durationRef.current = hasBootedThisSession() ? repeatLoadMs : firstLoadMs;
  }

  const complete = useCallback((id: BootStageId) => {
    if (completedRef.current.has(id)) return;
    completedRef.current.add(id);
    if (!mountedRef.current) return;
    setCompletedIds(Array.from(completedRef.current));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let fadeTimer = 0;
    let wallTimer = 0;
    const startedAt = performance.now();
    const duration = durationRef.current ?? firstLoadMs;
    let holdUntil = 0;
    let finishing = false;

    const finish = () => {
      if (finishing || !mountedRef.current) return;
      finishing = true;
      setProgress(100);
      setLeaving(true);
      fadeTimer = window.setTimeout(() => {
        if (mountedRef.current) setVisible(false);
      }, fadeMs);
    };

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);

      // Safety net: never trap a player behind a stalled network call.
      if (elapsed >= duration + maxExtraMs) {
        BOOT_STAGES.forEach((stage) => complete(stage.id));
      }
      const allDone = BOOT_STAGES.every((stage) => completedRef.current.has(stage.id));

      if (!finishing) {
        if (elapsed >= duration && allDone) {
          setProgress(100);
        } else {
          // Ease-out cubic, capped at 96% until every stage really reports in.
          const ramp = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - ramp, 3);
          setProgress(Math.min(96, eased * 96));
        }
      }

      if (elapsed >= duration && allDone) {
        if (!holdUntil) {
          holdUntil = now + holdMs;
          markBootSeen();
        }
        if (now >= holdUntil && !finishing) {
          finish();
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // A hidden tab pauses requestAnimationFrame completely, which would leave
    // the splash on screen forever — this wall-clock path releases it on the
    // same schedule (ramp + guard + hold) whether or not frames are ticking.
    wallTimer = window.setTimeout(() => {
      if (finishing || !mountedRef.current) return;
      BOOT_STAGES.forEach((stage) => complete(stage.id));
      markBootSeen();
      finish();
    }, duration + maxExtraMs + holdMs);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(wallTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [complete, fadeMs, firstLoadMs, holdMs, maxExtraMs]);

  const stageStates: BootStageState[] = BOOT_STAGES.map((stage) => ({
    ...stage,
    complete: completedIds.includes(stage.id),
  }));

  const pending = stageStates.find((stage) => !stage.complete);
  const label = pending ? pending.label : 'Ready to run';

  return { progress, label, leaving, visible, stages: stageStates, complete };
}
