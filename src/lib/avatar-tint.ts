// Deterministic per-record avatar color, so a card grid of many records
// (alumnos, ex-alumnos, etc.) reads as visually distinct entries instead of
// a wall of identical navy circles — modeled on the Perrucho admin's
// hueFromId() avatar coloring (confirmed with the user 2026-09-09), but
// using a curated set of tasteful Tailwind tints instead of raw HSL so it
// stays on-brand for a formal school system rather than looking playful.
const AVATAR_TINTS = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
] as const;

export function avatarTint(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}
