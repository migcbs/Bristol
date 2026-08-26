import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

async function main() {
  const [campusNorte, campusSur] = await Promise.all([
    prisma.campus.create({ data: { name: "Bristol Norte", address: "Av. Principal 100" } }),
    prisma.campus.create({ data: { name: "Bristol Sur", address: "Av. Secundaria 200" } }),
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

  const staffNorte = await prisma.user.create({
    data: {
      email: "staff.norte@bristol-ingles.com",
      name: "Staff Norte",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusNorte.id } },
    },
  });

  const staffSur = await prisma.user.create({
    data: {
      email: "staff.sur@bristol-ingles.com",
      name: "Staff Sur",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusSur.id } },
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
        create: [{ campusId: campusNorte.id }, { campusId: campusSur.id }],
      },
    },
  });

  const groupA1Norte = await prisma.group.create({
    data: {
      name: "A1 Matutino",
      campusId: campusNorte.id,
      levelId: levels[0].id,
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
      student: { create: { campusId: campusNorte.id } },
    },
    include: { student: true },
  });

  await prisma.enrollment.create({
    data: { studentId: studentUser.student!.id, groupId: groupA1Norte.id },
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
    staffNorte: staffNorte.email,
    staffSur: staffSur.email,
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
