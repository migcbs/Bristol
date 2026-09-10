"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function RequestAccessButton({
  carpetaId,
  disabled,
  label,
}: {
  carpetaId: string;
  disabled?: boolean;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/portal/material-access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carpetaId, motivo: motivo || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar la solicitud");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-sm">
            <h2 className="font-display text-lg font-semibold text-primary">Solicitar acceso</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted">Motivo (opcional)</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  placeholder="Ej. Necesito el material para preparar mis clases del grupo B..."
                  className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </Button>
              </div>
            </form>
      </Modal>
    </>
  );
}
