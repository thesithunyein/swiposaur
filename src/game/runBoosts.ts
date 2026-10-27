/**
 * Small, durable rewards that apply to the next run.
 *
 * A daily mission pays coins plus a little extra stamina, and the results card
 * offers a one-shot "retry with +20 stamina" on a cooldown. Both go through
 * this store so the engine only has to ask one question at run start.
 */
export const STAMINA_BOOST_AMOUNT = 20;
export const RETRY_BOOST_COOLDOWN_MS = 3.5 * 60 * 60 * 1000;
/** Never bank more than two boosts, so a stale store cannot stack all week. */
export const MAX_BANKED_STAMINA = STAMINA_BOOST_AMOUNT * 2;

const PENDING_KEY = 'swiposaur.pending_stamina_boost';
const RETRY_KEY = 'swiposaur.retry_boost_at';

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage refusal only costs the boost; the run still starts normally.
  }
}

export function peekStaminaBoost(): number {
  return Math.min(MAX_BANKED_STAMINA, readNumber(PENDING_KEY));
}

/** Queues stamina for the next run and returns the new banked total. */
export function grantStaminaBoost(amount: number = STAMINA_BOOST_AMOUNT): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const total = Math.min(MAX_BANKED_STAMINA, peekStaminaBoost() + safeAmount);
  writeNumber(PENDING_KEY, total);
  return total;
}

/** Hands the banked boost to a starting run and clears it. */
export function consumeStaminaBoost(): number {
  const pending = peekStaminaBoost();
  if (pending > 0) writeNumber(PENDING_KEY, 0);
  return pending;
}

export function retryBoostRemainingMs(now: number = Date.now()): number {
  const usedAt = readNumber(RETRY_KEY);
  if (usedAt <= 0) return 0;
  return Math.max(0, usedAt + RETRY_BOOST_COOLDOWN_MS - now);
}

export function canUseRetryBoost(now: number = Date.now()): boolean {
  return retryBoostRemainingMs(now) === 0;
}

export function markRetryBoostUsed(now: number = Date.now()): void {
  writeNumber(RETRY_KEY, now);
}

/**
 * Claims the retry boost. Grants stamina only when the cooldown has expired and
 * starts the cooldown in the same call, so a double tap cannot grant twice.
 */
export function useRetryBoost(now: number = Date.now()): { granted: boolean; remainingMs: number } {
  if (!canUseRetryBoost(now)) {
    return { granted: false, remainingMs: retryBoostRemainingMs(now) };
  }
  markRetryBoostUsed(now);
  grantStaminaBoost(STAMINA_BOOST_AMOUNT);
  return { granted: true, remainingMs: RETRY_BOOST_COOLDOWN_MS };
}

/** Test/debug helper: clears the cooldown without touching banked stamina. */
export function resetRetryBoostCooldown(): void {
  writeNumber(RETRY_KEY, 0);
}
