import { CampusSocials } from "./campus-socials";

export function Footer() {
  return (
    <footer className="bg-primary-dark px-6 py-14 text-sm text-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-white">
            Bristol
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          </p>
          <p className="mt-3 max-w-xs">Inglés profesional, presencial y virtual, por niveles CEFR.</p>
          <p className="mt-4">hola@bristol-ingles.com</p>
          <p>(55) 0000 0000</p>
        </div>
        <div className="grid grid-cols-2 gap-6 md:gap-16">
          <a href="/programas" className="transition-colors hover:text-white">
            Programas
          </a>
          <a href="/planteles" className="transition-colors hover:text-white">
            Planteles
          </a>
        </div>
      </div>

      <CampusSocials className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-8" />

      <p className="mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/55">
        © {new Date().getFullYear()} Bristol. Todos los derechos reservados.
      </p>
    </footer>
  );
}
