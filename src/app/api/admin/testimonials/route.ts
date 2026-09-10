import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role, TestimonialStatus } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

const VALID_STATUSES: TestimonialStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "resenas");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") ?? "PENDING";
  if (!VALID_STATUSES.includes(statusParam as TestimonialStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  const testimonials = await prisma.testimonial.findMany({
    where: { status: statusParam as TestimonialStatus },
    orderBy: { createdAt: statusParam === "PENDING" ? "asc" : "desc" },
    include: { reviewedBy: { select: { name: true } } },
  });

  return Response.json(testimonials);
}
