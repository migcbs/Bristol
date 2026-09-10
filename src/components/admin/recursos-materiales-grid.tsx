"use client";

import { useState } from "react";
import { MapPin, Package } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { SellRecursoModal } from "@/components/admin/sell-recurso-modal";
import { RecursoDetailModal, type RecursoDetail } from "@/components/admin/recurso-detail-modal";
import { formatMoneyMXN } from "@/lib/invoice-status";

interface RecursoRow {
  id: string;
  nombre: string;
  campusId: string;
  campusName: string;
  cantidadDisponible: number;
  precioUnitarioCents: number | null;
  stockMinimo: number;
  totalVendido: number;
  recentSales: { id: string; cantidad: number | null; montoCents: number; createdAt: Date; createdByName: string }[];
}

// Click a card → RecursoDetailModal (stock vs. min, price, sales history,
// restock). The Sell action stays as its own icon button on the card.
export function RecursosMaterialesGrid({ recursos, canEdit }: { recursos: RecursoRow[]; canEdit: boolean }) {
  const [detail, setDetail] = useState<RecursoDetail | null>(null);

  return (
    <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {recursos.map((recurso) => {
        const outOfStock = recurso.cantidadDisponible === 0;
        const lowStock = !outOfStock && recurso.cantidadDisponible <= recurso.stockMinimo;
        return (
          <RecordCard
            key={recurso.id}
            avatarId={recurso.id}
            avatarLabel={recurso.nombre.trim().charAt(0).toUpperCase() || "?"}
            name={recurso.nombre}
            dimmed={outOfStock}
            onClick={() =>
              setDetail({
                id: recurso.id,
                nombre: recurso.nombre,
                campusName: recurso.campusName,
                cantidadDisponible: recurso.cantidadDisponible,
                precioUnitarioCents: recurso.precioUnitarioCents,
                stockMinimo: recurso.stockMinimo,
                totalVendido: recurso.totalVendido,
                recentSales: recurso.recentSales,
                canManage: canEdit,
              })
            }
            meta={
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {recurso.campusName}
              </span>
            }
            tags={
              <>
                <Tag tone={outOfStock ? "red" : lowStock ? "amber" : "green"} icon={Package}>
                  {outOfStock ? "Agotado" : `${recurso.cantidadDisponible} disponibles`}
                </Tag>
                {recurso.precioUnitarioCents != null && (
                  <Tag tone="blue">{formatMoneyMXN(recurso.precioUnitarioCents)}</Tag>
                )}
              </>
            }
            actions={
              canEdit && !outOfStock ? (
                <SellRecursoModal
                  recursoId={recurso.id}
                  recursoNombre={recurso.nombre}
                  campusId={recurso.campusId}
                  precioUnitarioCents={recurso.precioUnitarioCents}
                  cantidadDisponible={recurso.cantidadDisponible}
                />
              ) : undefined
            }
          />
        );
      })}

      {recursos.length === 0 && (
        <p className="col-span-full mt-6 text-center text-sm text-muted">No hay recursos registrados todavía.</p>
      )}

      {detail && <RecursoDetailModal open onClose={() => setDetail(null)} recurso={detail} />}
    </div>
  );
}
