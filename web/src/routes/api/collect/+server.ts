import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchAndStore, CollectorError } from '$lib/server/collector.js';

export const POST: RequestHandler = async () => {
  try {
    const parsed = await fetchAndStore();
    return json({ ok: true, count: parsed.samples.length, ts: parsed.timestamp });
  } catch (err) {
    const message = err instanceof CollectorError ? err.message : 'Unknown error';
    return json({ ok: false, error: message }, { status: 502 });
  }
};
