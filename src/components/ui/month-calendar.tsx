"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  /** Tailwind bg/border classes for the chip, e.g. "bg-blue-100 text-blue-800". */
  toneClass?: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// A Google-Calendar-style month grid — modeled on BOOZ's CoachCalendar
// (confirmed with the user 2026-09-09). Reused by Agenda, Bitácora and
// Incidencias. Click a day to create, click an event chip to open it.
export function MonthCalendar({
  events,
  onDayClick,
  onEventClick,
  initialMonth,
}: {
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (id: string) => void;
  initialMonth?: Date;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = initialMonth ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Monday-first: JS getDay() has Sunday=0, so shift.
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const today = new Date();

  function eventsOn(day: Date) {
    return events
      .filter((e) => sameDay(new Date(e.date), day))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return (
    <div className="rounded-2xl border border-border bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-display text-base font-semibold capitalize text-primary">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-primary"
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-border text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          const dayEvents = eventsOn(day);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(day)}
              className={clsx(
                "min-h-[92px] border-b border-r border-border p-1.5 text-left align-top transition-colors last:border-r-0",
                !inMonth && "bg-surface/60 text-muted",
                onDayClick && "hover:bg-primary/5",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <span
                className={clsx(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-primary font-semibold text-primary-foreground" : "text-inherit"
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    role={onEventClick ? "button" : undefined}
                    onClick={(ev) => {
                      if (!onEventClick) return;
                      ev.stopPropagation();
                      onEventClick(e.id);
                    }}
                    className={clsx(
                      "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                      e.toneClass ?? "bg-primary/10 text-primary",
                      onEventClick && "cursor-pointer"
                    )}
                  >
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1.5 text-[10px] text-muted">+{dayEvents.length - 3} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
