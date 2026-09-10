import { clsx } from "clsx";

// Dependency-free SVG charts for the área dashboards (added 2026-09-09 when
// the user asked for "analíticos y gráficas" on every inicio). No chart
// library — these are small, theme-aware (Tailwind fill-/stroke- classes),
// and responsive via viewBox. Server-component safe (no "use client").

export interface BarDatum {
  label: string;
  value: number;
  /** Tailwind fill-* class for this bar; defaults to fill-primary. */
  colorClass?: string;
}

// Horizontal bars — reads well with long category labels and few rows.
export function BarChart({
  data,
  format = (n) => String(n),
  className,
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className={clsx("text-sm text-muted", className)}>Sin datos todavía.</p>;
  }
  return (
    <div className={clsx("space-y-2", className)}>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-xs text-muted" title={d.label}>
            {d.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-surface">
            <div
              className={clsx("h-full rounded", d.colorClass ?? "bg-primary")}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Column chart — better for a time series (days, weeks, months) where the
// x-axis order matters and labels are short.
export function ColumnChart({
  data,
  format = (n) => String(n),
  height = 140,
  className,
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className={clsx("text-sm text-muted", className)}>Sin datos todavía.</p>;
  }
  return (
    <div className={clsx("flex items-end gap-1.5", className)} style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium tabular-nums text-muted">{d.value > 0 ? format(d.value) : ""}</span>
          <div
            className={clsx("w-full rounded-t", d.colorClass ?? "bg-primary")}
            style={{ height: `${Math.max(2, (d.value / max) * (height - 34))}px` }}
          />
          <span className="w-full truncate text-center text-[10px] text-muted" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// Single-series line/area trend. `points` are y-values in order.
export function LineChart({
  points,
  labels,
  format = (n) => String(n),
  height = 120,
  className,
}: {
  points: number[];
  labels?: string[];
  format?: (n: number) => string;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) {
    return <p className={clsx("text-sm text-muted", className)}>Datos insuficientes para la tendencia.</p>;
  }
  const w = 300;
  const h = height;
  const pad = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Tendencia">
        <path d={area} className="fill-primary/10" />
        <path d={line} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} className="fill-primary" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{labels?.[0] ?? format(points[0])}</span>
        <span>{labels?.[labels.length - 1] ?? format(points[points.length - 1])}</span>
      </div>
    </div>
  );
}

// Donut for a single proportion (e.g. asistencia 87%) or a small set of
// slices. Pass `slices` for multi-segment; pass `value`/`total` for one.
export function DonutChart({
  value,
  total,
  slices,
  centerLabel,
  size = 120,
  className,
}: {
  value?: number;
  total?: number;
  slices?: { label: string; value: number; colorClass?: string }[];
  centerLabel?: string;
  size?: number;
  className?: string;
}) {
  const data =
    slices ??
    (value !== undefined && total !== undefined
      ? [
          { label: "Sí", value, colorClass: "text-primary" },
          { label: "Resto", value: Math.max(0, total - value), colorClass: "text-border" },
        ]
      : []);
  const sum = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 45;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const PALETTE = ["text-primary", "text-accent", "text-emerald-500", "text-amber-500", "text-purple-500"];
  return (
    <div className={clsx("flex items-center gap-4", className)}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label="Distribución">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-surface" strokeWidth={14} />
        {data.map((d, i) => {
          const frac = d.value / sum;
          const dash = frac * c;
          const el = (
            <circle
              key={d.label}
              cx="60"
              cy="60"
              r={r}
              className={clsx("fill-none", d.colorClass ?? PALETTE[i % PALETTE.length])}
              stroke="currentColor"
              strokeWidth={14}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
        {centerLabel && (
          <text
            x="60"
            y="60"
            className="rotate-90 fill-text text-[18px] font-bold"
            textAnchor="middle"
            dominantBaseline="central"
            transform="rotate(90 60 60)"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      {slices && (
        <ul className="space-y-1 text-xs">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5 text-muted">
              <span className={clsx("h-2.5 w-2.5 rounded-full bg-current", s.colorClass ?? PALETTE[i % PALETTE.length])} />
              {s.label} <span className="font-semibold tabular-nums text-text">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
