// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage, t } from '../src/game/i18n.ts';
import { CHARACTER_SKINS } from '../src/game/constants.ts';
import { GAME_MAPS } from '../src/game/maps.ts';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/game/settings.ts';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  setLanguage('en');
});

describe('language setting', () => {
  it('defaults to Burmese, both for the setting and the runtime', () => {
    expect(DEFAULT_SETTINGS.language).toBe('my');
    expect(loadSettings().language).toBe('my');
    setLanguage('my');
    expect(getLanguage()).toBe('my');
    expect(t('PLAY')).toBe('ကစားမည်');
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

  it('translates the gameplay mission and achievement toasts', () => {
    setLanguage('my');
    expect(t('Mission: {title}', { title: t('Roar Rally') })).toBe('တာဝန်: ဟိန်းသံ စုစည်းမှု');
    expect(t('Claim +{coins} Coins and +{stamina} stamina!', { coins: 110, stamina: 20 })).toBe(
      '+110 ဒင်္ဂါးနှင့် +20 စွမ်းအင် ရယူပါ!'
    );
    expect(t('ACHIEVEMENT UNLOCKED!')).toBe('ဂုဏ်ပြုဆု ဖွင့်ပြီး!');
    expect(t('First Dino Slap!')).toBe('ပထမဆုံး ဒိုင်နို ရိုက်ချက်!');
    // "run clean" was read as "run purely" — the banner now says run fast.
    expect(t('STAMPEDE ON YOUR TAIL! RUN FAST TO SHAKE THEM OFF!')).toContain('အမြန်ပြေး');

    setLanguage('en');
    expect(t('STAMPEDE ON YOUR TAIL! RUN FAST TO SHAKE THEM OFF!')).toBe(
      'STAMPEDE ON YOUR TAIL! RUN FAST TO SHAKE THEM OFF!'
    );
    expect(t('First Dino Slap!')).toBe('First Dino Slap!');
  });

  it('translates every map and dinosaur skin shown in the menus', () => {
    setLanguage('my');
    for (const map of GAME_MAPS) {
      expect(t(map.name)).not.toBe(map.name);
      expect(t(map.theme)).not.toBe(map.theme);
      expect(t(map.tagline)).not.toBe(map.tagline);
    }
    for (const skin of CHARACTER_SKINS) {
      expect(t(skin.name)).not.toBe(skin.name);
      expect(t(skin.tagline)).not.toBe(skin.tagline);
    }
    // Menu chrome around those cards is Burmese too.
    expect(t('EXPLORE ISLAND BIOMES')).toBe('ကျွန်းဇုန်များ စူးစမ်းရန်');
    expect(t('3D DINO PADDOCK')).toBe('၃D ဒိုင်နို ဝိုင်း');
    expect(t('TRAVEL HERE')).toBe('ဤနေရာသို့ သွားရန်');

    setLanguage('en');
    expect(t(GAME_MAPS[0].name)).toBe(GAME_MAPS[0].name);
    expect(t(CHARACTER_SKINS[0].name)).toBe(CHARACTER_SKINS[0].name);
  });

  it('remembers the choice across a reload', () => {
    setLanguage('my');
    // The next page load reads this key before React mounts.
    expect(localStorage.getItem('slap_run_language')).toBe('my');
  });
});