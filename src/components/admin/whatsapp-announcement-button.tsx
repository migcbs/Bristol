"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface Recipient {
  name: string;
  phone: string;
}

// Builds a wa.me deep link. Assumes MX (+52) when the stored number has
// no country code — the school is in Veracruz, all its numbers are
// Mexican; a stored "+1..." or "521..." is left as-is.
function waLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCc = digits.startsWith("52") ? digits : `52${digits}`;
  return `https://wa.me/${withCc}?text=${encodeURIComponent(message)}`;
}

// "Botón de whatsapp para poder mandar el anuncio igual por whatsapp" —
// confirmed with the user 2026-09-09, with the constraint stated up front:
// no WhatsApp Business API is configured, so this opens WhatsApp with the
// message pre-filled (one recipient per click) rather than sending in
// bulk, and only students have a number on file — for parents/teachers,
// the "Copiar mensaje" button is the realistic path (paste into their
// group).
export function WhatsAppAnnouncementButton({ announcementId }: { announcementId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/announcements/${announcementId}/whatsapp`);
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cargar");
      return;
    }
    const data = await res.json();
    setMessage(data.message);
    setRecipients(data.recipients ?? []);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50"
      >
        <MessageCircle size={14} /> WhatsApp
      </button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">Enviar por WhatsApp</h2>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Cargando destinatarios...</p>
        ) : error ? (
          <p className="mt-4 text-sm text-accent-dark">{error}</p>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-border bg-surface p-3">
              <p className="whitespace-pre-wrap text-sm">{message}</p>
              <button
                type="button"
                onClick={copyMessage}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar mensaje"}
              </button>
            </div>

            <p className="mt-4 text-xs text-muted">
              Solo los alumnos tienen número registrado en el sistema. Para papás y docentes, copia el mensaje y pégalo
              en su grupo de WhatsApp.
            </p>

            {recipients.length > 0 ? (
              <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
                {recipients.map((r, i) => (
                  <a
                    key={i}
                    href={waLink(r.phone, message)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    <span>{r.name}</span>
                    <span className="flex items-center gap-1 text-xs text-emerald-700">
                      <MessageCircle size={13} /> Abrir
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Ningún alumno de esta audiencia tiene número de celular registrado.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
