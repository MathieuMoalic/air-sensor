import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG } from './config.js';
import type { MetricSample, ParsedMetrics } from './metrics.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(dirname(CONFIG.db.path), { recursive: true });
  const db = new Database(CONFIG.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id   TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      node        TEXT    NOT NULL,
      unit        TEXT    NOT NULL DEFAULT '',
      value       REAL    NOT NULL,
      failed      INTEGER NOT NULL,
      ts          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_readings_sensor_ts ON readings(sensor_id, ts);
    CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
  `);

  _db = db;
  return db;
}

export function saveReadings(parsed: ParsedMetrics): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO readings (sensor_id, name, node, unit, value, failed, ts)
     VALUES (@id, @name, @node, @unit, @value, @failed, @ts)`
  );
  const tx = db.transaction((samples: MetricSample[]) => {
    for (const s of samples) {
      stmt.run({
        id: s.id,
        name: s.name,
        node: s.node,
        unit: s.unit,
        value: s.value,
        failed: s.failed,
        ts: parsed.timestamp
      });
    }
  });
  tx(parsed.samples);
}

export interface ReadingRow {
  ts: number;
  sensor_id: string;
  name: string;
  node: string;
  unit: string;
  value: number;
  failed: number;
}

export function getReadingsSince(sinceMs: number): ReadingRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT ts, sensor_id, name, node, unit, value, failed
       FROM readings
       WHERE ts >= ?
       ORDER BY ts ASC`
    )
    .all(sinceMs) as ReadingRow[];
}

export function listSensors(): { id: string; name: string; unit: string; node: string }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT sensor_id AS id, name, unit, node
       FROM readings r
       WHERE id = (SELECT MAX(id) FROM readings r2 WHERE r2.sensor_id = r.sensor_id)
       ORDER BY sensor_id`
    )
    .all() as { id: string; name: string; unit: string; node: string }[];
}
