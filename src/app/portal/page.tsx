import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeacherDashboard } from "./_dashboards/teacher-dashboard";
import { StudentDashboard } from "./_dashboards/student-dashboard";
import { ParentDashboard } from "./_dashboards/parent-dashboard";
import type { Role } from "@prisma/client";

// A per-role home dashboard, same pattern as /admin's per-puesto ones —
// replaces the old "Spec 3" text stub. Built 2026-09-09 as the portal half
// of "...tambien quiero que lo apliques en todas las ventanas de las
// diferentes áreas, desde el admin ... hasta el alumno que es el nivel mas
// bajo" (the admin side already got its dashboards and motion language
// earlier the same day).
export default async function PortalHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = session.user as { id: string; name: string };

  if (role === "TEACHER") return <TeacherDashboard userId={user.id} name={user.name} />;
  if (role === "STUDENT") return <StudentDashboard userId={user.id} name={user.name} />;
  return <ParentDashboard userId={user.id} name={user.name} />;
}
