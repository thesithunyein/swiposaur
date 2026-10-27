// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage, t } from '../src/game/i18n.ts';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/game/settings.ts';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  setLanguage('en');
});

describe('language setting', () => {
  it('defaults to English, both for the setting and the runtime', () => {
    expect(DEFAULT_SETTINGS.language).toBe('en');
    expect(loadSettings().language).toBe('en');
    expect(getLanguage()).toBe('en');
    expect(t('PLAY')).toBe('PLAY');
  });

  it('keeps the chosen language in the saved settings', () => {
    saveSettings({ ...DEFAULT_SETTINGS, language: 'my' });
    expect(loadSettings().language).toBe('my');
  });

  it('renders Burmese once the language is switched, and back to English', () => {
    setLanguage('my');
    expect(getLanguage()).toBe('my');
    expect(document.documentElement.lang).toBe('my');
    expect(t('PLAY')).toBe('ကစားမည်');
    expect(t('GAME SETTINGS')).toBe('ဂိမ်း ဆက်တင်');

    setLanguage('en');
    expect(t('PLAY')).toBe('PLAY');
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to the English string for copy that has not been translated', () => {
    setLanguage('my');
    expect(t('Some untranslated label')).toBe('Some untranslated label');
  });

  it('interpolates variables in either language', () => {
    expect(t('Day {day}', { day: 3 })).toBe('Day 3');
    setLanguage('my');
    expect(t('Day {day}', { day: 3 })).toBe('ရက် 3');
    expect(t('Dashed {meters} meters across the resort!', { meters: 120 })).toContain('120');
  });

  it('remembers the choice across a reload', () => {
    setLanguage('my');
    // The next page load reads this key before React mounts.
    expect(localStorage.getItem('slap_run_language')).toBe('my');
  });
});