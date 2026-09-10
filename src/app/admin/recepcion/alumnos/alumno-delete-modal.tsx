"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";

// Deleting a student's account is destructive. Per the user's instruction:
// whoever isn't ADMIN must have an actual administrator type their
// password in right here to approve it — an ADMIN deleting directly skips
// that (redundant with their own session). See DELETE
// /api/admin/students/[id] for the server-side check.
export function AlumnoDeleteModal({
  studentId,
  studentName,
  isAdmin,
}: {
  studentId: string;
  studentName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: isAdmin ? undefined : JSON.stringify({ adminEmail, adminPassword }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo eliminar");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <IconActionButton icon={Trash2} label="Eliminar" tone="danger" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-accent-dark">Eliminar a {studentName}</h2>
            <p className="mt-2 text-sm text-muted">
              Esto elimina su cuenta y todo lo relacionado (inscripciones, cargos, incidencias, bitácora de
              reenganche). No se puede deshacer.
            </p>

            {!isAdmin && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Requiere aprobación de un administrador
                </p>
                <Input
                  type="email"
                  placeholder="Correo del administrador"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Contraseña del administrador"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            )}

            {error && <p className="mt-3 text-sm text-accent-dark">{error}</p>}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onClick={handleDelete}
                disabled={submitting || (!isAdmin && (!adminEmail || !adminPassword))}
              >
                {submitting ? "Eliminando..." : "Eliminar definitivamente"}
              </Button>
            </div>
      </Modal>
    </>
  );
}
