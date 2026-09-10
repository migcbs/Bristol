"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Eye, Download, FileCheck, FileX } from "lucide-react";
import type { StudentDocumentType } from "@prisma/client";

const TYPE_LABELS: Record<StudentDocumentType, string> = {
  ACTA: "Acta de nacimiento",
  CURP: "CURP",
  COMPROBANTE: "Comprobante de domicilio",
};

// Replaces the old plain checkbox ("son solo como etiquetas que no hacen
// nada" — the user's words, 2026-09-09): a real upload button plus
// ver/descargar once a file exists. Used both in AlumnoEditModal (upload
// enabled) and AlumnoViewModal (read-only — pass canUpload={false}).
export function StudentDocumentField({
  studentId,
  tipo,
  entregado,
  canUpload,
}: {
  studentId: string;
  tipo: StudentDocumentType;
  entregado: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("tipo", tipo);
    formData.append("file", file);
    const res = await fetch(`/api/admin/students/${studentId}/documents`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir el archivo");
      return;
    }
    router.refresh();
  }

  const viewUrl = `/api/admin/students/${studentId}/documents/${tipo}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 text-sm">
        {entregado ? <FileCheck size={16} className="text-emerald-600" /> : <FileX size={16} className="text-muted" />}
        <span className={entregado ? "text-text" : "text-muted"}>{TYPE_LABELS[tipo]}</span>
      </div>
      <div className="flex items-center gap-1">
        {entregado && (
          <>
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ver ${TYPE_LABELS[tipo]}`}
              title="Ver"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Eye size={15} />
            </a>
            <a
              href={`${viewUrl}?download=1`}
              aria-label={`Descargar ${TYPE_LABELS[tipo]}`}
              title="Descargar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Download size={15} />
            </a>
          </>
        )}
        {canUpload && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label={entregado ? `Reemplazar ${TYPE_LABELS[tipo]}` : `Subir ${TYPE_LABELS[tipo]}`}
              title={entregado ? "Reemplazar" : "Subir"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
            >
              <Upload size={15} />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelected}
            />
          </>
        )}
      </div>
      {error && <p className="w-full text-xs text-accent-dark">{error}</p>}
    </div>
  );
}
