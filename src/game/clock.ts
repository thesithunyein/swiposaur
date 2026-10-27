/**
 * One clock for every daily reset.
 *
 * Swiposaur awards daily missions and login rewards to players in Myanmar, so
 * "today" has to change at 00:00 MMT (UTC+06:30), not at 00:00 UTC. Myanmar
 * has no daylight saving, so the offset is a constant and everything here is
 * pure arithmetic that can be tested with a fixed clock.
 */
export const MMT_OFFSET_MINUTES = 6 * 60 + 30;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Milliseconds since the epoch, shifted into Myanmar wall-clock time. */
function shiftedTime(date: Date): number {
  return date.getTime() + MMT_OFFSET_MINUTES * MS_PER_MINUTE;
}

/** Whole days since the epoch on the Myanmar calendar. Stable per local day. */
export function mmtDayNumber(date: Date = new Date()): number {
  return Math.floor(shiftedTime(date) / MS_PER_DAY);
}

/** `YYYY-MM-DD` for the current Myanmar date. */
export function mmtDayKey(date: Date = new Date()): string {
  const local = new Date(shiftedTime(date));
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Milliseconds until the next midnight in Myanmar. */
export function msUntilMmtMidnight(date: Date = new Date()): number {
  const elapsed = shiftedTime(date) % MS_PER_DAY;
  return MS_PER_DAY - elapsed;
}

/** `6h 12m`, `45m` or `30s` — short enough for a footer. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

/** How many Myanmar days separate two instants (0 when it is the same day). */
export function mmtDaysBetween(earlier: Date, later: Date): number {
  return mmtDayNumber(later) - mmtDayNumber(earlier);
}
