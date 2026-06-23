import { CONFIG } from './config.js';
import { parseMetrics } from './metrics.js';
import { saveReadings } from './db.js';
import type { ParsedMetrics } from './metrics.js';

export class CollectorError extends Error {}

export async function fetchAndStore(): Promise<ParsedMetrics> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.sensor.fetchTimeoutMs);

  let res: Response;
  try {
    res = await fetch(CONFIG.sensor.metricsUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' }
    });
  } catch (err) {
    throw new CollectorError(
      `Failed to reach ESP at ${CONFIG.sensor.metricsUrl}: ${(err as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new CollectorError(`ESP responded ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const parsed = parseMetrics(text);
  saveReadings(parsed);
  return parsed;
}
