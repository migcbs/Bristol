import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GlassInputWrapper } from "@/components/ui/auth-layout";

// --- TYPE DEFINITIONS ---

export interface Testimonial {
  initials: string;
  name: string;
  role: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  testimonials?: Testimonial[];
  errorMessage?: string | null;
  loading?: boolean;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onResetPassword?: () => void;
}

// --- SUB-COMPONENTS ---

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div
    className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl border border-white/10 bg-white/10 p-5 w-64 backdrop-blur-xl`}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-sm font-bold text-white">
      {testimonial.initials}
    </span>
    <div className="text-sm leading-snug">
      <p className="font-medium text-white">{testimonial.name}</p>
      <p className="text-white/70">{testimonial.role}</p>
      <p className="mt-1 text-white/85">{testimonial.text}</p>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="text-text">Bienvenido de vuelta</span>,
  description = "Entra a tu cuenta de Bristol para seguir tu progreso.",
  testimonials = [],
  errorMessage,
  loading = false,
  onSignIn,
  onResetPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex h-[100dvh] w-[100dvw] flex-col font-body md:flex-row">
      {/* Left column: sign-in form */}
      <section className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 font-display text-4xl font-semibold leading-tight md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted">{description}</p>

            <form className="space-y-5" onSubmit={onSignIn}>
              <div className="animate-element animate-delay-300">
                <label htmlFor="email" className="text-sm font-medium text-muted">
                  Correo electrónico
                </label>
                <GlassInputWrapper>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-2xl bg-transparent p-4 text-sm text-text outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label htmlFor="password" className="text-sm font-medium text-muted">
                  Contraseña
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm text-text outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-xl transition-colors hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-muted transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {errorMessage && (
                <p className="animate-element text-sm text-accent">{errorMessage}</p>
              )}

              <div className="animate-element animate-delay-500 flex items-center justify-end text-sm">
                <a
                  href="/forgot-password"
                  onClick={
                    onResetPassword
                      ? (e) => {
                          e.preventDefault();
                          onResetPassword();
                        }
                      : undefined
                  }
                  className="rounded text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Right column: brand panel + testimonials — a photo slot for when a real campus photo is ready */}
      <section className="relative hidden flex-1 p-4 md:block">
        <div className="animate-slide-right animate-delay-300 absolute inset-4 overflow-hidden rounded-3xl bg-primary">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
          <div className="absolute left-8 right-8 top-8">
            <span className="font-display text-sm font-semibold tracking-wide text-white/70">
              Bristol · Inglés Profesional
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[0.95] text-white md:text-5xl">
              Aprende
              <br />
              inglés
            </h2>
          </div>
        </div>
        {testimonials.length > 0 && (
          <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
            <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
            {testimonials[1] && (
              <div className="hidden xl:flex">
                <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
              </div>
            )}
            {testimonials[2] && (
              <div className="hidden 2xl:flex">
                <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
