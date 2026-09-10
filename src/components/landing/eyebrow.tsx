export function Eyebrow({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-medium tracking-[0.22em] uppercase ${
        tone === "dark" ? "text-muted" : "text-white/70"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "dark" ? "bg-primary" : "bg-white/60"}`} aria-hidden />
      {children}
    </span>
  );
}
