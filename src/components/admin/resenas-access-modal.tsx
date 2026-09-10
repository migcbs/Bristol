"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  staffPosition: string | null;
  hasAccess: boolean;
}

// ADMIN-only popup: grants or revokes "resenas" access to a specific
// account, independent of their puesto — the mechanism the user asked for
// after seeing Cibercom's SistemaEmpleados (a superadmin handing out
// one-off permissions rather than everything flowing from a fixed role).
export function ResenasAccessModal({ staff }: { staff: StaffAccount[] }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState(staff);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(staff);
  }, [staff]);

  async function toggle(account: StaffAccount) {
    setPendingId(account.id);
    setError(null);
    const res = await fetch(`/api/admin/staff/${account.id}/extra-access`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "resenas", grant: !account.hasAccess }),
    });
    setPendingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar el acceso");
      return;
    }
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, hasAccess: !a.hasAccess } : a)));
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Gestionar acceso
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Acceso a Reseñas</h2>
            <p className="mt-1 text-xs text-muted">
              Reseñas es solo para el administrador y las cuentas a las que se les dé acceso aquí — no depende del
              puesto.
            </p>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <span>
                    <span className="block text-sm font-medium">{account.name}</span>
                    <span className="block text-xs text-muted">
                      {account.email}
                      {account.staffPosition && ` · ${account.staffPosition}`}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={account.hasAccess}
                    disabled={pendingId === account.id}
                    onChange={() => toggle(account)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              ))}
              {accounts.length === 0 && <p className="text-sm text-muted">No hay cuentas de staff.</p>}
            </div>

            {error && <p className="mt-3 text-sm text-accent-dark">{error}</p>}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
      </Modal>
    </>
  );
}
