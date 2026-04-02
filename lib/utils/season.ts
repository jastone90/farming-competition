/**
 * Shared season calculation.
 *
 * A "season" is a calendar year: Jan 1 – Dec 25.
 * Activities from Dec 26–31 still belong to that year's season
 * but score 0 SFUs (off-season rule, applied by the scoring engine).
 *
 * IMPORTANT: The season is simply the activity's calendar year.
 * Do NOT subtract 1 for January — that was a legacy bug.
 */
export function getSeasonForDate(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getFullYear();
}
