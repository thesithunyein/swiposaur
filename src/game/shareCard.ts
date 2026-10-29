/**
 * Share card generator — 1080x1350 PNG.
 *
 * The card is drawn with the same visual language as the in-game results screen
 * so a screenshot of a shared run reads as the same product: warm dark browns
 * (#2A1E14 → #140F0C), the orange border (#F97316), gold highlights, Lilita One
 * headings and Fredoka labels.
 *
 * Language follows the game: in Burmese the copy comes from the same i18n
 * dictionary the UI uses, and every Burmese string is drawn with the Myanmar
 * font stack (Aka 08 → Noto Sans Myanmar) because Lilita One and Fredoka carry
 * no Myanmar glyphs and would fall back to whatever the OS picks.
 */

import { getLanguage, tForLanguage, type Language } from './i18n.ts';

export interface ShareCardData {
  score: number;
  highScore: number;
  slapsCount: number;
  maxCombo: number;
  coins: number;
  distanceRun: number;
  /** Grade letter from the shared tiers, so the card and the results card agree. */
  grade: string;
  /** True when this run beat the previous personal best. */
  isNewBest?: boolean;
  playerName: string;
  paceName: string;
}

export const SHARE_NAME_KEY = 'swiposaur_name';

export function sanitizeName(raw: string): string {
  const clean = raw.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16);
  return clean || 'RUNNER';
}

const W = 1080;
const H = 1350;

/** Palette shared with the results card (see GameOverModal). */
const C = {
  bgTop: '#2A1E14',
  bgMid: '#1E1712',
  bgBot: '#140F0C',
  panel: '#19110B',
  panelInner: '#1D140D',
  border: '#F97316',
  borderSoft: 'rgba(249, 115, 22, 0.45)',
  amber: '#FED7AA',
  cream: '#FFF8E7',
  gold: '#FBBF24',
  goldDeep: '#F59E0B',
  pale: '#FEF08A',
  green: '#34D399',
  blue: '#38BDF8',
  pink: '#F43F5E',
  yellow: '#FACC15',
  dark: '#2A1508',
} as const;

/** Latin display and UI stacks — the fonts the web UI already ships. */
const HEAD_FONT = "'Lilita One', 'Fredoka', system-ui, sans-serif";
const UI_FONT = "'Fredoka', system-ui, sans-serif";
/**
 * Myanmar stacks. `Aka08` is the family the app registers in index.css and
 * preloads in GameLogo; Noto Sans Myanmar is the Google fallback. Lilita One /
 * Fredoka stay at the end so Latin runs inside a Burmese line (a score, a pace
 * name) still look native.
 */
const MY_HEAD_FONT = "'Aka08', 'Noto Sans Myanmar', 'Lilita One', 'Fredoka', system-ui, sans-serif";
const MY_UI_FONT = "'Aka08', 'Noto Sans Myanmar', 'Fredoka', system-ui, sans-serif";

/** Rounded rect without relying on ctx.roundRect, which older Safari lacks. */
function path(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  path(ctx, x, y, w, h, r);
}

/** Gold gradient used for headings and badges, matching the UI's buttons. */
function gold(ctx: CanvasRenderingContext2D, from: number, to: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, from, 0, to);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.18, C.pale);
  g.addColorStop(0.6, C.gold);
  g.addColorStop(1, C.goldDeep);
  return g;
}

/** Shrinks a string until it fits the given width, so long names never clip. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, family: string, weight: string, start: number): string {
  let size = start;
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return ctx.font;
}

/** Burmese numerals, so a date sits beside Burmese words in the same voice. */
const MY_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
function toMyanmarDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => MY_DIGITS[Number(digit)]);
}

/**
 * Burmese month names, written out rather than taken from Intl: browsers ship
 * little or no `my-MM` locale data, so `toLocaleDateString` falls back to
 * English month names on the very phones the card is for.
 */
const MY_MONTHS = [
  'ဇန်',
  'ဖေ',
  'မတ်',
  'ဧပြီ',
  'မေ',
  'ဇွန်',
  'ဇူ',
  'ဩဂုတ်',
  'စက်',
  'အောက်',
  'နိုဝင်',
  'ဒီဇင်',
];
function formatShareDate(myanmar: boolean, now: Date = new Date()): string {
  if (!myanmar) {
    return now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const month = MY_MONTHS[now.getMonth()] ?? '';
  return `${toMyanmarDigits(String(now.getDate()))} ${month} ${toMyanmarDigits(String(now.getFullYear()))}`;
}

function formatShareNumber(value: number, language: Language): string {
  const formatted = value.toLocaleString('en-US');
  return language === 'my' ? toMyanmarDigits(formatted) : formatted;
}

export async function buildShareCard(data: ShareCardData): Promise<Blob> {
  // Capture the selected language once so fonts, labels and translated values
  // stay consistent even if the player switches language while fonts load.
  const language = getLanguage();
  const myanmar = language === 'my';
  try {
    await Promise.all([
      document.fonts.load(myanmar ? "400 40px 'Aka08'" : "400 40px 'Fredoka'"),
      document.fonts.load("700 40px 'Lilita One'"),
    ]);
  } catch {
    // A blocked font is not worth failing a share over.
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context unavailable'));
      return;
    }

    // Copy, fonts and numbers all follow the captured in-game language.
    const translate = (value: string) => tForLanguage(language, value);
    const head = myanmar ? MY_HEAD_FONT : HEAD_FONT;
    const ui = myanmar ? MY_UI_FONT : UI_FONT;
    /** Myanmar has no letter case, so upper-casing is an English-only step. */
    const shout = (value: string) => (myanmar ? value : value.toUpperCase());

    const copy = {
      title: translate('Final Dinosaur Score'),
      whips: shout(translate('Tail-Whips')),
      roar: shout(translate('Max Roar')),
      coins: shout(translate('Dino Coins')),
      distance: shout(translate('Distance')),
      newBest: translate('NEW PERSONAL BEST!'),
      runner: shout(translate('RUNNER')),
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // ---------------------------------------------------------------- canvas
    const background = ctx.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, C.bgTop);
    background.addColorStop(0.5, C.bgMid);
    background.addColorStop(1, C.bgBot);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    // Warm glow behind the header, the same trick the results card uses.
    const glow = ctx.createRadialGradient(W / 2, 210, 20, W / 2, 210, 520);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 760);

    // ----------------------------------------------------------- outer frame
    box(ctx, 44, 44, W - 88, H - 88, 56);
    ctx.fillStyle = C.bgMid;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = C.border;
    ctx.stroke();

    box(ctx, 66, 66, W - 132, H - 132, 44);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 240, 130, 0.55)';
    ctx.stroke();

    // ---------------------------------------------------------------- header
    ctx.fillStyle = gold(ctx, 96, 210);
    fit(ctx, 'SWIPOSAUR', 760, head, '900', 104);
    ctx.fillText('SWIPOSAUR', W / 2, 168);

    ctx.fillStyle = C.border;
    ctx.font = `700 30px ${ui}`;
    ctx.fillText('★  T A I L   F R E N Z Y  ★', W / 2, 238);

    // ---------------------------------------------------------- score panel
    const panelX = 96;
    const panelY = 292;
    const panelW = W - 192;
    const panelH = 316;

    box(ctx, panelX + 8, panelY + 10, panelW, panelH, 34);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    box(ctx, panelX, panelY, panelW, panelH, 34);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.border;
    ctx.stroke();

    ctx.fillStyle = C.amber;
    fit(ctx, copy.title, panelW - 200, ui, '700', 26);
    ctx.fillText(copy.title, W / 2, panelY + 56);

    ctx.fillStyle = '#FFFFFF';
    const scoreText = formatShareNumber(data.score, language);
    fit(ctx, scoreText, panelW - 260, head, '900', 132);
    ctx.fillText(scoreText, W / 2, panelY + 156);

    // Grade badge — same tier the results screen awards.
    const badgeCx = panelX + panelW - 84;
    const badgeCy = panelY + 74;
    const badgeR = 52;
    const badgeFill = ctx.createLinearGradient(0, badgeCy - badgeR, 0, badgeCy + badgeR);
    badgeFill.addColorStop(0, C.pale);
    badgeFill.addColorStop(1, C.goldDeep);
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = badgeFill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7C2D12';
    ctx.stroke();
    ctx.fillStyle = C.dark;
    ctx.font = `900 ${data.grade.length > 1 ? 46 : 58}px ${head}`;
    ctx.fillText(data.grade, badgeCx, badgeCy + 4);

    // Pace + personal best strip, exactly like the results card copy.
    const stripY = panelY + panelH - 74;
    box(ctx, panelX + 36, stripY, panelW - 72, 52, 16);
    const strip = ctx.createLinearGradient(0, stripY, 0, stripY + 52);
    strip.addColorStop(0, C.gold);
    strip.addColorStop(1, C.goldDeep);
    ctx.fillStyle = strip;
    ctx.fill();

    const best = formatShareNumber(Math.max(data.score, data.highScore), language);
    const paceName = translate(data.paceName);
    const stripText = myanmar
      ? `အမြန်နှုန်း: ${paceName} · အကောင်းဆုံး: ${best}`
      : `PACE: ${paceName}  ·  BEST: ${best}`;
    ctx.fillStyle = C.dark;
    fit(ctx, stripText, panelW - 130, head, '700', 26);
    ctx.fillText(stripText, W / 2, stripY + 28, panelW - 130);

    // New personal best pill (same as the in-game banner).
    if (data.isNewBest) {
      const pillW = 380;
      const pillH = 54;
      const pillX = W / 2 - pillW / 2;
      const pillY = panelY + panelH + 26;
      box(ctx, pillX, pillY, pillW, pillH, 27);
      const pill = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      pill.addColorStop(0, C.gold);
      pill.addColorStop(1, C.goldDeep);
      ctx.fillStyle = pill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.fillStyle = C.dark;
      fit(ctx, copy.newBest, pillW - 32, head, '700', 24);
      ctx.fillText(copy.newBest, W / 2, pillY + pillH / 2 + 2);
    }

    // ------------------------------------------------------------ stat grid
    const gridTop = data.isNewBest ? 736 : 700;
    const cards = [
      { label: copy.whips, value: formatShareNumber(data.slapsCount, language), color: C.cream },
      { label: copy.roar, value: `${formatShareNumber(data.maxCombo, language)}${myanmar ? 'ဆ' : 'x'}`, color: C.pink },
      { label: copy.coins, value: `+${formatShareNumber(data.coins, language)}`, color: C.yellow },
      { label: copy.distance, value: `${formatShareNumber(Math.round(data.distanceRun), language)}${myanmar ? ' မီတာ' : 'm'}`, color: C.blue },
    ];

    const cardW = (W - 192 - 32) / 2;
    const cardH = 168;
    cards.forEach((card, index) => {
      const cx = 96 + (index % 2) * (cardW + 32);
      const cy = gridTop + Math.floor(index / 2) * (cardH + 28);

      box(ctx, cx + 6, cy + 8, cardW, cardH, 24);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      box(ctx, cx, cy, cardW, cardH, 24);
      ctx.fillStyle = C.panelInner;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = card.color;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = C.amber;
      fit(ctx, card.label, cardW - 56, ui, '700', 24);
      ctx.fillText(card.label, cx + 30, cy + 46);

      ctx.fillStyle = card.color;
      fit(ctx, card.value, cardW - 56, head, '900', 66);
      ctx.fillText(card.value, cx + 30, cy + 116);
      ctx.textAlign = 'center';
    });

    // -------------------------------------------------------------- footer
    const footerY = 1174;

    box(ctx, 140, footerY - 44, W - 280, 2, 1);
    ctx.fillStyle = C.borderSoft;
    ctx.fill();

    ctx.fillStyle = C.pale;
    const runner = `${copy.runner}: ${sanitizeName(data.playerName).toUpperCase()}`;
    fit(ctx, runner, W - 240, head, '700', 34);
    ctx.fillText(runner, W / 2, footerY + 16);

    ctx.fillStyle = C.amber;
    fit(ctx, formatShareDate(myanmar), W - 240, ui, '600', 24);
    ctx.fillText(formatShareDate(myanmar), W / 2, footerY + 74);

    // ------------------------------------------------------------- export
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create Blob from Canvas'));
    }, 'image/png');
  });
}
