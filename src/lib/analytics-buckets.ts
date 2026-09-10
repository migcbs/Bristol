// Small helpers for turning a list of timestamps into a day-by-day series
// for the dashboard ColumnCharts. All local-time; the "day" is midnight to
// midnight in the server's zone (good enough for an internal dashboard).

export interface SeriesPoint {
  label: string;
  value: number;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Count of items per day for the last `days` days (oldest → newest), the
 * final bucket being today. Pass `weights` to sum a number per item
 * instead of counting (e.g. montoCents).
 */
export function dailySeries(dates: Date[], days: number, weights?: number[]): SeriesPoint[] {
  const today = startOfDay(new Date());
  const buckets: SeriesPoint[] = [];
  const index = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    index.set(d.getTime(), buckets.length);
    buckets.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: 0 });
  }
  dates.forEach((raw, i) => {
    const key = startOfDay(raw).getTime();
    const at = index.get(key);
    if (at !== undefined) buckets[at].value += weights ? weights[i] : 1;
  });
  return buckets;
}

export function sinceDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}
