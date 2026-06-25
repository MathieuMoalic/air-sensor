<script lang="ts">
  import { onMount } from 'svelte';

  interface Point {
    ts: number;
    value: number;
    failed: number;
  }

  interface Props {
    title: string;
    unit: string;
    points: Point[];
    color?: string;
  }

  let { title, unit, points, color = '#3b82f6' }: Props = $props();

  const H = 220;
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

  const valid = $derived(points.filter((p) => p.failed === 0));
  const hasData = $derived(valid.length > 1);

  const minTs = $derived(hasData ? Math.min(...valid.map((p) => p.ts)) : 0);
  const maxTs = $derived(hasData ? Math.max(...valid.map((p) => p.ts)) : 1);
  const minVal = $derived(hasData ? Math.min(...valid.map((p) => p.value)) : 0);
  const maxVal = $derived(hasData ? Math.max(...valid.map((p) => p.value)) : 1);
  const valLo = $derived(minVal === maxVal ? minVal - 1 : minVal);
  const valHi = $derived(minVal === maxVal ? maxVal + 1 : maxVal);

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

  const path = $derived(
    hasData
      ? valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
      : ''
  );

  const area = $derived(
    hasData
      ? `${path} L${x(valid[valid.length - 1].ts).toFixed(1)},${(H - padB).toFixed(1)} L${x(valid[0].ts).toFixed(1)},${(H - padB).toFixed(1)} Z`
      : ''
  );

  const yTicks = $derived(
    Array.from({ length: 4 }, (_, i) => {
      const v = valLo + ((valHi - valLo) * i) / 3;
      return { v, y: y(v) };
    })
  );

  const xTicks = $derived(
    hasData
      ? (() => {
          const n = Math.max(3, Math.min(8, Math.floor(plotW / 90)));
          return Array.from({ length: n }, (_, i) => {
            const ts = minTs + ((maxTs - minTs) * i) / (n - 1);
            return { ts, x: x(ts), label: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
          });
        })()
      : []
  );

  const last = $derived(hasData ? valid[valid.length - 1] : null);
</script>

<div class="chart" bind:this={el}>
  <div class="head">
    <span class="title">{title}</span>
    {#if last}
      <span class="val">{last.value.toFixed(1)}<span class="unit">{unit}</span></span>
    {/if}
  </div>

  <svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label={title}>
    {#each yTicks as t}
      <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} class="grid" />
      <text x={padL - 8} y={t.y + 3} class="axis" text-anchor="end">{t.v.toFixed(1)}</text>
    {/each}
    {#each xTicks as t}
      <text x={t.x} y={H - 10} class="axis" text-anchor="middle">{t.label}</text>
    {/each}

    {#if hasData}
      <path d={area} fill={color} fill-opacity="0.12" />
      <path d={path} fill="none" stroke={color} stroke-width="2" />
      {#each valid as p}
        {#if p.failed === 0}
          <circle cx={x(p.ts)} cy={y(p.value)} r="2.5" fill={color} />
        {/if}
      {/each}
    {:else}
      <text x={W / 2} y={H / 2} class="empty" text-anchor="middle">No valid data</text>
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
  .val {
    font-size: 1.1rem;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    margin-left: 0.25rem;
    color: #9ca3af;
    font-size: 0.8rem;
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
</style>
