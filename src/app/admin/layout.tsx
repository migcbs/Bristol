import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/admin-nav";
import { CommandPalette } from "@/components/admin/command-palette";
import { QuickCreateDrawer } from "@/components/admin/quick-create-drawer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen bg-surface">
      <CommandPalette />
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <span className="font-bold text-primary">Bristol Admin</span>
        <div className="flex items-center gap-4 text-sm">
          <QuickCreateDrawer campuses={campuses} />
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
