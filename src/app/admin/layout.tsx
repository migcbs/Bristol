import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <span className="font-bold text-primary">Bristol Admin</span>
        <div className="flex items-center gap-4 text-sm">
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
