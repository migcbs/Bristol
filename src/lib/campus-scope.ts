import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type CampusScope =
  | { type: "ALL" }
  | { type: "CAMPUS_LIST"; campusIds: string[] }
  | { type: "SINGLE_CAMPUS"; campusId: string }
  | { type: "NONE" };

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
