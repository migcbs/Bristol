import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import type { StudentDocumentType } from "@prisma/client";

// Local-disk storage for student documents (acta de nacimiento, CURP,
// comprobante de domicilio) — confirmed with the user 2026-09-09: these
// were previously just unchecked checkboxes with no file behind them.
//
// IMPORTANT production caveat, stated plainly rather than silently
// papered over: this writes to the local filesystem, which works for this
// dev/testing environment but is NOT durable on most serverless hosts
// (e.g. Vercel) — the disk is ephemeral there and files can vanish on a
// redeploy or cold start. Before shipping this to a serverless production
// deployment, swap this module's two functions for a real object-storage
// client (S3, Vercel Blob, Cloudinary, etc.) — that needs real credentials
// this project doesn't have configured, so it wasn't faked here. The
// upload/download API routes only call these two functions, so that swap
// is contained to this one file.
const STORAGE_ROOT = join(process.cwd(), ".data", "student-documents");

function keyFor(studentId: string, tipo: StudentDocumentType, originalName: string): string {
  const ext = extname(originalName) || "";
  return join(studentId, `${tipo}${ext}`);
}

export async function saveStudentDocument(
  studentId: string,
  tipo: StudentDocumentType,
  originalName: string,
  bytes: Buffer
): Promise<string> {
  const key = keyFor(studentId, tipo, originalName);
  const fullPath = join(STORAGE_ROOT, key);
  await mkdir(join(STORAGE_ROOT, studentId), { recursive: true });
  await writeFile(fullPath, bytes);
  return key;
}

export async function readStudentDocument(storageKey: string): Promise<Buffer> {
  return readFile(join(STORAGE_ROOT, storageKey));
}

export async function deleteStudentDocument(storageKey: string): Promise<void> {
  await unlink(join(STORAGE_ROOT, storageKey)).catch(() => {
    // Already gone is fine — deleting the DB row is what matters.
  });
}
