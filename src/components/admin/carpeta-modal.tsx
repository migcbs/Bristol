"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";

// Two modes in one component: with no `carpetaId`, it's "+ Nueva carpeta"
// (creates a MaterialCarpeta). With a `carpetaId`, it's the small
// "+ Agregar archivo" trigger on that carpeta's row — and that form now
// takes either an uploaded file or an external link (confirmed with the
// user 2026-09-09: "hay que agregar subir contenido desde la máquina
// local").
export function CarpetaModal({
  carpetaId,
  carpetaNombre,
  mode = "create-carpeta",
}: {
  carpetaId?: string;
  carpetaNombre?: string;
  mode?: "create-carpeta" | "add-item";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [itemMode, setItemMode] = useState<"archivo" | "enlace">("archivo");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setNombre("");
    setDescripcion("");
    setTitulo("");
    setUrl("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let res: Response;
    if (mode === "create-carpeta") {
      res = await fetch("/api/admin/material-carpetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion: descripcion || undefined }),
      });
    } else if (itemMode === "archivo") {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setError("Selecciona un archivo");
        setSubmitting(false);
        return;
      }
      const fd = new FormData();
      fd.append("titulo", titulo);
      if (descripcion) fd.append("descripcion", descripcion);
      fd.append("file", file);
      res = await fetch(`/api/admin/material-carpetas/${carpetaId}/items`, { method: "POST", body: fd });
    } else {
      res = await fetch(`/api/admin/material-carpetas/${carpetaId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, url, descripcion: descripcion || undefined }),
      });
    }

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {mode === "create-carpeta" ? (
        <Button onClick={() => setOpen(true)}>+ Nueva carpeta</Button>
      ) : (
        <IconActionButton icon={FilePlus} label="Agregar archivo" onClick={() => setOpen(true)} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">
          {mode === "create-carpeta" ? "Nueva carpeta" : `Agregar a "${carpetaNombre}"`}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === "create-carpeta" ? (
            <div>
              <label className="block text-xs font-medium text-muted">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="mt-1" />
            </div>
          ) : (
            <>
              <div className="flex gap-1 rounded-lg bg-surface p-1 text-xs">
                {(["archivo", "enlace"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setItemMode(m)}
                    className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                      itemMode === m ? "bg-white text-primary shadow-sm" : "text-muted"
                    }`}
                  >
                    {m === "archivo" ? "Subir archivo" : "Enlace"}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Título</label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required className="mt-1" />
              </div>
              {itemMode === "archivo" ? (
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.txt"
                  className="w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
              ) : (
                <Input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              )}
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-muted">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="text-xs text-accent-dark">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
