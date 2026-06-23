import type { Handle } from '@sveltejs/kit';
import { CONFIG } from '$lib/server/config.js';
import { fetchAndStore } from '$lib/server/collector.js';
import { getDb } from '$lib/server/db.js';

// Ensure the DB is initialised on boot.
getDb();

// Background polling loop — runs only in the long-lived server process
// (i.e. `vite preview`, `node build`, or `vite dev`).
let started = false;
function startPolling() {
  if (started) return;
  started = true;

  const poll = async () => {
    try {
      const parsed = await fetchAndStore();
      console.info(`[collector] stored ${parsed.samples.length} samples @ ${new Date(parsed.timestamp).toISOString()}`);
    } catch (err) {
      console.error(`[collector] ${err instanceof Error ? err.message : err}`);
    }
  };

  void poll();
  setInterval(poll, CONFIG.sensor.pollIntervalMs);
}

startPolling();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
