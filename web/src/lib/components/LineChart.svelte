<script lang="ts">
  import { onMount } from 'svelte';

  interface Point {
    ts: number;
    value: number | null;
    failed: number;
  }

  interface Series {
    id: string;
    name: string;
    color: string;
    points: Point[];
  }

  interface Props {
    title: string;
    unit?: string;
    series: Series[];
    yMin?: number | null;
    yMax?: number | null;
    maxGapMs?: number | null;
  }

  let { title, unit = '', series, yMin = null, yMax = null, maxGapMs = null }: Props = $props();

  const H = 240;
  const padL = 48;
  const padR = 14;
  const padT = 16;
  const padB = 32;

  let W = $state(640);
  let el: HTMLElement;

  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        W = Math.max(280, e.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  function isValidPoint(p: Point): p is Point & { value: number } {
    return p.failed === 0 && p.value !== null && Number.isFinite(p.value);
  }

  const allPoints = $derived(series.flatMap((s) => s.points));
  const valid = $derived(allPoints.filter(isValidPoint));
  const hasData = $derived(valid.length > 1);

  const minTs = $derived(hasData ? Math.min(...valid.map((p) => p.ts)) : 0);
  const maxTs = $derived(hasData ? Math.max(...valid.map((p) => p.ts)) : 1);

  const dataLo = $derived(hasData ? Math.min(...valid.map((p) => p.value)) : 0);
  const dataHi = $derived(hasData ? Math.max(...valid.map((p) => p.value)) : 1);
  const span = $derived(dataHi - dataLo);

  const valLo = $derived(
    yMin !== null ? yMin : dataLo === dataHi ? dataLo - 1 : dataLo - span * 0.05
  );
  const valHi = $derived(
    yMax !== null ? yMax : dataLo === dataHi ? dataHi + 1 : dataHi + span * 0.05
  );

  const plotW = $derived(W - padL - padR);
  const plotH = $derived(H - padT - padB);

  function x(ts: number): number {
    if (maxTs === minTs) return padL;
    return padL + ((ts - minTs) / (maxTs - minTs)) * plotW;
  }
  function y(v: number): number {
    if (valHi === valLo) return H - padB;
    return padT + (1 - (v - valLo) / (valHi - valLo)) * plotH;
  }

  interface PathSegment {
    d: string;
  }

  function inferredMaxGapMs(points: Point[]): number | null {
    const uniqueTs = Array.from(new Set(points.filter(isValidPoint).map((p) => p.ts))).sort(
      (a, b) => a - b
    );

    const gaps = uniqueTs
      .slice(1)
      .map((ts, i) => ts - uniqueTs[i])
      .filter((gap) => gap > 0)
      .sort((a, b) => a - b);

    if (gaps.length === 0) return null;

    const medianGap = gaps[Math.floor(gaps.length / 2)];

    return medianGap * 2.5;
  }

  const effectiveGapMs = $derived(maxGapMs ?? inferredMaxGapMs(allPoints));

  function pathFor(points: Point[]): PathSegment[] {
    const segments: PathSegment[] = [];
    const sortedPoints = [...points].sort((a, b) => a.ts - b.ts);
    const gapLimit = effectiveGapMs;

    let currentSegment: (Point & { value: number })[] = [];
    let previousValid: (Point & { value: number }) | null = null;

    function flush() {
      if (currentSegment.length > 1) {
        segments.push({
          d: currentSegment.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(pt.ts).toFixed(1)},${y(pt.value).toFixed(1)}`).join(' ')
        });
      }
      currentSegment = [];
    }

    for (const p of sortedPoints) {
      if (!isValidPoint(p)) {
        flush();
        previousValid = null;
        continue;
      }

      if (previousValid && gapLimit !== null && p.ts - previousValid.ts > gapLimit) {
        flush();
      }

      currentSegment.push(p);
      previousValid = p;
    }

    flush();
    return segments;
  }

  const yTicks = $derived(
    Array.from({ length: 4 }, (_, i) => {
      const v = valLo + ((valHi - valLo) * i) / 3;
      return { v, y: y(v) };
    })
  );

  const xTicks = $derived(
    hasData
      ? (() => {
          const n = Math.max(5, Math.min(10, Math.floor(plotW / 70)));
          return Array.from({ length: n }, (_, i) => {
            const ts = minTs + ((maxTs - minTs) * i) / (n - 1);
            return { ts, x: x(ts), label: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
          });
        })()
      : []
  );

  let clickedPoint: { x: number; y: number; value: number; label: string } | null = $state(null);

  function handleChartClick(event: MouseEvent) {
    if (!hasData) return;

    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    let closest: { pt: Point & { value: number }; dist: number } | null = null;
    const threshold = Math.max(20, plotW / 30);

    for (const s of series) {
      for (const p of s.points) {
        if (isValidPoint(p)) {
          const px = x(p.ts);
          const dist = Math.abs(clickX - px);
          if (!closest || dist < closest.dist) {
            closest = { pt: p, dist };
          }
        }
      }
    }

    if (closest && closest.dist < threshold) {
      const pt = closest.pt;
      clickedPoint = {
        x: x(pt.ts),
        y: y(pt.value),
        value: pt.value,
        label: new Date(pt.ts).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
      };
    } else {
      clickedPoint = null;
    }
  }

  function clearPopup() {
    clickedPoint = null;
  }

  const lastValues = $derived(
    series
      .map((s) => {
        const v = s.points.filter(isValidPoint);
        return { s, last: v.length > 0 ? v[v.length - 1] : null };
      })
      .filter((e) => e.last !== null)
  );
</script>

<div class="chart" bind:this={el}>
  <div class="head">
    <span class="title">{title}{#if unit}<span class="unit">{unit}</span>{/if}</span>
    {#if lastValues.length === 1}
      <span class="val">{lastValues[0].last!.value.toFixed(1)}</span>
    {/if}
  </div>

  {#if series.length > 1}
    <div class="legend">
      {#each lastValues as { s, last }}
        <span class="leg-item">
          <span class="swatch" style="background:{s.color}"></span>
          <span class="leg-name">{s.name}</span>
          <span class="leg-val">{last!.value.toFixed(1)}</span>
        </span>
      {/each}
    </div>
  {/if}

  <svg viewBox="0 0 {W} {H}" width={W} height={H} role="button" aria-label={title} tabindex="0" onclick={handleChartClick} onfocus={clearPopup} onblur={clearPopup} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleChartClick(e as any); }}>
    {#each yTicks as t}
      <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} class="grid" />
      <text x={padL - 8} y={t.y + 3} class="axis" text-anchor="end">{t.v.toFixed(1)}</text>
    {/each}
    {#each xTicks as t}
      <text x={t.x} y={H - 10} class="axis" text-anchor="middle">{t.label}</text>
    {/each}

    {#if hasData}
      {#each series as s (s.id)}
        {@const segments = pathFor(s.points)}
        {#each segments as seg}
          <path d={seg.d} fill="none" stroke={s.color} stroke-width="2" />
        {/each}
      {/each}
    {:else}
      <text x={W / 2} y={H / 2} class="empty" text-anchor="middle">No valid data</text>
    {/if}

    {#if clickedPoint}
      <g class="popup" transform="translate({clickedPoint.x}, {clickedPoint.y})">
        <circle cx="0" cy="0" r="6" fill="#fff" />
        <text x="0" y="-12" class="popup-text" text-anchor="middle">{clickedPoint.value.toFixed(1)}</text>
        <text x="0" y="22" class="popup-label" text-anchor="middle">{clickedPoint.label}</text>
        <line x1="0" y1="6" x2="0" y2={H - padB} class="popup-line" />
      </g>
    {/if}
  </svg>
</div>

<style>
  .chart {
    border: 1px solid #2a2f3a;
    border-radius: 8px;
    padding: 0.75rem;
    background: #14181f;
    overflow: hidden;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.25rem;
  }
  .title {
    font-weight: 600;
    color: #e5e7eb;
  }
  .unit {
    margin-left: 0.35rem;
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 400;
  }
  .val {
    font-size: 1.1rem;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .leg-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .leg-name {
    color: #9ca3af;
  }
  .leg-val {
    color: #e5e7eb;
    font-variant-numeric: tabular-nums;
  }
  svg {
    display: block;
  }
  .grid {
    stroke: #2a2f3a;
    stroke-width: 1;
  }
  .axis {
    fill: #9ca3af;
    font-size: 11px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .empty {
    fill: #6b7280;
    font-size: 12px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .popup {
    pointer-events: none;
  }
  .popup-text {
    fill: #fff;
    font-size: 11px;
    font-weight: 60 solid;
  }
  .popup-label {
    fill: #9ca3af;
    font-size: 10px;
  }
  .popup-line {
    stroke: #6b7280;
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
</style>