export const CONFIG = {
  sensor: {
    metricsUrl: process.env.METRICS_URL ?? 'http://192.168.1.50/metrics',
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 7 * 60 * 1000),
    fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS ?? 5000)
  },
  db: {
    path: process.env.DB_PATH ?? './data/air.db'
  }
} as const;
