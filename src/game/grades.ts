/**
 * Grade thresholds live here so the results card and the daily missions agree.
 *
 * A grade is earned on survival distance plus whip chaining — never on the raw
 * score, which the Roar multiplier can inflate 16x.
 */
export type GradeLetter = 'S+' | 'S' | 'A' | 'B' | 'C';

export interface GradeTier {
  grade: GradeLetter;
  /** Metres required in a single run. */
  distance: number;
  /** Roar tier required in the same run (0 means the distance alone decides). */
  combo: number;
  /** Ordinal used by missions that track the best grade reached. */
  rank: number;
}

export const GRADE_TIERS: GradeTier[] = [
  { grade: 'S+', distance: 2000, combo: 15, rank: 4 },
  { grade: 'S', distance: 1400, combo: 10, rank: 3 },
  { grade: 'A', distance: 800, combo: 0, rank: 2 },
  { grade: 'B', distance: 350, combo: 0, rank: 1 },
  { grade: 'C', distance: 0, combo: 0, rank: 0 },
];

export function tierForGrade(grade: GradeLetter): GradeTier {
  return GRADE_TIERS.find((tier) => tier.grade === grade) ?? GRADE_TIERS[GRADE_TIERS.length - 1];
}

export function gradeFor(distance: number, combo: number): GradeTier {
  const safeDistance = Number.isFinite(distance) ? distance : 0;
  const safeCombo = Number.isFinite(combo) ? combo : 0;
  return (
    GRADE_TIERS.find((tier) => safeDistance >= tier.distance && safeCombo >= tier.combo) ??
    GRADE_TIERS[GRADE_TIERS.length - 1]
  );
}

export interface GradeGap {
  tier: GradeTier;
  /** Metres still needed (0 when the distance is already there). */
  meters: number;
  /** Extra roar tier still needed (0 when the combo is already there). */
  combo: number;
}

/** The next grade up, or null when the run already earned S+. */
export function nextGradeGap(distance: number, combo: number): GradeGap | null {
  const currentRank = gradeFor(distance, combo).rank;
  const next = [...GRADE_TIERS].reverse().find((tier) => tier.rank === currentRank + 1);
  if (!next) return null;
  return {
    tier: next,
    meters: Math.max(0, Math.ceil(next.distance - distance)),
    combo: Math.max(0, next.combo - combo),
  };
}
