import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/admin-nav";
import { CommandPalette } from "@/components/admin/command-palette";
import { SpotlightButton } from "@/components/admin/spotlight-button";
import { QuickCreateDrawer } from "@/components/admin/quick-create-drawer";
import { NotificationBell } from "@/components/admin/notification-bell";
import { BristolWordmark } from "@/components/ui/bristol-wordmark";
import { hasModuleAccess, getAreaLabel, type Module } from "@/lib/staff-permissions";
import type { Role } from "@prisma/client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let areaLabel = "";
  if (session?.user) {
    const currentUser = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { mustChangePassword: true, role: true, staffPosition: true },
    });
    if (currentUser?.mustChangePassword) {
      redirect("/cambiar-password");
    }
    if (currentUser) {
      areaLabel = getAreaLabel(currentUser.role, currentUser.staffPosition);
    }
  }

  const scope = session?.user
    ? await getCampusScope(session.user as { id: string; role: Role })
    : undefined;
  const campuses =
    !scope || scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  const ALL_MODULES: Module[] = [
    "admisiones", "cobranzas", "reinscripciones", "incidencias", "comunicaciones",
    "mercadotecnia", "lista_espera", "agenda", "bitacora", "disponibilidad",
    "solicitudes", "tickets", "alta_rapida", "recursos_caja", "biblioteca_material",
    "comercial_directorio", "resenas", "grupos",
  ];

  const accessEntries = session?.user
    ? await Promise.all(
        ALL_MODULES.map(async (m) => [m, await hasModuleAccess(session.user as { id: string; role: Role }, m)] as const)
      )
    : [];
  const accessMap = new Map(accessEntries);
  const visibleModules = new Set<string>(
    [...accessMap.entries()].filter(([, level]) => level !== "none").map(([m]) => m)
  );
  const canQuickCreate = accessMap.get("alta_rapida") !== "none";

  return (
    <div className="min-h-screen bg-surface">
      <CommandPalette />
      <header className="border-b border-border bg-white px-4 py-3 shadow-[0_1px_0_rgba(20,20,43,0.04)] sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <BristolWordmark area={areaLabel} />
          <div className="flex items-center gap-2 text-sm sm:gap-4">
            {/* Opens the Cmd+K spotlight only — this is not a second search
                feature, just a mouse-accessible shortcut to it. */}
            <SpotlightButton />
            {canQuickCreate && <QuickCreateDrawer campuses={campuses} />}
            <NotificationBell />
            {/* Name and "Salir" label hidden below sm — same "icons survive,
                labels drop first" rule BOOZ's topbar uses to stay on one
                row at narrow widths. */}
            <span className="hidden text-muted sm:inline">{session?.user?.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                aria-label="Salir"
                className="flex items-center font-medium text-accent-dark transition-all duration-200 hover:scale-105 hover:text-accent active:scale-95"
              >
                <LogOut className="sm:hidden" size={18} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex">
        <AdminNav visibleModules={visibleModules} />
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
