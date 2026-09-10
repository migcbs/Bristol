"use client";

import { useMemo } from "react";
import { clsx } from "clsx";

export interface ScheduleBlock {
  id: string;
  /** 0 = Sunday … 6 = Saturday (matches ScheduleSlot.dayOfWeek). */
  dayOfWeek: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  label: string;
  sublabel?: string;
  /** Groups blocks that should share a colour (e.g. one per child). */
  colorKey?: string;
}

// Fixed palette so a given colorKey is stable across renders. Tailwind
// needs literal class names, hence the explicit map.
const PALETTE = [
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-900", dot: "bg-blue-500" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-500" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900", dot: "bg-amber-500" },
  { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-900", dot: "bg-purple-500" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-900", dot: "bg-rose-500" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-900", dot: "bg-cyan-500" },
];

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// A Google-Calendar-style week view for recurring class schedules
// (ScheduleSlot). The user asked (2026-09-09) for teacher/student/parent
// portals to see their weekly schedule as a calendar, and for a parent
// with several enrolled children to tell them apart by colour.
export function WeekSchedule({
  blocks,
  legend,
}: {
  blocks: ScheduleBlock[];
  legend?: { label: string; colorKey: string }[];
}) {
  const colorFor = useMemo(() => {
    const keys = Array.from(
      new Set([...(legend?.map((l) => l.colorKey) ?? []), ...blocks.map((b) => b.colorKey ?? "default")])
    );
    const map = new Map<string, (typeof PALETTE)[number]>();
    keys.forEach((k, i) => map.set(k, PALETTE[i % PALETTE.length]));
    return (key?: string) => map.get(key ?? "default") ?? PALETTE[0];
  }, [blocks, legend]);

  const days = useMemo(() => {
    const present = new Set(blocks.map((b) => b.dayOfWeek));
    // Always show Mon–Sat; add Sunday only if something lands there.
    const base = [1, 2, 3, 4, 5, 6];
    return present.has(0) ? [...base, 0] : base;
  }, [blocks]);

  const { startMin, endMin } = useMemo(() => {
    if (blocks.length === 0) return { startMin: 7 * 60, endMin: 21 * 60 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of blocks) {
      lo = Math.min(lo, toMinutes(b.startTime));
      hi = Math.max(hi, toMinutes(b.endTime));
    }
    // Pad to whole hours with a little breathing room.
    return { startMin: Math.floor((lo - 30) / 60) * 60, endMin: Math.ceil((hi + 30) / 60) * 60 };
  }, [blocks]);

  const totalMin = Math.max(60, endMin - startMin);
  const PX_PER_MIN = 0.9;
  const gridHeight = totalMin * PX_PER_MIN;

  const hourLines = useMemo(() => {
    const lines: number[] = [];
    for (let m = startMin; m <= endMin; m += 60) lines.push(m);
    return lines;
  }, [startMin, endMin]);

  if (blocks.length === 0) {
    return <p className="text-sm text-muted">No hay clases en el horario.</p>;
  }

  return (
    <div className="space-y-3">
      {legend && legend.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {legend.map((l) => (
            <span key={l.colorKey} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className={clsx("h-2.5 w-2.5 rounded-full", colorFor(l.colorKey).dot)} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <div className="min-w-[560px]">
          {/* Header */}
          <div
            className="grid border-b border-border text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
            style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
          >
            <div className="py-2" />
            {days.map((d) => (
              <div key={d} className="border-l border-border py-2">
                {DAY_LABELS[d]}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: gridHeight }}>
              {hourLines.map((m) => (
                <div
                  key={m}
                  className="absolute -translate-y-1/2 pr-1 text-right text-[10px] tabular-nums text-muted"
                  style={{ top: (m - startMin) * PX_PER_MIN, right: 0 }}
                >
                  {String(Math.floor(m / 60)).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => {
              const dayBlocks = blocks.filter((b) => b.dayOfWeek === d);
              return (
                <div key={d} className="relative border-l border-border" style={{ height: gridHeight }}>
                  {hourLines.slice(1).map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-border/60"
                      style={{ top: (m - startMin) * PX_PER_MIN }}
                    />
                  ))}
                  {dayBlocks.map((b) => {
                    const top = (toMinutes(b.startTime) - startMin) * PX_PER_MIN;
                    const height = Math.max(18, (toMinutes(b.endTime) - toMinutes(b.startTime)) * PX_PER_MIN);
                    const c = colorFor(b.colorKey);
                    return (
                      <div
                        key={b.id}
                        className={clsx(
                          "absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight",
                          c.bg,
                          c.border,
                          c.text
                        )}
                        style={{ top, height }}
                      >
                        <p className="font-semibold">
                          {b.startTime}–{b.endTime}
                        </p>
                        <p className="truncate">{b.label}</p>
                        {b.sublabel && <p className="truncate opacity-80">{b.sublabel}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
