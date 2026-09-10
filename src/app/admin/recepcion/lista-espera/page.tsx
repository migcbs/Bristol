import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import type { Role } from "@prisma/client";
import { WaitlistBoard } from "./waitlist-board";

export default async function ListaEsperaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  // This page previously had no module check at all — any STAFF account
  // could open it regardless of puesto. Lista de Espera is Comercial's
  // (confirmed with the user 2026-09-09); gating it here for the first time.
  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "lista_espera");
  if (access === "none") redirect("/admin");

  return <WaitlistBoard readOnly={access !== "full"} />;
}
