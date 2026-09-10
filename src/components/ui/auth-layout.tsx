import type { ReactNode } from "react";

// Shared by every auth page (login, forgot/reset password, verify email) —
// the same split layout as the sign-in page, so resetting a password
// doesn't feel like landing on a different, older site.

export const GlassInputWrapper = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-border bg-text/5 backdrop-blur-sm transition-colors focus-within:border-accent/70 focus-within:bg-accent/5 focus-within:ring-2 focus-within:ring-accent/15">
    {children}
  </div>
);

interface AuthLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Headline shown on the brand panel (right column, desktop only). */
  panelHeadline?: ReactNode;
}

export function AuthLayout({
  title,
  description,
  children,
  panelHeadline = (
    <>
      Aprende
      <br />
      inglés
    </>
  ),
}: AuthLayoutProps) {
  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col font-body md:flex-row">
      <section className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 font-display text-3xl font-semibold leading-tight md:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="animate-element animate-delay-200 text-muted">{description}</p>
            )}
            <div className="animate-element animate-delay-300">{children}</div>
          </div>
        </div>
      </section>

      {/* Brand panel — a photo slot for when a real campus photo is ready */}
      <section className="relative hidden flex-1 p-4 md:block">
        <div className="animate-slide-right animate-delay-300 absolute inset-4 overflow-hidden rounded-3xl bg-primary">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
          <div className="absolute left-8 right-8 top-8">
            <span className="font-display text-sm font-semibold tracking-wide text-white/70">
              Bristol · Inglés Profesional
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[0.95] text-white md:text-5xl">
              {panelHeadline}
            </h2>
          </div>
        </div>
      </section>
    </div>
  );
}
