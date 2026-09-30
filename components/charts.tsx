"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const short = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

/** Round axis: step is 1/2/2.5/5 × 10^n so tick labels stay readable. */
function niceScale(v: number, ticks = 4) {
  if (v <= 0) return { max: 100, step: 25 };
  const raw = v / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  return { max: Math.ceil(v / step) * step, step };
}

/** Single-series vertical bar chart (e.g. top-up volume per day) with hover tooltip. */
export function BarChart({ data, height = 220, format = money }: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 44;
  const padB = 24;
  const padT = 8;
  const { max, step: tickStep } = niceScale(Math.max(...data.map((d) => d.value), 0));
  const innerW = W - padL - 4;
  const innerH = height - padB - padT;
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.max(2, Math.min(28, step - 2)); // 2px gap between adjacent bars
  const ticks = Array.from({ length: Math.round(max / tickStep) + 1 }, (_, i) => i * tickStep);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(W / 80)));
  const fmtDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : s);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" aria-label={`Bar chart, total ${format(total)}`}>
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line className="gridline" x1={padL} x2={W} y1={y} y2={y} />
              <text className="axis-label" x={padL - 8} y={y + 4} textAnchor="end">
                {short(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect className="bar-hit" x={padL + i * step} y={padT} width={step} height={innerH} />
              {h > 0 && (
                <path
                  className="bar"
                  style={{ opacity: hover === null || hover === i ? 1 : 0.55 }}
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                />
              )}
              {i % labelEvery === 0 && (
                <text className="axis-label" x={padL + i * step + step / 2} y={height - 6} textAnchor="middle">
                  {fmtDay(d.label)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="chart-tip"
          style={{
            left: padL + hover * step + step / 2,
            top: padT + innerH - (data[hover].value / max) * innerH,
          }}
        >
          <b>{format(data[hover].value)}</b> · {fmtDay(data[hover].label)}
        </div>
      )}
    </div>
  );
}

/** Horizontal ranked bars (by platform / manager / client). Values are direct-labeled. */
export function HBars({ data, format = money, empty = "No data for this period" }: { data: { label: ReactNode; value: number; key?: string | number }[]; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max === 0) return <div className="empty small">{empty}</div>;
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar" key={d.key ?? i} title={format(d.value)}>
          <div className="ellipsis">{d.label}</div>
          <div className="track">
            <div className="fill" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
          <div className="val">{format(d.value)}</div>
        </div>
      ))}
    </div>
  );
}
