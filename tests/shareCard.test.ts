// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, type Language } from '../src/game/i18n.ts';
import { buildShareCard } from '../src/game/shareCard.ts';

const texts: string[] = [];
const gradient = { addColorStop: vi.fn() };
const context = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  arcTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillRect: vi.fn(),
  arc: vi.fn(),
  createLinearGradient: vi.fn(() => gradient),
  createRadialGradient: vi.fn(() => gradient),
  measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  fillText: vi.fn((text: string) => texts.push(text)),
  toBlob: vi.fn(),
};

const fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');

beforeEach(() => {
  texts.length = 0;
  setLanguage('my');
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: vi.fn(async () => []) },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' }))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fontDescriptor) Object.defineProperty(document, 'fonts', fontDescriptor);
  else Reflect.deleteProperty(document, 'fonts');
});

async function renderCard(language: Language): Promise<void> {
  setLanguage(language);
  await buildShareCard({
    score: 1234,
    highScore: 20000,
    slapsCount: 23,
    maxCombo: 14,
    coins: 41,
    distanceRun: 812,
    grade: 'A',
    playerName: 'FERAL_REX46',
    paceName: 'BEACH CHILL',
  });
}

describe('share card language and footer', () => {
  it('renders Burmese labels, pace and numerals when Burmese is selected', async () => {
    await renderCard('my');

    expect(texts).toContain('နောက်ဆုံး ဒိုင်နို ရမှတ်');
    expect(texts).toContain('အမြန်နှုန်း: ကမ်းခြေ အေးအေးဆေးဆေး · အကောင်းဆုံး: ၂၀,၀၀၀');
    expect(texts).toContain('၁,၂၃၄');
    expect(texts).toContain('ကစားသမား: FERAL_REX46');
    expect(texts.join(' ')).not.toContain('swiposaur.sithunyein.com');
    expect(texts.join(' ')).not.toContain('PACE:');
  });

  it('renders English labels, pace and date when English is selected', async () => {
    await renderCard('en');

    expect(texts).toContain('Final Dinosaur Score');
    expect(texts).toContain('PACE: BEACH CHILL  ·  BEST: 20,000');
    expect(texts).toContain('1,234');
    expect(texts.join(' ')).not.toContain('ကစားသမား');
    expect(texts.join(' ')).not.toContain('swiposaur.sithunyein.com');
  });
});
