import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

// Populates the already-seeded system (prisma/seed.ts) with one realistic
// piece of activity per área, so the user can click through every screen
// with real content instead of empty states — requested 2026-09-09.
// Every row this script creates is recorded in `demo-info-manifest.json`
// (repo root) in creation order; `prisma/demo-info-destroy.ts` reads that
// file back and deletes each row explicitly, in reverse order, rather than
// relying on cascades or a text-pattern guess — so cleanup is exact and
// never touches anything from the base seed.
//
// Run with:  npx tsx prisma/demo-info-seed.ts
// Undo with: npx tsx prisma/demo-info-destroy.ts   (only when the user says so)

type ManifestEntry = { model: string; id: string; label: string };
const manifest: ManifestEntry[] = [];
function record(model: string, id: string, label: string) {
  manifest.push({ model, id, label });
}

async function main() {
  const [campusCoatepec, campusXalapa] = await Promise.all([
    prisma.campus.findFirstOrThrow({ where: { name: "Coatepec" } }),
    prisma.campus.findFirstOrThrow({ where: { name: "Xalapa" } }),
  ]);
  const levelB1 = await prisma.level.findFirstOrThrow({ where: { code: "B1" } });
  const groupA1Coatepec = await prisma.group.findFirstOrThrow({ where: { name: "A1 Matutino", campusId: campusCoatepec.id } });
  const groupA2Coatepec = await prisma.group.findFirstOrThrow({ where: { name: "A2 Matutino", campusId: campusCoatepec.id } });

  const [recepcion, comercial, caja, controlEscolar, calidadControl, admin, teacher, alumnoDemo] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: "recepcion.coatepec@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "comercial@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "caja.xalapa@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "controlescolar.coatepec@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "calidadycontrol@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "admin@bristol-ingles.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "profesor.itinerante@bristol-ingles.com" } }),
    prisma.student.findFirstOrThrow({ where: { user: { email: "alumno.demo@bristol-ingles.com" } } }),
  ]);
  const alumnoDemoEnrollment = await prisma.enrollment.findFirstOrThrow({
    where: { studentId: alumnoDemo.id, completedAt: null },
  });

  const passwordHash = await hashPassword("Bristol123!");

  // ---- Recepción: alta de un alumno nuevo (menor de edad, con tutor) ----
  const mariaUser = await prisma.user.create({
    data: {
      email: "maria.fernandez.demo@bristol-ingles.com",
      name: "María Fernández",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: {
        create: {
          campusId: campusCoatepec.id,
          matricula: "BRI-2026-00003",
          fechaNacimiento: new Date("2013-06-02"),
          telefonoMovil: "2281234567",
          contactoEmergenciaNombre: "Tutor Fernández",
          contactoEmergenciaTelefono: "2287654321",
        },
      },
    },
    include: { student: true },
  });
  record("user", mariaUser.id, "María Fernández (alumna nueva, Recepción)");
  record("student", mariaUser.student!.id, "Expediente de María Fernández");

  const mariaEnrollment = await prisma.enrollment.create({
    data: { studentId: mariaUser.student!.id, groupId: groupA1Coatepec.id },
  });
  record("enrollment", mariaEnrollment.id, "Inscripción de María en A1 Matutino");

  // Horario de A1 Matutino (lun/mié 09:00–11:00) para que el calendario
  // del portal del alumno y del tutor no salga vacío.
  for (const dayOfWeek of [1, 3]) {
    const existing = await prisma.scheduleSlot.findFirst({
      where: { groupId: groupA1Coatepec.id, dayOfWeek, startTime: "09:00" },
    });
    if (existing) continue;
    const slot = await prisma.scheduleSlot.create({
      data: { groupId: groupA1Coatepec.id, dayOfWeek, startTime: "09:00", endTime: "11:00" },
    });
    record("scheduleSlot", slot.id, `Horario ${dayOfWeek === 1 ? "lunes" : "miércoles"} 09:00–11:00 de A1 Matutino`);
  }

  const tutorUser = await prisma.user.create({
    data: {
      email: "tutor.fernandez.demo@bristol-ingles.com",
      name: "Tutor Fernández",
      role: "PARENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      parentLinks: { create: { studentId: mariaUser.student!.id } },
    },
    include: { parentLinks: true },
  });
  record("user", tutorUser.id, "Tutor Fernández (padre de María)");
  record("parentStudent", tutorUser.parentLinks[0].id, "Vínculo tutor–alumna");

  const bitacoraEntry = await prisma.receptionLogEntry.create({
    data: {
      campusId: campusCoatepec.id,
      createdById: recepcion.id,
      type: "LLAMADA",
      note: "Llamada de seguimiento a la mamá de María Fernández para confirmar horario de clases y entrega de documentos.",
    },
  });
  record("receptionLogEntry", bitacoraEntry.id, "Nota de bitácora (Recepción)");

  // ---- Comercial: un lead, su cita de posicionamiento, y reenganche de un ex-alumno ----
  const lead = await prisma.lead.create({
    data: {
      name: "Roberto Sánchez",
      email: "roberto.sanchez.demo@example.com",
      phone: "2289876543",
      message: "Quiero información sobre el curso de adultos, nivel intermedio.",
      campusId: campusCoatepec.id,
      status: "PLACEMENT_SCHEDULED",
      source: "WEB",
      interestType: "CURSO_REGULAR",
      asesorAsignadoId: comercial.id,
    },
  });
  record("lead", lead.id, "Lead: Roberto Sánchez");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);
  const appointment = await prisma.placementAppointment.create({
    data: { leadId: lead.id, scheduledFor: tomorrow, campusId: campusCoatepec.id, notes: "Examen de colocación presencial." },
  });
  record("placementAppointment", appointment.id, "Cita de posicionamiento de Roberto Sánchez");

  const lauraUser = await prisma.user.create({
    data: {
      email: "laura.jimenez.demo@bristol-ingles.com",
      name: "Laura Jiménez",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: {
        create: {
          campusId: campusCoatepec.id,
          matricula: "BRI-2026-00004",
          fechaNacimiento: new Date("1998-11-14"),
          telefonoMovil: "2289988776",
          estatusAlumno: "BAJA",
          interesadoEnVolver: true,
        },
      },
    },
    include: { student: true },
  });
  record("user", lauraUser.id, "Laura Jiménez (ex-alumna)");
  record("student", lauraUser.student!.id, "Expediente de Laura Jiménez");

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const lauraEnrollment = await prisma.enrollment.create({
    data: {
      studentId: lauraUser.student!.id,
      groupId: groupA2Coatepec.id,
      enrolledAt: threeMonthsAgo,
      completedAt: new Date(),
    },
  });
  record("enrollment", lauraEnrollment.id, "Inscripción histórica de Laura en A2 Matutino");

  const outreach = await prisma.alumniOutreachLog.create({
    data: {
      studentId: lauraUser.student!.id,
      createdById: comercial.id,
      type: "LLAMADA",
      note: "Se le marcó para invitarla a retomar sus clases con una promoción de reinscripción. Mostró interés, pidió que le volviéramos a llamar la próxima semana.",
    },
  });
  record("alumniOutreachLog", outreach.id, "Bitácora de reenganche de Laura Jiménez");

  // ---- Caja: un cargo, un movimiento manual y un recurso de inventario ----
  const invoice = await prisma.invoice.create({
    data: {
      studentId: mariaUser.student!.id,
      description: "Inscripción — ciclo 2026",
      amountCents: 150000,
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 10);
        return d;
      })(),
      status: "PENDING",
    },
  });
  record("invoice", invoice.id, "Cargo de inscripción de María Fernández");

  const cashMovement = await prisma.cashMovement.create({
    data: {
      campusId: campusXalapa.id,
      tipo: "ENTRADA",
      concepto: "Venta de libro de texto — efectivo",
      montoCents: 35000,
      createdById: caja.id,
    },
  });
  record("cashMovement", cashMovement.id, "Movimiento de caja manual (Xalapa)");

  const recurso = await prisma.recursoMaterial.create({
    data: { nombre: "Libro de texto A1 — Unit 1", campusId: campusXalapa.id, cantidadDisponible: 25, precioUnitarioCents: 35000 },
  });
  record("recursoMaterial", recurso.id, "Inventario: Libro de texto A1");

  // ---- Control Escolar: carpeta de material y una solicitud pendiente ----
  const carpeta = await prisma.materialCarpeta.create({
    data: { nombre: "Exámenes de nivel A1", descripcion: "Bancos de reactivos para evaluación de bloque.", createdById: controlEscolar.id },
  });
  record("materialCarpeta", carpeta.id, "Carpeta: Exámenes de nivel A1");

  const carpetaItem = await prisma.materialLibraryItem.create({
    data: {
      carpetaId: carpeta.id,
      titulo: "Examen de bloque 1 — A1.pdf",
      url: "https://example.com/demo/examen-bloque-1-a1.pdf",
      uploadedById: controlEscolar.id,
    },
  });
  record("materialLibraryItem", carpetaItem.id, "Material dentro de la carpeta A1");

  const groupChangeRequest = await prisma.groupChangeRequest.create({
    data: {
      type: "CAMBIO_GRUPO",
      studentId: mariaUser.student!.id,
      currentGroupId: groupA1Coatepec.id,
      requestedGroupId: groupA2Coatepec.id,
      reason: "La alumna ya domina el contenido de A1; su maestra recomienda avanzarla a A2.",
      requestedById: recepcion.id,
    },
  });
  record("groupChangeRequest", groupChangeRequest.id, "Solicitud pendiente: cambio de grupo de María");

  // ---- Calidad y Control: una incidencia y un ticket entre áreas ----
  const incident = await prisma.incident.create({
    data: {
      studentId: alumnoDemo.id,
      groupId: groupA1Coatepec.id,
      reportedById: teacher.id,
      description: "Se presentó tarde a clase en tres ocasiones esta semana.",
    },
  });
  record("incident", incident.id, "Incidencia de Alumno Demo");

  const ticket = await prisma.interAreaTicket.create({
    data: {
      title: "Revisar queja de un padre de familia",
      description: "Un padre llamó a recepción reportando inconformidad con el trato recibido por un maestro. Se solicita revisión de Calidad y Control.",
      createdById: recepcion.id,
      assignedToId: calidadControl.id,
      status: "ABIERTO",
    },
  });
  record("interAreaTicket", ticket.id, "Ticket entre áreas");

  // ---- Dirección de Campus: nuevo grupo, con horario y un alumno matriculado ----
  const diegoUser = await prisma.user.create({
    data: {
      email: "diego.torres.demo@bristol-ingles.com",
      name: "Diego Torres",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: {
        create: { campusId: campusXalapa.id, matricula: "BRI-2026-00005", fechaNacimiento: new Date("1990-02-08") },
      },
    },
    include: { student: true },
  });
  record("user", diegoUser.id, "Diego Torres (alumno nuevo, Xalapa)");
  record("student", diegoUser.student!.id, "Expediente de Diego Torres");

  const groupB1Vespertino = await prisma.group.create({
    data: { name: "B1 Vespertino", campusId: campusXalapa.id, levelId: levelB1.id, teacherId: teacher.id },
  });
  record("group", groupB1Vespertino.id, "Grupo B1 Vespertino (creado por Dirección)");

  const scheduleSlot = await prisma.scheduleSlot.create({
    data: { groupId: groupB1Vespertino.id, dayOfWeek: 2, startTime: "18:00", endTime: "20:00" },
  });
  record("scheduleSlot", scheduleSlot.id, "Horario martes 18:00–20:00 de B1 Vespertino");
  const scheduleSlot2 = await prisma.scheduleSlot.create({
    data: { groupId: groupB1Vespertino.id, dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
  });
  record("scheduleSlot", scheduleSlot2.id, "Horario jueves 18:00–20:00 de B1 Vespertino");

  const diegoEnrollment = await prisma.enrollment.create({
    data: { studentId: diegoUser.student!.id, groupId: groupB1Vespertino.id },
  });
  record("enrollment", diegoEnrollment.id, "Inscripción de Diego en B1 Vespertino");

  // ---- Admin: un anuncio general y una reseña pendiente de moderar ----
  const announcement = await prisma.announcement.create({
    data: {
      title: "Bienvenida al nuevo ciclo escolar",
      body: "Iniciamos el nuevo ciclo el próximo lunes. ¡Los esperamos con mucho entusiasmo!",
      audience: "ALL",
      createdById: admin.id,
    },
  });
  record("announcement", announcement.id, "Anuncio general de bienvenida");

  const testimonial = await prisma.testimonial.create({
    data: { name: "Carla Méndez", role: "Mamá de alumno", quote: "Excelente atención y resultados en muy poco tiempo. Mi hijo avanzó muchísimo.", status: "PENDING" },
  });
  record("testimonial", testimonial.id, "Reseña pendiente de moderar");

  // ---- Contenido académico para el portal (Alumno Demo) ----
  const grade = await prisma.grade.create({
    data: { enrollmentId: alumnoDemoEnrollment.id, title: "Examen de unidad 1", score: 88, maxScore: 100, createdById: teacher.id },
  });
  record("grade", grade.id, "Calificación de Alumno Demo");

  const blockEvaluation = await prisma.blockEvaluation.create({
    data: {
      enrollmentId: alumnoDemoEnrollment.id,
      bloqueNumero: 1,
      notaListening: 88,
      notaSpeaking: 82,
      notaReading: 90,
      notaWriting: 85,
      notaGrammar: 87,
      promedioBloque: 86.4,
      createdById: teacher.id,
    },
  });
  record("blockEvaluation", blockEvaluation.id, "Evaluación de bloque 1 de Alumno Demo");

  const attendanceStatuses: Array<"PRESENT" | "ABSENT" | "LATE"> = ["PRESENT", "PRESENT", "LATE", "PRESENT", "ABSENT"];
  for (let i = 0; i < attendanceStatuses.length; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (attendanceStatuses.length - i));
    const rec = await prisma.attendanceRecord.create({
      data: { enrollmentId: alumnoDemoEnrollment.id, date, status: attendanceStatuses[i] },
    });
    record("attendanceRecord", rec.id, `Asistencia de Alumno Demo (${date.toISOString().slice(0, 10)})`);
  }

  const material = await prisma.material.create({
    data: {
      groupId: groupA1Coatepec.id,
      title: "Unidad 1 — Vocabulario.pdf",
      url: "https://example.com/demo/unidad-1-vocabulario.pdf",
      description: "Lista de vocabulario y ejercicios de repaso.",
      uploadedById: teacher.id,
    },
  });
  record("material", material.id, "Material de clase compartido por el maestro");

  // ---- Entrada de agenda de Recepción (la Agenda funciona como
  //      calendario; se pueden agregar entradas libres además de los
  //      exámenes de ubicación) ----
  const inDays = (d: number, h: number) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    x.setHours(h, 0, 0, 0);
    return x;
  };
  const agendaEntry = await prisma.staffCalendarEvent.create({
    data: {
      area: "RECEPCION",
      campusId: campusCoatepec.id,
      title: "Entrega de expedientes al archivo",
      startsAt: inDays(1, 10),
      endsAt: inDays(1, 11),
      createdById: recepcion.id,
    },
  });
  record("staffCalendarEvent", agendaEntry.id, "Entrada de agenda de Recepción");

  writeFileSync(
    new URL("../demo-info-manifest.json", import.meta.url),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Información de prueba creada — ${manifest.length} registros.`);
  console.log("Manifiesto guardado en demo-info-manifest.json (lo usa prisma/demo-info-destroy.ts para borrar exactamente esto).\n");
  console.log("Cuentas nuevas (contraseña: Bristol123!):");
  console.log("  María Fernández (alumna):     maria.fernandez.demo@bristol-ingles.com");
  console.log("  Tutor Fernández (padre):      tutor.fernandez.demo@bristol-ingles.com");
  console.log("  Laura Jiménez (ex-alumna):    laura.jimenez.demo@bristol-ingles.com");
  console.log("  Diego Torres (alumno Xalapa): diego.torres.demo@bristol-ingles.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
