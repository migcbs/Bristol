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

  const staffRecepcion = await prisma.user.create({
    data: {
      email: "recepcion.coatepec@bristol-ingles.com",
      name: "Recepción Coatepec",
      role: "STAFF",
      staffPosition: "RECEPCION",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusCoatepec.id } },
    },
  });

  const staffCaja = await prisma.user.create({
    data: {
      email: "caja.xalapa@bristol-ingles.com",
      name: "Caja Xalapa",
      role: "STAFF",
      staffPosition: "CAJA",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusXalapa.id } },
    },
  });

  const staffControlEscolar = await prisma.user.create({
    data: {
      email: "controlescolar.coatepec@bristol-ingles.com",
      name: "Control Escolar Coatepec",
      role: "STAFF",
      staffPosition: "CONTROL_ESCOLAR",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusCoatepec.id } },
    },
  });

  const staffComercial = await prisma.user.create({
    data: {
      email: "comercial@bristol-ingles.com",
      name: "Comercial Bristol",
      role: "STAFF",
      staffPosition: "COMERCIAL",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: {
        create: [{ campusId: campusCoatepec.id }, { campusId: campusXalapa.id }],
      },
    },
  });

  const staffCalidadControl = await prisma.user.create({
    data: {
      email: "calidadycontrol@bristol-ingles.com",
      name: "Calidad y Control",
      role: "STAFF",
      staffPosition: "CALIDAD_CONTROL",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: {
        create: [{ campusId: campusCoatepec.id }, { campusId: campusXalapa.id }],
      },
    },
  });

  const staffDireccion = await prisma.user.create({
    data: {
      email: "direccion.xalapa@bristol-ingles.com",
      name: "Dirección Xalapa",
      role: "STAFF",
      staffPosition: "DIRECCION_CAMPUS",
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
        create: {
          campusId: campusCoatepec.id,
          matricula: "BRI-2026-00001",
          fechaNacimiento: new Date("2012-03-10"),
        },
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

  const adultStudentUser = await prisma.user.create({
    data: {
      email: "alumno.adulto.demo@bristol-ingles.com",
      name: "Alumno Adulto Demo",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: {
        create: {
          campusId: campusCoatepec.id,
          matricula: "BRI-2026-00002",
          fechaNacimiento: new Date("1995-05-20"),
        },
      },
    },
    include: { student: true },
  });

  await prisma.enrollment.create({
    data: { studentId: adultStudentUser.student!.id, groupId: groupA1Coatepec.id },
  });

  console.log({
    admin: admin.email,
    staffCoatepec: staffCoatepec.email,
    staffXalapa: staffXalapa.email,
    staffRecepcion: staffRecepcion.email,
    staffCaja: staffCaja.email,
    staffControlEscolar: staffControlEscolar.email,
    staffComercial: staffComercial.email,
    staffCalidadControl: staffCalidadControl.email,
    staffDireccion: staffDireccion.email,
    teacherBoth: teacherBoth.email,
    student: studentUser.email,
    parent: parentUser.email,
    adultStudent: adultStudentUser.email,
    password: "Bristol123! (para todos los usuarios de seed)",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
