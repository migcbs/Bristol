"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Users, Eye, Download, Trash2 } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { Modal } from "@/components/ui/modal";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { CarpetaModal } from "@/components/admin/carpeta-modal";

interface LibraryItem {
  id: string;
  titulo: string;
  url: string;
  descripcion: string | null;
}

// Clicking the carpeta card opens a real viewer — confirmed with the user
// 2026-09-09: "ahorita solo se ve que está un archivo pero no se puede ver
// ni descargar... al darle click a la tarjeta debe desplegar un pop-up
// donde se pueda ver el material... ver y descargar y solo el admin
// podría eliminar". Items are stored as a URL (often an external link,
// e.g. Google Drive) rather than an uploaded file, so "descargar" is a
// best-effort `download` attribute — it only forces a real download for a
// same-origin file; for an external link the browser just navigates,
// same as "ver".
export function CarpetaCard({
  carpetaId,
  carpetaNombre,
  descripcion,
  createdByName,
  pendingRequestCount,
  items,
  isAdmin,
}: {
  carpetaId: string;
  carpetaNombre: string;
  descripcion: string | null;
  createdByName: string;
  pendingRequestCount: number;
  items: LibraryItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    await fetch(`/api/admin/material-carpetas/${carpetaId}/items/${itemId}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  return (
    <>
      <RecordCard
        avatarId={carpetaId}
        avatarLabel={carpetaNombre.trim().charAt(0).toUpperCase() || "?"}
        name={carpetaNombre}
        onClick={() => setOpen(true)}
        meta={
          <>
            {descripcion && <span className="truncate">{descripcion}</span>}
            <span>Creada por {createdByName}</span>
          </>
        }
        tags={
          <>
            <Tag tone="blue" icon={FileText}>
              {items.length} archivo(s)
            </Tag>
            {pendingRequestCount > 0 && (
              <Tag tone="amber" icon={Users}>
                {pendingRequestCount} solicitud(es)
              </Tag>
            )}
          </>
        }
        actions={<CarpetaModal carpetaId={carpetaId} carpetaNombre={carpetaNombre} mode="add-item" />}
      />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-lg">
        <h2 className="font-display text-lg font-semibold text-primary">{carpetaNombre}</h2>
        {descripcion && <p className="text-sm text-muted">{descripcion}</p>}

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.titulo}</p>
                {item.descripcion && <p className="mt-0.5 truncate text-xs text-muted">{item.descripcion}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Ver"
                  aria-label={`Ver ${item.titulo}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Eye size={15} />
                </a>
                <a
                  href={item.url}
                  download
                  title="Descargar"
                  aria-label={`Descargar ${item.titulo}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Download size={15} />
                </a>
                {isAdmin && (
                  <IconActionButton
                    icon={Trash2}
                    label="Eliminar"
                    tone="danger"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                  />
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted">Esta carpeta todavía no tiene archivos.</p>}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
}
