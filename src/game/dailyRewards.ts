import { mmtDayKey, mmtDayNumber } from './clock.ts';

export interface DailyRewardTier {
  day: number;
  coins: number;
  label: string;
  isSpecial?: boolean;
}

export interface DailyRewardState {
  currentDay: number;
  currentStreak: number;
  lastClaimDate: string | null;
  lastClaimDay: number | null;
  claimedDays: number[];
}

export const DAILY_REWARD_TIERS: DailyRewardTier[] = [
  { day: 1, coins: 50, label: 'Beach Pebble Egg' },
  { day: 2, coins: 100, label: 'Amber Shell Egg' },
  { day: 3, coins: 150, label: 'Coral Nest Egg' },
  { day: 4, coins: 200, label: 'Primal Claw Egg' },
  { day: 5, coins: 300, label: 'Volcano Core Egg', isSpecial: true },
  { day: 6, coins: 450, label: 'Electric Raptor Egg', isSpecial: true },
  { day: 7, coins: 800, label: 'GOLDEN T-REX NEST', isSpecial: true },
];

const STORAGE_KEY = 'slap_run_daily_rewards';

export const EMPTY_REWARD_STATE: DailyRewardState = {
  currentDay: 1,
  currentStreak: 1,
  lastClaimDate: null,
  lastClaimDay: null,
  claimedDays: [],
};

export function loadDailyRewardState(): DailyRewardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyRewardState>;
      const streak = Math.max(1, Number(parsed.currentStreak || parsed.currentDay) || 1);
      const legacyDay = parsed.lastClaimDate
        ? mmtDayNumber(new Date(`${parsed.lastClaimDate}T00:00:00Z`))
        : null;
      return {
        currentDay: streak,
        currentStreak: streak,
        lastClaimDate: parsed.lastClaimDate || null,
        lastClaimDay: Number.isFinite(parsed.lastClaimDay) ? (parsed.lastClaimDay as number) : legacyDay,
        claimedDays: Array.isArray(parsed.claimedDays) ? parsed.claimedDays : [],
      };
    }
  } catch {
    // Unreadable storage falls through to a fresh streak.
  }
  return { ...EMPTY_REWARD_STATE, claimedDays: [] };
}

export function isDailyRewardAvailable(date: Date = new Date()): boolean {
  const state = loadDailyRewardState();
  return state.lastClaimDate !== mmtDayKey(date) && state.lastClaimDay !== mmtDayNumber(date);
}

/**
 * Advances the egg streak.
 *
 * A claim on the next Myanmar day grows the egg. Missing a day costs exactly one
 * stage instead of wiping the streak, so a busy evening does not erase a week of
 * progress and the reason to open the game tomorrow survives.
 */
export function nextStreakForClaim(state: DailyRewardState, date: Date = new Date()): number {
  const today = mmtDayNumber(date);
  const last = state.lastClaimDay;
  const streak = Math.max(1, state.currentStreak || 1);

  if (last !== null) {
    const gap = today - last;
    if (gap <= 0) return streak;
    if (gap === 1) return (streak % DAILY_REWARD_TIERS.length) + 1;
    return Math.max(1, streak - 1);
  }

  if (state.lastClaimDate) {
    const legacy = mmtDayNumber(new Date(`${state.lastClaimDate}T00:00:00Z`));
    const gap = today - legacy;
    if (gap <= 0) return streak;
    if (gap === 1) return (streak % DAILY_REWARD_TIERS.length) + 1;
    return Math.max(1, streak - 1);
  }

  return 1;
}

export function claimDailyReward(date: Date = new Date()): {
  updatedState: DailyRewardState;
  reward: DailyRewardTier;
  bonusCoins: number;
} {
  const state = loadDailyRewardState();
  const streak = nextStreakForClaim(state, date);
  const tierIndex = (streak - 1) % DAILY_REWARD_TIERS.length;
  const reward = DAILY_REWARD_TIERS[tierIndex];

  const updatedState: DailyRewardState = {
    currentDay: streak,
    currentStreak: streak,
    lastClaimDate: mmtDayKey(date),
    lastClaimDay: mmtDayNumber(date),
    claimedDays: [...(streak === 1 ? [] : state.claimedDays), streak],
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
  } catch {
    // The reward still pays for this session even if the streak cannot persist.
  }

  return {
    updatedState,
    reward,
    bonusCoins: reward.coins,
  };
}
