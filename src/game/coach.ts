import { GameStats } from './types.ts';
import { gradeFor, nextGradeGap } from './grades.ts';
import { MissionSummary } from './dailyMissions.ts';

/**
 * One short, specific line on the results card.
 *
 * A generic "good job" teaches nothing; the run is already over, so the only
 * useful thing to say is what was almost achieved. Priority is the daily
 * mission (the reason to come back tomorrow), then the next grade, then the
 * next Roar tier, with a few throwaway lines when nothing was close.
 */
const ROAR_TIERS = [2, 4, 8, 16];

function pick<T>(options: T[], salt: number): T {
  return options[Math.abs(Math.round(salt)) % options.length];
}

function missionLine(mission: MissionSummary | null, stats: GameStats): string | null {
  if (!mission) return null;
  if (mission.claimable) {
    return `Today's mission is done — claim ${mission.rewardCoins} coins.`;
  }
  if (mission.completed) return null;

  const remaining = Math.max(0, mission.target - mission.current);
  if (remaining <= 0) return null;

  // Only nudge when the finish line is genuinely close, otherwise it reads as noise.
  if (remaining > Math.max(2, mission.target * 0.4)) return null;

  switch (mission.metric) {
    case 'slaps':
      return `Only ${remaining} more tail ${remaining === 1 ? 'whip' : 'whips'} to finish today's mission.`;
    case 'distance':
      return `${remaining} m short of today's mission — one more push.`;
    case 'coins':
      return `${remaining} more ${remaining === 1 ? 'coin' : 'coins'} and today's mission is yours.`;
    case 'roar':
      return `${remaining}x more Roar finishes today's mission.`;
    case 'nearMiss':
      return `${remaining} more ${remaining === 1 ? 'near miss' : 'near misses'} to clear today's mission.`;
    case 'grade': {
      // A grade mission cannot be "n% done": either the run hit Grade A or it did not.
      // Only speak up when the player was one grade away.
      const achieved = gradeFor(stats.distanceRun, stats.maxCombo).rank;
      return achieved === mission.target - 1
        ? 'One grade short of today\'s mission — Grade A needs 800 m in a single run.'
        : null;
    }
    default:
      return null;
  }
}

export function buildCoachLine(stats: GameStats, mission: MissionSummary | null = null): string {
  const salt = Math.round(stats.distanceRun) + Math.round(stats.score);
  const distance = Math.max(0, stats.distanceRun || 0);
  const combo = Math.max(0, stats.maxCombo || 0);

  const missionMessage = missionLine(mission, stats);
  if (missionMessage) return missionMessage;

  const gap = nextGradeGap(distance, combo);
  if (gap) {
    if (gap.meters > 0 && gap.meters <= 300) {
      return pick(
        [
          `So close! Only ${gap.meters} m from ${gap.tier.grade} grade.`,
          `${gap.meters} m from ${gap.tier.grade} grade — you had the pace.`,
        ],
        salt
      );
    }
    if (gap.meters === 0 && gap.combo > 0) {
      return `Just ${gap.combo}x more Roar to lock in ${gap.tier.grade} grade.`;
    }
  }

  const nextTier = ROAR_TIERS.find((tier) => tier > combo);
  if (nextTier && combo > 0) {
    return `You reached ${combo}x Roar — push for ${nextTier}x next run.`;
  }

  return pick(
    [
      'Start clean, stay clean: the first 40 metres are free.',
      'Whip a critter to refill stamina before you need it.',
      'The open lane never moves more than one lane — read the next row early.',
    ],
    salt
  );
}
