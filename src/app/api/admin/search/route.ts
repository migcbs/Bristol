import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { parseSmartQuery } from "@/lib/search-nlp";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";
import { prisma } from "@/lib/prisma";
import type { CampusScope } from "@/lib/campus-scope";
import type { Prisma, Role, LeadSource } from "@prisma/client";

const STUDENT_SELECT = {
  id: true,
  matricula: true,
  campusId: true,
  user: { select: { name: true } },
  campus: { select: { name: true } },
  enrollments: {
    where: { completedAt: null },
    take: 1,
    select: { group: { select: { id: true, name: true, level: { select: { code: true } } } } },
  },
} satisfies Prisma.StudentSelect;

function campusWhereFor(scope: CampusScope): Prisma.StudentWhereInput {
  switch (scope.type) {
    case "ALL":
      return {};
    case "CAMPUS_LIST":
      return { campusId: { in: scope.campusIds } };
    case "SINGLE_CAMPUS":
    case "NONE":
    default:
      return { id: { in: [] } };
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ error: "La búsqueda requiere al menos 2 caracteres" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const studentCampusWhere = campusWhereFor(scope);

  const intent = parseSmartQuery(q);

  if (intent?.type === "students_by_group") {
    const students = await prisma.student.findMany({
      where: {
        ...studentCampusWhere,
        enrollments: {
          some: {
            completedAt: null,
            group: {
              OR: [
                { name: { contains: intent.term, mode: "insensitive" } },
                { codigoGrupo: { contains: intent.term, mode: "insensitive" } },
              ],
            },
          },
        },
      },
      take: 25,
      select: STUDENT_SELECT,
    });
    return Response.json({
      intent,
      summary: `${students.length} alumno${students.length === 1 ? "" : "s"} en grupos que coinciden con “${intent.term}”`,
      students,
      leads: [],
      groups: [],
      cursos: [],
      parents: [],
    });
  }

  if (intent?.type === "students_by_level") {
    const students = await prisma.student.findMany({
      where: {
        ...studentCampusWhere,
        enrollments: {
          some: {
            completedAt: null,
            group: { level: { OR: [{ code: { contains: intent.term, mode: "insensitive" } }, { name: { contains: intent.term, mode: "insensitive" } }] } },
          },
        },
      },
      take: 25,
      select: STUDENT_SELECT,
    });
    return Response.json({
      intent,
      summary: `${students.length} alumno${students.length === 1 ? "" : "s"} en el nivel “${intent.term}”`,
      students,
      leads: [],
      groups: [],
      cursos: [],
      parents: [],
    });
  }

  if (intent?.type === "students_by_campus") {
    const campuses = await prisma.campus.findMany({
      where: { name: { contains: intent.term, mode: "insensitive" } },
      select: { id: true },
    });
    const students = await prisma.student.findMany({
      where: { ...studentCampusWhere, campusId: { in: campuses.map((c) => c.id) } },
      take: 25,
      select: STUDENT_SELECT,
    });
    return Response.json({
      intent,
      summary: `${students.length} alumno${students.length === 1 ? "" : "s"} en planteles que coinciden con “${intent.term}”`,
      students,
      leads: [],
      groups: [],
      cursos: [],
      parents: [],
    });
  }

  if (intent?.type === "leads_by_source") {
    const matchingSources = (Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][])
      .filter(([, label]) => label.toLowerCase().includes(intent.term.toLowerCase()))
      .map(([value]) => value);

    const leads =
      matchingSources.length === 0
        ? []
        : await prisma.lead.findMany({
            where: { AND: [leadScopeWhere(scope), { source: { in: matchingSources } }] },
            take: 25,
            select: { id: true, name: true, email: true, source: true },
          });
    return Response.json({
      intent,
      summary: `${leads.length} lead${leads.length === 1 ? "" : "s"} de “${intent.term}”`,
      students: [],
      leads,
      groups: [],
      cursos: [],
      parents: [],
    });
  }

  if (intent?.type === "parents") {
    const parents = await prisma.user.findMany({
      where: {
        role: "PARENT",
        OR: [
          { name: { contains: intent.term, mode: "insensitive" } },
          { parentLinks: { some: { student: { user: { name: { contains: intent.term, mode: "insensitive" } } } } } },
        ],
      },
      take: 25,
      select: {
        id: true,
        name: true,
        email: true,
        parentLinks: { select: { student: { select: { user: { select: { name: true } } } } } },
      },
    });
    return Response.json({
      intent,
      summary: `${parents.length} padre/tutor con “${intent.term}”`,
      students: [],
      leads: [],
      groups: [],
      cursos: [],
      parents,
    });
  }

  // No recognized pattern — plain fuzzy search across every entity.
  const [students, leads, groups, cursos, parents] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...studentCampusWhere,
        OR: [
          { matricula: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      select: STUDENT_SELECT,
    }),
    prisma.lead.findMany({
      where: {
        AND: [
          leadScopeWhere(scope),
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, source: true },
    }),
    prisma.group.findMany({
      where: {
        ...(scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } }),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { codigoGrupo: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, codigoGrupo: true, level: { select: { code: true } } },
    }),
    prisma.curso.findMany({
      where: { nombre: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, nombre: true, categoria: true, esCertificacion: true },
    }),
    prisma.user.findMany({
      where: {
        role: "PARENT",
        OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
      },
      take: 5,
      select: { id: true, name: true, email: true, parentLinks: { select: { student: { select: { user: { select: { name: true } } } } } } },
    }),
  ]);

  return Response.json({ intent: null, students, leads, groups, cursos, parents });
}
