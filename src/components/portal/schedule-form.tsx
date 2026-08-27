"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function ScheduleForm({ groupId, initialSlots }: { groupId: string; initialSlots: Slot[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initialSlots.length > 0 ? initialSlots : [{ dayOfWeek: 1, startTime: "16:00", endTime: "18:00" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    setSlots((prev) => [...prev, { dayOfWeek: 1, startTime: "16:00", endTime: "18:00" }]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/schedule", {
        method: "POST",
        body: JSON.stringify({ groupId, slots }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar el horario");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo guardar el horario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={slot.dayOfWeek}
            onChange={(e) => updateSlot(i, { dayOfWeek: Number(e.target.value) })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {DAY_LABELS.map((label, day) => (
              <option key={day} value={day}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slot.startTime}
            onChange={(e) => updateSlot(i, { startTime: e.target.value })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted">a</span>
          <input
            type="time"
            value={slot.endTime}
            onChange={(e) => updateSlot(i, { endTime: e.target.value })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeSlot(i)}
            className="text-sm text-accent-dark"
          >
            Quitar
          </button>
        </div>
      ))}
      <button type="button" onClick={addSlot} className="text-sm text-primary underline">
        + Agregar bloque
      </button>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar horario"}
        </Button>
      </div>
    </form>
  );
}
