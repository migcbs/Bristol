import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function getVisibleStudentIds(user: { id: string; role: Role }): Promise<string[]> {
  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    return student ? [student.id] : [];
  }

  if (user.role === "PARENT") {
    const links = await prisma.parentStudent.findMany({
      where: { parentUserId: user.id },
      select: { studentId: true },
    });
    return links.map((l) => l.studentId);
  }

  return [];
}
