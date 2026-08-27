import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

export type CampusScope =
  | { type: "ALL" }
  | { type: "CAMPUS_LIST"; campusIds: string[] }
  | { type: "SINGLE_CAMPUS"; campusId: string }
  | { type: "NONE" };

/**
 * Builds a Prisma `where` clause for Lead queries from a CampusScope.
 * Defaults to denying everything for any scope variant that isn't
 * explicitly handled, so unrecognized/future scopes fail closed.
 */
export function leadScopeWhere(scope: CampusScope): Prisma.LeadWhereInput {
  switch (scope.type) {
    case "ALL":
      return {};
    case "CAMPUS_LIST":
      return { OR: [{ campusId: { in: scope.campusIds } }, { campusId: null }] };
    case "SINGLE_CAMPUS":
    case "NONE":
    default:
      return { id: { in: [] } };
  }
}

/**
 * Builds a Prisma `where` clause for active-Enrollment queries from a
 * CampusScope. Only enrollments still in progress (`completedAt: null`)
 * are in play; deny-by-default for any scope variant that isn't
 * explicitly handled, so unrecognized/future scopes fail closed.
 */
export function enrollmentScopeWhere(scope: CampusScope): Prisma.EnrollmentWhereInput {
  switch (scope.type) {
    case "ALL":
      return { completedAt: null };
    case "CAMPUS_LIST":
      return { completedAt: null, student: { campusId: { in: scope.campusIds } } };
    case "SINGLE_CAMPUS":
    case "NONE":
    default:
      return { id: { in: [] } };
  }
}

export async function getCampusScope(user: { id: string; role: Role }): Promise<CampusScope> {
  switch (user.role) {
    case "ADMIN":
      return { type: "ALL" };

    case "STAFF": {
      const rows = await prisma.staffCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return { type: "CAMPUS_LIST", campusIds: rows.map((r) => r.campusId) };
    }

    case "TEACHER": {
      const rows = await prisma.teacherCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return { type: "CAMPUS_LIST", campusIds: rows.map((r) => r.campusId) };
    }

    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { campusId: true },
      });
      if (!student) return { type: "CAMPUS_LIST", campusIds: [] };
      return { type: "SINGLE_CAMPUS", campusId: student.campusId };
    }

    case "PARENT":
    default:
      return { type: "NONE" };
  }
}
