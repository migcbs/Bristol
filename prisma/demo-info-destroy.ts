import "dotenv/config";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma";

// Self-destruct for the demo content created by prisma/demo-info-seed.ts.
// Reads back demo-info-manifest.json (written by that script) and deletes
// exactly those rows — by id, in the reverse order they were created — so
// this can never touch the base seed (prisma/seed.ts) or anything the user
// created by hand while trying out the system. Run ONLY when the user
// explicitly says so.
//
// Run with: npx tsx prisma/demo-info-destroy.ts

type ManifestEntry = { model: string; id: string; label: string };

// Keyed by the same `model` strings demo-info-seed.ts records with.
const DELETERS: Record<string, (id: string) => Promise<unknown>> = {
  material: (id) => prisma.material.delete({ where: { id } }),
  staffCalendarEvent: (id) => prisma.staffCalendarEvent.delete({ where: { id } }),
  attendanceRecord: (id) => prisma.attendanceRecord.delete({ where: { id } }),
  blockEvaluation: (id) => prisma.blockEvaluation.delete({ where: { id } }),
  grade: (id) => prisma.grade.delete({ where: { id } }),
  testimonial: (id) => prisma.testimonial.delete({ where: { id } }),
  announcement: (id) => prisma.announcement.delete({ where: { id } }),
  enrollment: (id) => prisma.enrollment.delete({ where: { id } }),
  scheduleSlot: (id) => prisma.scheduleSlot.delete({ where: { id } }),
  group: (id) => prisma.group.delete({ where: { id } }),
  interAreaTicket: (id) => prisma.interAreaTicket.delete({ where: { id } }),
  incident: (id) => prisma.incident.delete({ where: { id } }),
  groupChangeRequest: (id) => prisma.groupChangeRequest.delete({ where: { id } }),
  materialLibraryItem: (id) => prisma.materialLibraryItem.delete({ where: { id } }),
  materialCarpeta: (id) => prisma.materialCarpeta.delete({ where: { id } }),
  recursoMaterial: (id) => prisma.recursoMaterial.delete({ where: { id } }),
  cashMovement: (id) => prisma.cashMovement.delete({ where: { id } }),
  invoice: (id) => prisma.invoice.delete({ where: { id } }),
  alumniOutreachLog: (id) => prisma.alumniOutreachLog.delete({ where: { id } }),
  placementAppointment: (id) => prisma.placementAppointment.delete({ where: { id } }),
  lead: (id) => prisma.lead.delete({ where: { id } }),
  receptionLogEntry: (id) => prisma.receptionLogEntry.delete({ where: { id } }),
  parentStudent: (id) => prisma.parentStudent.delete({ where: { id } }),
  // Deleting the demo Student/User rows last — cascades (onDelete: Cascade
  // from Student→User, and from User to its own owned rows) clean up
  // whatever this list didn't already remove explicitly, but everything
  // above is deleted first anyway so cascade is a safety net, not the plan.
  student: (id) => prisma.student.delete({ where: { id } }),
  user: (id) => prisma.user.delete({ where: { id } }),
};

async function main() {
  const manifestUrl = new URL("../demo-info-manifest.json", import.meta.url);
  const manifestPath = fileURLToPath(manifestUrl);

  if (!existsSync(manifestPath)) {
    console.log("No hay demo-info-manifest.json — no hay información de prueba que borrar (o ya fue borrada).");
    return;
  }

  const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (manifest.length === 0) {
    console.log("El manifiesto está vacío — nada que borrar.");
    unlinkSync(manifestPath);
    return;
  }

  console.log(`Borrando ${manifest.length} registros de prueba...`);

  // Reverse order: undo the most-dependent rows first (a Grade before the
  // Enrollment it points to, an Enrollment before the Student, etc.).
  for (const entry of [...manifest].reverse()) {
    const deleter = DELETERS[entry.model];
    if (!deleter) {
      console.warn(`  ⚠️  Tipo de registro desconocido "${entry.model}" (${entry.label}) — omitido, bórralo manualmente si sigue ahí.`);
      continue;
    }
    try {
      await deleter(entry.id);
      console.log(`  ✓ ${entry.label}`);
    } catch (error) {
      // Already gone (e.g. cascaded away by an earlier delete in this same
      // run) is fine and expected — anything else is worth seeing.
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "P2025") {
        console.log(`  · ${entry.label} (ya no existía, probablemente por cascada)`);
      } else {
        console.error(`  ✗ ${entry.label}:`, error);
      }
    }
  }

  unlinkSync(manifestPath);
  console.log("\n✅ Información de prueba eliminada. El sistema quedó como estaba antes de crearla.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
