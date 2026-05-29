"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Hand-rolled SVG charts for the "Atelier Pro" system. Each animates **once
 * on mount** (bars scale up, line draws via stroke-dashoffset, donut segments
 * sweep via stroke-dasharray) using the `.tc-chart` rules in globals.css.
 *
 * The data-viz palette (use in series order): slate, sage, gold, clay, plum.
 */
export const DV = {
  gold: "var(--dv-gold)",
  sage: "var(--dv-sage)",
  slate: "var(--dv-slate)",
  clay: "var(--dv-clay)",
  plum: "var(--dv-plum)",
} as const;

// Adds the `rv-on` class on the next frame so the CSS reveal transitions fire.
function useReveal<T extends HTMLElement | SVGElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add("rv-on"))
    );
    return () => cancelAnimationFrame(id);
  }, []);
  return ref;
}

export function Sparkline({
  data,
  w = 120,
  h = 34,
  color = "var(--gold)",
  fill = true,
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
}) {
  const id = useId().replace(/[:]/g, "");
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * w,
    h - 4 - ((v - min) / rng) * (h - 8),
  ]);
  const line = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

export type BarDatum = { label: string; values?: number[]; value?: number };

export function Bars({
  data,
  w = 560,
  h = 200,
  colors = ["var(--gold)", "var(--dv-slate)"],
}: {
  data: BarDatum[];
  w?: number;
  h?: number;
  colors?: string[];
}) {
  const ref = useReveal<SVGSVGElement>();
  const max =
    Math.max(...data.flatMap((d) => d.values ?? [d.value ?? 0])) * 1.12 || 1;
  const pad = 28;
  const bw = (w - pad) / data.length;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg ref={ref} width="100%" viewBox={`0 0 ${w} ${h}`} className="tc-chart">
      {grid.map((g, i) => {
        const y = 10 + (h - 40) * (1 - g);
        return (
          <line
            key={i}
            x1={pad}
            y1={y}
            x2={w}
            y2={y}
            stroke="var(--line-2)"
            strokeWidth="1"
          />
        );
      })}
      {data.map((d, i) => {
        const vals = d.values ?? [d.value ?? 0];
        const gw = bw * 0.62;
        const each = gw / vals.length;
        return vals.map((v, j) => {
          const bh = (h - 40) * (v / max);
          const x = pad + i * bw + bw * 0.19 + j * each;
          const c = colors[j] ?? colors[0];
          return (
            <rect
              key={`${i}-${j}`}
              className="bar"
              x={x}
              y={10 + (h - 40) - bh}
              width={each - 2}
              height={bh}
              rx="3"
              fill={c}
              style={{ transformOrigin: "bottom" }}
            />
          );
        });
      })}
      {data.map((d, i) => (
        <text
          key={`l${i}`}
          x={pad + i * bw + bw * 0.4}
          y={h - 12}
          fontSize="10"
          fill="var(--muted)"
          textAnchor="middle"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

export function AreaLine({
  data,
  w = 560,
  h = 190,
  color = "var(--gold)",
}: {
  data: { label: string; value: number }[];
  w?: number;
  h?: number;
  color?: string;
}) {
  const ref = useReveal<SVGSVGElement>();
  const id = useId().replace(/[:]/g, "");
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value)) * 1.15 || 1;
  const min = 0;
  const pad = 8;
  const iw = w - pad * 2;
  const ih = h - 30;
  const pts = data.map((d, i) => [
    pad + (i / Math.max(1, data.length - 1)) * iw,
    8 + ih - ((d.value - min) / (max - min)) * ih,
  ]);
  const line = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area = line + ` L ${pad + iw} ${8 + ih} L ${pad} ${8 + ih} Z`;
  return (
    <svg ref={ref} width="100%" viewBox={`0 0 ${w} ${h}`} className="tc-chart">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.20" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g, i) => {
        const y = 8 + ih * (1 - g);
        return (
          <line
            key={i}
            x1={pad}
            y1={y}
            x2={w - pad}
            y2={y}
            stroke="var(--line-2)"
          />
        );
      })}
      <path className="area-fill" d={area} fill={`url(#${id})`} />
      <path
        className="area-line"
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="2.4"
          fill="var(--paper)"
          stroke={color}
          strokeWidth="2"
        />
      ))}
      {data.map((d, i) => (
        <text
          key={`x${i}`}
          x={pts[i][0]}
          y={h - 8}
          fontSize="10"
          fill="var(--muted)"
          textAnchor="middle"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

export function Donut({
  data,
  size = 170,
  centerLabel = "TRIPS",
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
}) {
  const ref = useReveal<HTMLDivElement>();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = size / 2;
  const r = R - 15;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div
      ref={ref}
      className="tc-chart"
      style={{ display: "flex", alignItems: "center", gap: 18 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ flex: "none" }}
      >
        <g transform={`rotate(-90 ${R} ${R})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i}
                className="donut-seg"
                cx={R}
                cy={R}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="13"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
                style={{ ["--dash" as string]: dash }}
              />
            );
            acc += frac;
            return el;
          })}
        </g>
        <text
          x={R}
          y={R - 2}
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontSize="26"
          fill="var(--ink)"
        >
          {data.reduce((s, d) => s + d.value, 0)}
        </text>
        <text
          x={R}
          y={R + 15}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="1.5"
          fill="var(--muted)"
        >
          {centerLabel}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{ justifyContent: "space-between", padding: "5px 0" }}
          >
            <span
              className="flex items-center"
              style={{ gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: d.color,
                }}
              />
              {d.label}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--muted)" }}
            >
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
