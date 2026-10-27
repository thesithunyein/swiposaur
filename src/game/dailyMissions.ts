import { GameStats } from './types.ts';
import { formatCountdown, mmtDayKey, mmtDayNumber, msUntilMmtMidnight } from './clock.ts';
import { gradeFor, GradeLetter } from './grades.ts';

/**
 * Five daily missions, drawn from a rotating pool and reset at midnight
 * Myanmar time.
 *
 * The day number seeds the selection, so every device gets the same five
 * missions on the same day and reloading cannot reroll a hard set into an easy
 * one. Each day picks five different metrics, then a tier inside each metric,
 * so a day never offers the same objective twice.
 */
export type MissionMetric = 'slaps' | 'distance' | 'coins' | 'roar' | 'nearMiss' | 'grade';

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  rewardCoins: number;
  bonusStamina: number;
  iconType: 'slap' | 'run' | 'fever' | 'coin' | 'escape' | 'generic';
}

export interface DailyMission extends MissionDefinition {
  current: number;
  completed: boolean;
  claimed: boolean;
  dayKey: string;
}

export const MISSION_STAMINA_BONUS = 20;
export const MISSIONS_PER_DAY = 5;

export const MISSION_POOL: MissionDefinition[] = [
  {
    id: 'mission_slap_15',
    title: 'Beachside Tail Whip',
    description: 'Land 15 tail whips on silly resort critters',
    metric: 'slaps',
    target: 15,
    rewardCoins: 100,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'slap',
  },
  {
    id: 'mission_slap_30',
    title: 'Tail Whip Marathon',
    description: 'Land 30 tail whips on resort critters',
    metric: 'slaps',
    target: 30,
    rewardCoins: 140,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'slap',
  },
  {
    id: 'mission_roar_4',
    title: 'Roar Rally',
    description: 'Reach a 4x Roar multiplier in a single run',
    metric: 'roar',
    target: 4,
    rewardCoins: 110,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'fever',
  },
  {
    id: 'mission_roar_8',
    title: 'Primal Crescendo',
    description: 'Reach an 8x Roar multiplier in a single run',
    metric: 'roar',
    target: 8,
    rewardCoins: 150,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'fever',
  },
  {
    id: 'mission_run_600',
    title: 'Sunny Shoreline Dash',
    description: 'Sprint 600 meters without falling to the stampede',
    metric: 'distance',
    target: 600,
    rewardCoins: 100,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'run',
  },
  {
    id: 'mission_run_1200',
    title: 'Boardwalk Endurance',
    description: 'Sprint 1,200 meters in a single run',
    metric: 'distance',
    target: 1200,
    rewardCoins: 150,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'run',
  },
  {
    id: 'mission_coins_25',
    title: 'Golden Shell Harvest',
    description: 'Collect 25 gold coins along the track',
    metric: 'coins',
    target: 25,
    rewardCoins: 80,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'coin',
  },
  {
    id: 'mission_coins_60',
    title: 'Treasure Trail',
    description: 'Collect 60 gold coins along the track',
    metric: 'coins',
    target: 60,
    rewardCoins: 120,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'coin',
  },
  {
    id: 'mission_nearmiss_3',
    title: 'Traffic Slalom',
    description: 'Slip past 3 obstacles for a near miss',
    metric: 'nearMiss',
    target: 3,
    rewardCoins: 110,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'escape',
  },
  {
    id: 'mission_nearmiss_6',
    title: 'Close Call Collector',
    description: 'Slip past 6 obstacles for near misses',
    metric: 'nearMiss',
    target: 6,
    rewardCoins: 140,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'escape',
  },
  {
    id: 'mission_grade_a',
    title: 'Speedway Contender',
    description: 'Finish a run with Grade A or better',
    metric: 'grade',
    target: 2,
    rewardCoins: 120,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'generic',
  },
  {
    id: 'mission_grade_s',
    title: 'Stampede Legend',
    description: 'Finish a run with Grade S or better',
    metric: 'grade',
    target: 3,
    rewardCoins: 150,
    bonusStamina: MISSION_STAMINA_BONUS,
    iconType: 'generic',
  },
];

const STORAGE_KEY = 'swiposaur.daily_missions.v3';

/** Small deterministic PRNG so one day always yields the same five missions. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Deterministic daily rotation: five different metrics, one tier each. */
export function missionsForDay(dayNumber: number): MissionDefinition[] {
  const rand = mulberry32(dayNumber * 2654435761);
  const metrics = shuffle(
    [...new Set(MISSION_POOL.map((mission) => mission.metric))],
    rand
  ).slice(0, MISSIONS_PER_DAY);

  return metrics.map((metric) => {
    const options = MISSION_POOL.filter((mission) => mission.metric === metric);
    return options[Math.floor(rand() * options.length)];
  });
}

/** `6h 12m` until the next Myanmar midnight. */
export function getNextResetLabel(date: Date = new Date()): string {
  return formatCountdown(msUntilMmtMidnight(date));
}

function freshMissions(date: Date): DailyMission[] {
  const dayKey = mmtDayKey(date);
  return missionsForDay(mmtDayNumber(date)).map((definition) => ({
    ...definition,
    current: 0,
    completed: false,
    claimed: false,
    dayKey,
  }));
}

interface StoredMission {
  id?: string;
  current?: number;
  completed?: boolean;
  claimed?: boolean;
}

export function loadDailyMissions(date: Date = new Date()): DailyMission[] {
  const dayKey = mmtDayKey(date);
  const fresh = freshMissions(date);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { dayKey?: string; missions?: StoredMission[] } | null;
      if (parsed?.dayKey === dayKey && Array.isArray(parsed.missions)) {
        return fresh.map((mission) => {
          const saved = parsed.missions?.find((entry) => entry.id === mission.id);
          if (!saved) return mission;
          return {
            ...mission,
            current: Math.max(0, Math.min(mission.target, Number(saved.current) || 0)),
            completed: saved.completed === true,
            claimed: saved.claimed === true,
          };
        });
      }
    }
  } catch {
    // A broken or unavailable store simply falls back to a fresh day.
  }
  saveDailyMissions(fresh);
  return fresh;
}

export function saveDailyMissions(missions: DailyMission[]): void {
  try {
    const dayKey = missions[0]?.dayKey ?? '';
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dayKey,
        missions: missions.map((mission) => ({
          id: mission.id,
          current: mission.current,
          completed: mission.completed,
          claimed: mission.claimed,
        })),
      })
    );
  } catch {
    // Private-mode browsers can refuse storage; the missions still work for this run.
  }
}

/** Number of missions finished and waiting to be claimed. */
export function getUnclaimedMissionsCount(date: Date = new Date()): number {
  return loadDailyMissions(date).filter((mission) => mission.completed && !mission.claimed).length;
}

function progressFor(mission: DailyMission, stats: GameStats): number {
  switch (mission.metric) {
    case 'slaps':
      return mission.current + Math.max(0, stats.slapsCount || 0);
    case 'coins':
      return mission.current + Math.max(0, stats.coins || 0);
    case 'nearMiss':
      return mission.current + Math.max(0, stats.nearMissesCount || 0);
    case 'distance':
      return Math.max(mission.current, Math.floor(stats.distanceRun || 0));
    case 'roar':
      return Math.max(mission.current, Math.floor(stats.maxCombo || 0));
    case 'grade':
      return Math.max(mission.current, gradeFor(stats.distanceRun, stats.maxCombo).rank);
    default:
      return mission.current;
  }
}

/**
 * Folds a finished run into every mission for today. Returns the updated list
 * and the missions this particular run completed (used for the toast).
 */
export function updateMissionsOnRun(
  stats: GameStats,
  date: Date = new Date()
): { missions: DailyMission[]; completed: DailyMission[] } {
  const missions = loadDailyMissions(date);
  const completed: DailyMission[] = [];

  const updated = missions.map((mission) => {
    if (mission.completed) return mission;
    const current = Math.min(mission.target, Math.max(0, progressFor(mission, stats)));
    const isComplete = current >= mission.target;
    const next = { ...mission, current, completed: isComplete };
    if (isComplete) completed.push(next);
    return next;
  });

  saveDailyMissions(updated);
  return { missions: updated, completed };
}

export function claimDailyMission(
  missionId: string,
  date: Date = new Date()
): {
  success: boolean;
  missions: DailyMission[];
  rewardCoins: number;
  bonusStamina: number;
} {
  const missions = loadDailyMissions(date);
  const mission = missions.find((entry) => entry.id === missionId);
  if (!mission || !mission.completed || mission.claimed) {
    return { success: false, missions, rewardCoins: 0, bonusStamina: 0 };
  }

  const updated = missions.map((entry) => (entry.id === missionId ? { ...entry, claimed: true } : entry));
  saveDailyMissions(updated);
  return {
    success: true,
    missions: updated,
    rewardCoins: mission.rewardCoins,
    bonusStamina: mission.bonusStamina,
  };
}

const RANK_LETTERS: GradeLetter[] = ['C', 'B', 'A', 'S', 'S+'];

/** Human-readable progress for mission types whose numbers are not intuitive. */
export function formatMissionProgress(mission: Pick<DailyMission, 'metric' | 'current' | 'target'>): string {
  if (mission.metric === 'grade') {
    const letter = RANK_LETTERS[Math.max(0, Math.min(RANK_LETTERS.length - 1, mission.current))];
    const targetLetter = RANK_LETTERS[Math.max(0, Math.min(RANK_LETTERS.length - 1, mission.target))];
    return `${letter} / ${targetLetter}`;
  }
  if (mission.metric === 'roar') return `${mission.current}x / ${mission.target}x`;
  return `${mission.current} / ${mission.target}`;
}

export interface MissionSummary {
  id: string;
  title: string;
  description: string;
  metric: MissionMetric;
  current: number;
  target: number;
  percent: number;
  progressLabel: string;
  rewardCoins: number;
  bonusStamina: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

function toSummary(mission: DailyMission): MissionSummary {
  const percent = mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    metric: mission.metric,
    current: mission.current,
    target: mission.target,
    percent,
    progressLabel: formatMissionProgress(mission),
    rewardCoins: mission.rewardCoins,
    bonusStamina: mission.bonusStamina,
    completed: mission.completed,
    claimed: mission.claimed,
    claimable: mission.completed && !mission.claimed,
  };
}

/** Compact snapshots for the pause menu and results card. */
export function getMissionSummaries(date: Date = new Date()): MissionSummary[] {
  return loadDailyMissions(date).map(toSummary);
}

/**
 * The mission worth talking about after a run: a finished-but-unclaimed one
 * first, otherwise the closest unfinished mission.
 */
export function pickClosestMission(summaries: MissionSummary[]): MissionSummary | null {
  const open = summaries.filter((mission) => !mission.claimed);
  if (open.length === 0) return null;

  const claimable = open.find((mission) => mission.claimable);
  if (claimable) return claimable;

  return open.reduce<MissionSummary | null>((best, mission) => {
    if (!best) return mission;
    return mission.percent > best.percent ? mission : best;
  }, null);
}
