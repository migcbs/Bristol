import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasModuleAccess, type Module } from "@/lib/staff-permissions";
import { RecepcionDashboard } from "./_dashboards/recepcion-dashboard";
import { CajaDashboard } from "./_dashboards/caja-dashboard";
import { ComercialDashboard } from "./_dashboards/comercial-dashboard";
import { ControlEscolarDashboard } from "./_dashboards/control-escolar-dashboard";
import { CalidadControlDashboard } from "./_dashboards/calidad-control-dashboard";
import { DireccionCampusDashboard } from "./_dashboards/direccion-campus-dashboard";
import { CompanyAnalyticsDashboard } from "./_dashboards/company-analytics-dashboard";
import { GenericDashboard } from "./_dashboards/generic-dashboard";
import type { Role } from "@prisma/client";

// Which puesto sees which bespoke dashboard — everyone else (ADMIN, or a
// STAFF account with no puesto yet) gets GenericDashboard's icon grid
// instead of a stub paragraph, per the user's request 2026-09-09 for
// something more visual and self-explanatory than the old text-only home
// page. All six puestos have their own dashboard as of 2026-09-09.
export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const user = session.user as { id: string; role: Role; name: string };
  const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { staffPosition: true } });

  if (currentUser?.staffPosition === "RECEPCION") {
    return <RecepcionDashboard user={{ id: user.id, role }} name={user.name} />;
  }
  if (currentUser?.staffPosition === "CAJA") {
    return <CajaDashboard user={{ id: user.id, role }} name={user.name} />;
  }
  if (currentUser?.staffPosition === "COMERCIAL") {
    return <ComercialDashboard user={{ id: user.id, role }} name={user.name} />;
  }
  if (currentUser?.staffPosition === "CONTROL_ESCOLAR") {
    return <ControlEscolarDashboard user={{ id: user.id, role }} name={user.name} />;
  }
  if (currentUser?.staffPosition === "CALIDAD_CONTROL") {
    return <CalidadControlDashboard user={{ id: user.id, role }} name={user.name} />;
  }
  if (currentUser?.staffPosition === "DIRECCION_CAMPUS") {
    return <DireccionCampusDashboard user={{ id: user.id, role }} name={user.name} />;
  }

  const ALL_MODULES: Module[] = [
    "admisiones", "cobranzas", "reinscripciones", "incidencias", "comunicaciones",
    "mercadotecnia", "lista_espera", "agenda", "bitacora", "disponibilidad",
    "solicitudes", "tickets", "alta_rapida", "recursos_caja", "biblioteca_material",
    "comercial_directorio", "resenas", "grupos",
  ];
  const accessEntries = await Promise.all(
    ALL_MODULES.map(async (m) => [m, await hasModuleAccess({ id: user.id, role }, m)] as const)
  );
  const visibleModules = new Set<string>(accessEntries.filter(([, level]) => level !== "none").map(([m]) => m));

  // ADMIN sees the company-wide analytics (split by campus) first, then
  // the full module grid for navigation. A STAFF account with no puesto
  // assigned yet just gets the grid.
  if (role === "ADMIN") {
    return (
      <div className="space-y-10">
        <CompanyAnalyticsDashboard name={user.name} />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Módulos</h2>
          <div className="mt-3">
            <GenericDashboard userId={user.id} name={user.name} visibleModules={visibleModules} bare />
          </div>
        </div>
      </div>
    );
  }

  return <GenericDashboard userId={user.id} name={user.name} visibleModules={visibleModules} />;
}
