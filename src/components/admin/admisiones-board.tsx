"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, XCircle } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { LeadRowActions } from "@/components/admin/lead-row-actions";
import { InscribirLeadModal } from "@/components/admin/inscribir-lead-modal";
import { TurnarLeadModal } from "@/components/admin/turnar-lead-modal";
import { LEAD_STATUS_LABELS } from "@/lib/lead-status";
import type { LeadStatus } from "@prisma/client";

const LEAD_TAG_TONE: Record<LeadStatus, "blue" | "green" | "amber" | "gray"> = {
  NEW: "blue",
  CONTACTED: "amber",
  PLACEMENT_SCHEDULED: "amber",
  ENROLLED: "green",
  LOST: "gray",
};

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: LeadStatus;
  campusId: string | null;
  asesorAsignadoId: string | null;
  createdAt: Date;
  campus: { name: string } | null;
}

export type AdmisionesFilter = "activos" | "todos" | LeadStatus;
type Filter = AdmisionesFilter;

// "Ya tengo el lead pero qué hago con eso?" — confirmed with the user
// 2026-09-09: Rechazados needed to be its own isolated view instead of
// sitting mixed into one flat list, and each lead needed real actions
// (Rechazar / Inscribir / Turnar a otra área), not just a status dropdown.
export function AdmisionesBoard({
  leads,
  campuses,
  advisors,
  allStaff,
  initialFilter,
}: {
  leads: LeadRow[];
  campuses: { id: string; name: string }[];
  advisors: { id: string; name: string }[];
  allStaff: { id: string; name: string }[];
  initialFilter?: Filter;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "activos");

  async function rejectLead(id: string) {
    await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LOST" }),
    });
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !q || lead.name.toLowerCase().includes(q) || lead.email.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === "activos") return lead.status !== "LOST" && lead.status !== "ENROLLED";
      if (filter === "todos") return true;
      return lead.status === filter;
    });
  }, [leads, search, filter]);

  const TABS: { id: Filter; label: string }[] = [
    { id: "activos", label: "Activos" },
    { id: "NEW", label: "Nuevos" },
    { id: "CONTACTED", label: "Contactados" },
    { id: "PLACEMENT_SCHEDULED", label: "Examen agendado" },
    { id: "ENROLLED", label: "Inscritos" },
    { id: "LOST", label: "Rechazados" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-xl border border-border py-2.5 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === t.id ? "bg-white text-primary shadow-sm" : "text-muted hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((lead) => (
          <RecordCard
            key={lead.id}
            avatarId={lead.id}
            avatarLabel={lead.name.trim().charAt(0).toUpperCase() || "?"}
            name={lead.name}
            dimmed={lead.status === "LOST"}
            meta={
              <>
                <span className="flex items-center gap-1 truncate">
                  <Mail size={11} /> {lead.email}
                </span>
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} /> {lead.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {lead.campus?.name ?? "Sin asignar"}
                </span>
                <span>{lead.createdAt.toLocaleDateString("es-MX")}</span>
              </>
            }
            tags={
              <>
                <Tag tone={LEAD_TAG_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Tag>
                <div className="w-full">
                  <LeadRowActions
                    leadId={lead.id}
                    initialStatus={lead.status}
                    initialCampusId={lead.campusId}
                    campuses={campuses}
                    initialAsesorAsignadoId={lead.asesorAsignadoId}
                    advisors={advisors}
                  />
                </div>
              </>
            }
            actions={
              lead.status !== "LOST" && lead.status !== "ENROLLED" ? (
                <>
                  <InscribirLeadModal
                    leadId={lead.id}
                    leadName={lead.name}
                    leadEmail={lead.email}
                    campuses={campuses}
                    defaultCampusId={lead.campusId}
                  />
                  <TurnarLeadModal leadId={lead.id} leadName={lead.name} staff={allStaff} />
                  <IconActionButton
                    icon={XCircle}
                    label="Rechazar"
                    tone="danger"
                    onClick={() => rejectLead(lead.id)}
                  />
                </>
              ) : undefined
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          {leads.length === 0 ? "No hay leads que mostrar todavía." : "Ningún lead coincide con este filtro."}
        </p>
      )}
    </div>
  );
}
