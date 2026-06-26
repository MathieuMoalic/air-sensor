<script lang="ts">
  import LineChart from '$lib/components/LineChart.svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';

  interface Point {
    ts: number;
    value: number;
    failed: number;
  }
  interface SeriesIn {
    id: string;
    name: string;
    unit: string;
    points: Point[];
  }
  interface ChartSeries {
    id: string;
    name: string;
    color: string;
    points: Point[];
  }

  let { data } = $props();

  let reloading = $state(false);

  function setHours(value: string) {
    const url = new URL(page.url);
    url.searchParams.set('hours', value);
    goto(url, { keepFocus: true, noScroll: true });
  }

  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const colors = new Map<string, string>();
  let colorIdx = 0;
  function colorFor(id: string): string {
    let c = colors.get(id);
    if (!c) {
      c = palette[colorIdx++ % palette.length];
      colors.set(id, c);
    }
    return c;
  }

  function toSeries(s: SeriesIn): ChartSeries {
    return { id: s.id, name: s.name, color: colorFor(s.id), points: s.points };
  }

  const pmIds = new Set(['pm1_0', 'pm2_5', 'pm10']);

  const pmSeries = $derived(data.series.filter((s) => pmIds.has(s.id)).map(toSeries));
  const otherSeries = $derived(data.series.filter((s) => !pmIds.has(s.id)));

  const hasAny = $derived(data.series.length > 0);

  async function refresh() {
    reloading = true;
    try {
      await fetch('/api/collect', { method: 'POST' });
    } finally {
      await invalidateAll();
      reloading = false;
    }
  }
</script>

<svelte:head>
  <title>Air</title>
</svelte:head>

<main>
  <header>
    <h1>Air</h1>
    <div class="controls">
      <label>
        Range
        <select value={String(data.rangeHours)} onchange={(e) => setHours(e.currentTarget.value)}>
          <option value="6">6h</option>
          <option value="24">24h</option>
          <option value="168">7d</option>
          <option value="720">30d</option>
        </select>
      </label>
      <button onclick={refresh} disabled={reloading}>
        {reloading ? 'Collecting…' : 'Collect now'}
      </button>
    </div>
  </header>

  {#if !hasAny}
    <p class="empty">No data yet. Click <strong>Collect now</strong> to fetch from the ESP.</p>
  {:else}
    <div class="grid">
      {#if pmSeries.length > 0}
        <LineChart title="Particulate Matter" unit="µg/m³" series={pmSeries} yMin={0} />
      {/if}
      {#each otherSeries as s (s.id)}
        {@const isHumidity = s.id === 'room_humidity'}
        <LineChart
          title={s.name}
          unit={s.unit}
          series={[toSeries(s)]}
          yMin={isHumidity ? 0 : null}
          yMax={isHumidity ? 100 : null}
        />
      {/each}
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: #0b0e14;
    color: #e5e7eb;
    font-family: ui-sans-serif, system-ui, sans-serif;
    margin: 0;
  }
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .controls {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
    color: #9ca3af;
  }
  select,
  button {
    background: #1f2430;
    color: #e5e7eb;
    border: 1px solid #2a2f3a;
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-size: 0.85rem;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1rem;
  }
  .empty {
    color: #9ca3af;
  }
</style>
