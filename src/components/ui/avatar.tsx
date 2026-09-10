import { clsx } from "clsx";

// A rounded-square initials avatar — the "identity cell" anchor for a
// modern record table (modeled on the BOOZ system's .avatar-main,
// confirmed with the user 2026-09-09). No photo upload in Bristol yet, so
// this is initials-only, but the size/shape matches what a real photo
// would later drop into.
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={clsx(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-base font-bold text-primary",
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
