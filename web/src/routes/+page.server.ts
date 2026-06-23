import type { PageServerLoad } from './$types';
import { getReadingsSince, listSensors, type ReadingRow } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ url }) => {
  const hours = Number(url.searchParams.get('hours') ?? '24');
  const sinceMs = Date.now() - Math.min(Math.max(hours, 1), 24 * 365) * 60 * 60 * 1000;

  const rows = getReadingsSince(sinceMs);
  const sensors = listSensors();

  const seriesMap = new Map<string, { id: string; name: string; unit: string; points: { ts: number; value: number; failed: number }[] }>();
  for (const s of sensors) {
    seriesMap.set(s.id, { id: s.id, name: s.name, unit: s.unit, points: [] });
  }

  for (const r of rows as ReadingRow[]) {
    let s = seriesMap.get(r.sensor_id);
    if (!s) {
      s = { id: r.sensor_id, name: r.name, unit: r.unit, points: [] };
      seriesMap.set(r.sensor_id, s);
    }
    s.points.push({ ts: r.ts, value: r.value, failed: r.failed });
  }

  return {
    rangeHours: hours,
    series: Array.from(seriesMap.values())
  };
};
