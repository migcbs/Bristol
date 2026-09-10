import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { ADMIN_MODULES } from "@/lib/admin-modules";

// Fallback for ADMIN or a STAFF account with no puesto yet — an icon-led
// quick-action grid instead of the old text-only stub, built from the same
// module→icon map the nav uses so it's never out of sync with what that
// account can actually see.
export function GenericDashboard({
  userId,
  name,
  visibleModules,
  // When embedded under another dashboard (ADMIN analytics home) the
  // greeting and pending banner are already shown above — skip them.
  bare = false,
}: {
  userId: string;
  name: string;
  visibleModules: Set<string>;
  bare?: boolean;
}) {
  const tiles = ADMIN_MODULES.filter((mod) => visibleModules.has(mod.module));

  return (
    <div>
      {!bare && (
        <>
          <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="¿A dónde quieres ir?" />
          <PendingBanner userId={userId} />
        </>
      )}

      {tiles.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Todavía no tienes ningún módulo asignado — pide a Dirección de Campus que te dé un puesto.
        </p>
      ) : (
        <RevealGrid className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((mod) => (
            <QuickActionTile key={mod.href} href={mod.href} icon={mod.icon} label={mod.label} />
          ))}
        </RevealGrid>
      )}
    </div>
  );
}
