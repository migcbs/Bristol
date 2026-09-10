import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role, TestimonialStatus } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

const DECISIONS: TestimonialStatus[] = ["APPROVED", "REJECTED"];

// Shared by this route's PATCH handler and the admin page's Server Action
// (/admin/comunicaciones/resenas) — one write path, so the auth/validation
// logic can't drift between the two callers.
export async function reviewTestimonial(
  user: { id: string; role: Role },
  id: string,
  decision: "APPROVED" | "REJECTED"
): Promise<Response> {
  if (!assertAdminOrStaff(user.role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  // Moderating a review is a write action — "read" (e.g. Recepción) can see
  // the queue via GET but can't act on it, only "full" can.
  const access = await hasModuleAccess(user, "resenas");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!DECISIONS.includes(decision)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Reseña no encontrada" }, { status: 404 });
  }

  const testimonial = await prisma.testimonial.update({
    where: { id },
    data: {
      status: decision,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });

  return Response.json(testimonial);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.status || !DECISIONS.includes(body.status as TestimonialStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  return reviewTestimonial(
    session.user as { id: string; role: Role },
    id,
    body.status as "APPROVED" | "REJECTED"
  );
}
