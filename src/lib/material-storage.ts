import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import crypto from "node:crypto";

// Local-disk storage for uploaded class material and library files —
// confirmed with the user 2026-09-09 (teachers upload from their machine;
// Control Escolar uploads library content from theirs). Same production
// caveat as src/lib/student-document-storage.ts: fine for this
// dev/testing setup, but a serverless deploy needs real object storage —
// swap these two functions, the callers only use them.
const STORAGE_ROOT = join(process.cwd(), ".data", "material");

export function newStorageKey(originalName: string): string {
  const ext = extname(originalName).slice(0, 10) || "";
  return `${crypto.randomBytes(12).toString("hex")}${ext}`;
}

export async function saveMaterialFile(storageKey: string, bytes: Buffer): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(join(STORAGE_ROOT, storageKey), bytes);
}

export async function readMaterialFile(storageKey: string): Promise<Buffer> {
  return readFile(join(STORAGE_ROOT, storageKey));
}

export async function deleteMaterialFile(storageKey: string): Promise<void> {
  await unlink(join(STORAGE_ROOT, storageKey)).catch(() => {});
}

export const ALLOWED_MATERIAL_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024; // 25MB
