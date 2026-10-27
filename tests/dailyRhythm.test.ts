// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mmtDayKey, mmtDayNumber, msUntilMmtMidnight, formatCountdown } from '../src/game/clock.ts';
import {
  MISSIONS_PER_DAY,
  claimDailyMission,
  getMissionSummaries,
  loadDailyMissions,
  missionsForDay,
  pickClosestMission,
  updateMissionsOnRun,
  type MissionSummary,
} from '../src/game/dailyMissions.ts';
import {
  MAX_BANKED_STAMINA,
  consumeStaminaBoost,
  grantStaminaBoost,
  peekStaminaBoost,
  retryBoostRemainingMs,
  useRetryBoost,
  RETRY_BOOST_COOLDOWN_MS,
} from '../src/game/runBoosts.ts';
import { buildCoachLine } from '../src/game/coach.ts';
import { gradeFor, nextGradeGap } from '../src/game/grades.ts';
import { nextStreakForClaim, type DailyRewardState } from '../src/game/dailyRewards.ts';
import type { GameStats } from '../src/game/types.ts';

const stats = (overrides: Partial<GameStats> = {}): GameStats => ({
  score: 0,
  highScore: 0,
  coins: 0,
  totalCoinsCollected: 0,
  slapsCount: 0,
  chaosLevel: 0,
  chaosMultiplier: 1,
  feverActive: false,
  distanceRun: 0,
  comboStreak: 0,
  maxCombo: 0,
  longestChaseEscape: 0,
  stamina: 100,
  maxStamina: 100,
  chaserOnScreen: false,
  chaserAlertTimer: 0,
  mobDistance: 180,
  currentLevel: 1,
  isLevelMode: false,
  currentMapId: 'market',
  boostJumpsCount: 0,
  nearMissesCount: 0,
  escapedCount: 0,
  ...overrides,
});

const missionSummary = (overrides: Partial<MissionSummary> = {}): MissionSummary => ({
  id: 'mission_slap_15',
  title: 'Beachside Tail Whip',
  description: 'Land 15 tail whips',
  metric: 'slaps',
  current: 0,
  target: 15,
  percent: 0,
  progressLabel: '0 / 15',
  rewardCoins: 100,
  bonusStamina: 20,
  completed: false,
  claimed: false,
  claimable: false,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('Myanmar clock', () => {
  it('rolls the day over at 00:00 MMT (17:30 UTC)', () => {
    const oneMinuteBefore = new Date('2026-10-27T17:29:00Z');
    const oneMinuteAfter = new Date('2026-10-27T17:31:00Z');

    expect(mmtDayKey(oneMinuteBefore)).toBe('2026-10-27');
    expect(mmtDayKey(oneMinuteAfter)).toBe('2026-10-28');
    expect(msUntilMmtMidnight(oneMinuteBefore)).toBe(60_000);
    expect(mmtDayNumber(oneMinuteAfter) - mmtDayNumber(oneMinuteBefore)).toBe(1);
  });

  it('formats the reset countdown compactly', () => {
    expect(formatCountdown(6 * 3600_000 + 12 * 60_000)).toBe('6h 12m');
    expect(formatCountdown(45 * 60_000)).toBe('45m');
    expect(formatCountdown(30_000)).toBe('30s');
  });
});

describe('daily mission rotation', () => {
  it('gives every day five missions covering five different metrics', () => {
    const day = missionsForDay(10);
    expect(day).toHaveLength(MISSIONS_PER_DAY);
    expect(new Set(day.map((mission) => mission.metric)).size).toBe(MISSIONS_PER_DAY);
    expect(day.map((mission) => mission.id)).toEqual(missionsForDay(10).map((mission) => mission.id));
  });

  it('rotates the set across days', () => {
    const sets = new Set(
      Array.from({ length: 5 }, (_, i) =>
        missionsForDay(100 + i)
          .map((mission) => mission.id)
          .join(',')
      )
    );
    expect(sets.size).toBeGreaterThan(1);
  });

  it('keeps progress for today and resets it on a new day', () => {
    const dayOne = new Date('2026-10-27T05:00:00Z');
    const dayTwo = new Date('2026-10-28T05:00:00Z');

    const first = loadDailyMissions(dayOne);
    expect(first).toHaveLength(MISSIONS_PER_DAY);
    expect(first[0].dayKey).toBe(mmtDayKey(dayOne));

    const target = first[0];
    updateMissionsOnRun(
      stats({
        slapsCount: target.metric === 'slaps' ? 1 : 0,
        coins: target.metric === 'coins' ? 1 : 0,
        distanceRun: target.metric === 'distance' ? 10 : target.metric === 'grade' ? 400 : 0,
        maxCombo: target.metric === 'roar' ? 2 : 0,
        nearMissesCount: target.metric === 'nearMiss' ? 1 : 0,
      }),
      dayOne
    );

    const carried = loadDailyMissions(dayOne).find((mission) => mission.id === target.id);
    expect(carried?.current).toBeGreaterThan(0);

    const nextDay = loadDailyMissions(dayTwo);
    expect(nextDay.every((mission) => mission.current === 0)).toBe(true);
    expect(nextDay[0].dayKey).toBe(mmtDayKey(dayTwo));
  });

  it('completes one mission and pays coins and stamina exactly once', () => {
    const date = new Date('2026-10-27T05:00:00Z');
    const mission = loadDailyMissions(date)[0];
    const run = stats({
      slapsCount: mission.metric === 'slaps' ? mission.target : 0,
      distanceRun: mission.metric === 'distance' ? mission.target : mission.metric === 'grade' ? 800 : 0,
      coins: mission.metric === 'coins' ? mission.target : 0,
      maxCombo: mission.metric === 'roar' ? mission.target : 0,
      nearMissesCount: mission.metric === 'nearMiss' ? mission.target : 0,
    });

    const result = updateMissionsOnRun(run, date);
    expect(result.completed.some((entry) => entry.id === mission.id)).toBe(true);
    expect(result.missions.find((entry) => entry.id === mission.id)?.completed).toBe(true);

    const claim = claimDailyMission(mission.id, date);
    expect(claim.success).toBe(true);
    expect(claim.rewardCoins).toBe(mission.rewardCoins);
    expect(claim.bonusStamina).toBe(20);

    const second = claimDailyMission(mission.id, date);
    expect(second.success).toBe(false);
    expect(second.rewardCoins).toBe(0);
  });

  it('summarises the set and highlights the closest open mission', () => {
    const date = new Date('2026-10-27T05:00:00Z');
    const summaries = getMissionSummaries(date);
    expect(summaries).toHaveLength(MISSIONS_PER_DAY);
    expect(pickClosestMission(summaries)?.percent).toBe(0);

    const target = loadDailyMissions(date)[0];
    updateMissionsOnRun(
      stats({
        slapsCount: target.metric === 'slaps' ? 1 : 0,
        coins: target.metric === 'coins' ? 1 : 0,
        distanceRun: target.metric === 'distance' ? 10 : target.metric === 'grade' ? 400 : 0,
        maxCombo: target.metric === 'roar' ? 2 : 0,
        nearMissesCount: target.metric === 'nearMiss' ? 1 : 0,
      }),
      date
    );
    expect(pickClosestMission(getMissionSummaries(date))?.id).toBe(target.id);
  });
});

describe('login egg streak', () => {
  const base: DailyRewardState = {
    currentDay: 3,
    currentStreak: 3,
    lastClaimDate: '2026-10-26',
    lastClaimDay: mmtDayNumber(new Date('2026-10-26T05:00:00Z')),
    claimedDays: [1, 2, 3],
  };

  it('grows on consecutive days', () => {
    expect(nextStreakForClaim(base, new Date('2026-10-27T05:00:00Z'))).toBe(4);
  });

  it('steps back one stage after a missed day instead of resetting', () => {
    expect(nextStreakForClaim(base, new Date('2026-10-28T05:00:00Z'))).toBe(2);
    expect(nextStreakForClaim({ ...base, lastClaimDay: mmtDayNumber(new Date('2026-10-20T05:00:00Z')) }, new Date('2026-10-27T05:00:00Z'))).toBe(2);
  });

  it('does not advance twice in one day', () => {
    const today = new Date('2026-10-27T05:00:00Z');
    expect(nextStreakForClaim({ ...base, lastClaimDay: mmtDayNumber(today) }, today)).toBe(3);
  });
});

describe('stamina boosts and retry cooldown', () => {
  it('banks at most two boosts and spends them once', () => {
    grantStaminaBoost(20);
    grantStaminaBoost(20);
    grantStaminaBoost(20);
    expect(peekStaminaBoost()).toBe(MAX_BANKED_STAMINA);

    expect(consumeStaminaBoost()).toBe(MAX_BANKED_STAMINA);
    expect(consumeStaminaBoost()).toBe(0);
  });

  it('grants the retry boost once per cooldown window', () => {
    const start = 1_000_000;
    const first = useRetryBoost(start);
    expect(first.granted).toBe(true);
    expect(peekStaminaBoost()).toBe(20);

    const second = useRetryBoost(start + 1000);
    expect(second.granted).toBe(false);
    expect(peekStaminaBoost()).toBe(20);

    expect(retryBoostRemainingMs(start + RETRY_BOOST_COOLDOWN_MS - 1)).toBe(1);

    const third = useRetryBoost(start + RETRY_BOOST_COOLDOWN_MS + 1);
    expect(third.granted).toBe(true);
    expect(peekStaminaBoost()).toBe(40);
  });
});

describe('grade gaps and coach line', () => {
  it('reports the distance and combo still needed', () => {
    expect(gradeFor(600, 1).grade).toBe('B');
    const gap = nextGradeGap(600, 1);
    expect(gap?.tier.grade).toBe('A');
    expect(gap?.meters).toBe(200);
    expect(nextGradeGap(2100, 16)).toBeNull();
  });

  it('prefers the daily mission when it is close', () => {
    const line = buildCoachLine(stats({ distanceRun: 600, maxCombo: 1 }), missionSummary({ current: 12 }));
    expect(line).toContain('3 more tail whips');
  });

  it('falls back to the next grade when no mission is close', () => {
    const line = buildCoachLine(stats({ distanceRun: 600, maxCombo: 1 }), missionSummary({ current: 0 }));
    expect(line).toContain('200 m');
    expect(line).toContain('A grade');
  });

  it('still says something useful on a very short run', () => {
    const line = buildCoachLine(stats({ distanceRun: 90, maxCombo: 0 }), null);
    expect(line.length).toBeGreaterThan(10);
  });
});
