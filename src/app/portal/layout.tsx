import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import { BristolWordmark } from "@/components/ui/bristol-wordmark";

const PORTAL_ROLE_LABELS: Record<string, string> = {
  TEACHER: "Maestro",
  STUDENT: "Alumno",
  PARENT: "Tutor",
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let role: string | undefined;
  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { mustChangePassword: true, role: true },
    });
    if (user?.mustChangePassword) {
      redirect("/cambiar-password");
    }
    role = user?.role;
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white px-4 py-3 shadow-[0_1px_0_rgba(20,20,43,0.04)] sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <BristolWordmark area={role ? PORTAL_ROLE_LABELS[role] : undefined} />
          <div className="flex items-center gap-2 text-sm sm:gap-4">
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
        <PortalNav role={role} />
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
