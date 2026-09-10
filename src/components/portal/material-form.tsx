"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Two ways to add material — an external link, or a file uploaded from
// the teacher's machine (confirmed with the user 2026-09-09). The upload
// path posts multipart/form-data; the link path keeps the JSON body.
export function MaterialForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"archivo" | "enlace">("archivo");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let res: Response;
      if (mode === "archivo") {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setError("Selecciona un archivo");
          setSubmitting(false);
          return;
        }
        const fd = new FormData();
        fd.append("groupId", groupId);
        fd.append("title", title);
        if (description) fd.append("description", description);
        fd.append("file", file);
        res = await fetch("/api/portal/materials", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/portal/materials", {
          method: "POST",
          body: JSON.stringify({ groupId, title, url, description: description || undefined }),
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo agregar el material");
        return;
      }

      setTitle("");
      setUrl("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("No se pudo agregar el material");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <div className="flex gap-1 rounded-lg bg-surface p-1 text-xs">
        {(["archivo", "enlace"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
              mode === m ? "bg-white text-primary shadow-sm" : "text-muted"
            }`}
          >
            {m === "archivo" ? "Subir archivo" : "Enlace"}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        required
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />

      {mode === "archivo" ? (
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx,.txt"
          className="w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enlace (https://...)"
          required
          type="url"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      )}

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Agregando..." : "Agregar material"}
      </Button>
    </form>
  );
}
