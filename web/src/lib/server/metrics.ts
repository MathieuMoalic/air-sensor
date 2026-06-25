export interface MetricSample {
  id: string;
  name: string;
  node: string;
  unit: string;
  value: number;
  failed: number;
}

export interface ParsedMetrics {
  timestamp: number;
  samples: MetricSample[];
}

/**
 * Parse ESPHome Prometheus exposition text.
 * Handles lines like:
 *   esphome_sensor_value{id="room_temperature",node="air",name="Room Temperature",unit="°C"} 28.1
 *   esphome_sensor_failed{id="...",...} 0
 */
export function parseMetrics(text: string, timestamp: number = Date.now()): ParsedMetrics {
  const valueLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const byId = new Map<string, MetricSample>();

  for (const line of valueLines) {
    const match = /^esphome_sensor_(value|failed)\{(.*)\}\s+(-?\d+(?:\.\d+)?)$/.exec(line);
    if (!match) continue;

    const [, kind, labelsRaw, numRaw] = match;
    const value = parseFloat(numRaw);
    const labels = parseLabels(labelsRaw);

    const id = labels.id ?? labels.name ?? 'unknown';
    const sample =
      byId.get(id) ??
      ({
        id,
        name: labels.name ?? id,
        node: labels.node ?? 'unknown',
        unit: labels.unit ?? '',
        value: 0,
        failed: 0
      } satisfies MetricSample);

    if (kind === 'value') {
      sample.value = value;
      sample.unit = labels.unit ?? sample.unit;
    } else if (kind === 'failed') {
      sample.failed = value;
    }

    byId.set(id, sample);
  }

  return { timestamp, samples: Array.from(byId.values()) };
}

function parseLabels(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return out;
}
