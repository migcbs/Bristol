import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

async function main() {
  const [campusCoatepec, campusXalapa] = await Promise.all([
    prisma.campus.create({ data: { name: "Coatepec", address: "Coatepec, Veracruz" } }),
    prisma.campus.create({ data: { name: "Xalapa", address: "Xalapa, Veracruz" } }),
  ]);

  const levels = await Promise.all(
    [
      ["A1", "Principiante"],
      ["A2", "Elemental"],
      ["B1", "Intermedio"],
      ["B2", "Intermedio alto"],
      ["C1", "Avanzado"],
      ["C2", "Dominio"],
    ].map(([code, name]) => prisma.level.create({ data: { code, name } }))
  );

  const passwordHash = await hashPassword("Bristol123!");

  const admin = await prisma.user.create({
    data: {
      email: "admin@bristol-ingles.com",
      name: "Admin Bristol",
      role: "ADMIN",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const staffCoatepec = await prisma.user.create({
    data: {
      email: "staff.coatepec@bristol-ingles.com",
      name: "Staff Coatepec",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusCoatepec.id } },
    },
  });

  const staffXalapa = await prisma.user.create({
    data: {
      email: "staff.xalapa@bristol-ingles.com",
      name: "Staff Xalapa",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusXalapa.id } },
    },
  });

  const teacherBoth = await prisma.user.create({
    data: {
      email: "profesor.itinerante@bristol-ingles.com",
      name: "Profesor Itinerante",
      role: "TEACHER",
      passwordHash,
      emailVerifiedAt: new Date(),
      teacherCampuses: {
        create: [{ campusId: campusCoatepec.id }, { campusId: campusXalapa.id }],
      },
    },
  });

  const groupA1Coatepec = await prisma.group.create({
    data: {
      name: "A1 Matutino",
      campusId: campusCoatepec.id,
      levelId: levels[0].id,
      teacherId: teacherBoth.id,
    },
  });

  // A second group at the same campus so /admin/reinscripciones has a
  // real destination group to re-enroll the demo student into.
  await prisma.group.create({
    data: {
      name: "A2 Matutino",
      campusId: campusCoatepec.id,
      levelId: levels[1].id,
      teacherId: teacherBoth.id,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: "alumno.demo@bristol-ingles.com",
      name: "Alumno Demo",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: {
        create: { campusId: campusCoatepec.id, matricula: "BRI-2026-00001" },
      },
    },
    include: { student: true },
  });

  await prisma.enrollment.create({
    data: { studentId: studentUser.student!.id, groupId: groupA1Coatepec.id },
  });

  const parentUser = await prisma.user.create({
    data: {
      email: "padre.demo@bristol-ingles.com",
      name: "Padre Demo",
      role: "PARENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      parentLinks: { create: { studentId: studentUser.student!.id } },
    },
  });

  console.log({
    admin: admin.email,
    staffCoatepec: staffCoatepec.email,
    staffXalapa: staffXalapa.email,
    teacherBoth: teacherBoth.email,
    student: studentUser.email,
    parent: parentUser.email,
    password: "Bristol123! (para todos los usuarios de seed)",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
