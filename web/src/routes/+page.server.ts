import type { PageServerLoad } from './$types';
import { getReadingsSince, listSensors, type ReadingRow } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ url }) => {
  const hours = Number(url.searchParams.get('hours') ?? '24');
  const sinceMs = Date.now() - Math.min(Math.max(hours, 1), 24 * 365) * 60 * 60 * 1000;

  const rows = getReadingsSince(sinceMs);
  const sensors = listSensors();

  const seriesMap = new Map<string, { id: string; name: string; unit: string; points: { ts: number; value: number | null; failed: number }[] }>();
  for (const s of sensors) {
    seriesMap.set(s.id, { id: s.id, name: s.name, unit: s.unit, points: [] });
  }

  // Collect all timestamps and map rows by (sensor_id, ts)
  const timestamps = Array.from(new Set((rows as ReadingRow[]).map((r) => r.ts))).sort((a, b) => a - b);

  const pointsBySeries = new Map<string, Map<number, { ts: number; value: number | null; failed: number }>>();

  for (const r of rows as ReadingRow[]) {
    let byTs = pointsBySeries.get(r.sensor_id);
    if (!byTs) {
      byTs = new Map();
      pointsBySeries.set(r.sensor_id, byTs);
    }
    byTs.set(r.ts, { ts: r.ts, value: r.value, failed: r.failed });
  }

  // Fill in null points for missing timestamps
  for (const s of seriesMap.values()) {
    const byTs = pointsBySeries.get(s.id) ?? new Map();

    s.points = timestamps.map((ts) => {
      const point = byTs.get(ts);
      return point ?? { ts, value: null, failed: 1 };
    });
  }

  return {
    rangeHours: hours,
    series: Array.from(seriesMap.values())
  };
};