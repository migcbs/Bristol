import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/admin-nav";
import { CommandPalette } from "@/components/admin/command-palette";
import { QuickCreateDrawer } from "@/components/admin/quick-create-drawer";
import { NotificationBell } from "@/components/admin/notification-bell";
import type { Role } from "@prisma/client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const scope = session?.user
    ? await getCampusScope(session.user as { id: string; role: Role })
    : undefined;
  const campuses =
    !scope || scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  return (
    <div className="min-h-screen bg-surface">
      <CommandPalette />
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <span className="font-bold text-primary">Bristol Admin</span>
        <div className="flex items-center gap-4 text-sm">
          <QuickCreateDrawer campuses={campuses} />
          <NotificationBell />
          <span>{session?.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="text-accent">Salir</button>
          </form>
        </div>
      </header>
      <AdminNav />
      <main className="p-6">{children}</main>
    </div>
  );
}
