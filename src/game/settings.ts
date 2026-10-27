import type { Language } from './i18n.ts';

export interface GameSettings {
  language: Language;
  soundEnabled: boolean;
  musicEnabled: boolean;
  cameraShake: boolean;
  reducedMotion: boolean;
  characterFocus: 'close' | 'classic' | 'dynamic';
  showLaneButtons: 'auto' | 'always' | 'hidden';
  onScreenControls: 'auto' | 'always' | 'hidden';
  vibration: boolean;
}

const STORAGE_KEY = 'slap_run_game_settings';

export const DEFAULT_SETTINGS: GameSettings = {
  language: 'en',
  soundEnabled: true,
  musicEnabled: true,
  cameraShake: true,
  reducedMotion: false,
  characterFocus: 'close',
  showLaneButtons: 'auto',
  onScreenControls: 'auto',
  vibration: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function isTouchEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}
