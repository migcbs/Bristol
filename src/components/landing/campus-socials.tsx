import { clsx } from "clsx";

// Redes sociales por plantel, para el footer (petición del usuario
// 2026-09-09). Los valores de abajo son PLACEHOLDERS — reemplázalos con
// las URLs de Facebook / Instagram reales y el número de WhatsApp real de
// cada plantel (mismo criterio que el email/teléfono de ejemplo del
// footer). El WhatsApp debe ser el número a 10 dígitos con lada 52 al
// frente (deep link wa.me, sin API de WhatsApp Business).
export interface CampusSocial {
  campus: string;
  facebook: string;
  instagram: string;
  /** Solo dígitos, con código de país: "52" + 10 dígitos. */
  whatsapp: string;
}

export const CAMPUS_SOCIALS: CampusSocial[] = [
  {
    campus: "Coatepec",
    facebook: "https://www.facebook.com/", // TODO: página real de Coatepec
    instagram: "https://www.instagram.com/", // TODO: cuenta real de Coatepec
    whatsapp: "52XXXXXXXXXX", // TODO: WhatsApp real de Coatepec
  },
  {
    campus: "Xalapa",
    facebook: "https://www.facebook.com/", // TODO: página real de Xalapa
    instagram: "https://www.instagram.com/", // TODO: cuenta real de Xalapa
    whatsapp: "52XXXXXXXXXX", // TODO: WhatsApp real de Xalapa
  },
];

// Brand glyphs inline — this lucide build doesn't ship Facebook/Instagram
// (brand icons were dropped upstream), so all three are hand-rolled at a
// 24-box, currentColor fill.
function GlyphFacebook({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.014 1.792-4.68 4.533-4.68 1.313 0 2.686.235 2.686.235v2.965h-1.513c-1.49 0-1.955.928-1.955 1.879v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function GlyphInstagram({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function GlyphWhatsApp({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.15-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

// Two small rows of Facebook / Instagram / WhatsApp icons — one per
// plantel. `tone` matches the footer it sits in (both current footers are
// on the dark navy panel).
export function CampusSocials({ className, tone = "dark" }: { className?: string; tone?: "dark" }) {
  const linkBase =
    tone === "dark"
      ? "border-white/20 text-white/75 hover:border-white/45 hover:bg-white/10 hover:text-white"
      : "border-border text-muted hover:border-primary/40 hover:text-primary";

  return (
    <div className={className}>
      <h3 className="text-xs font-medium tracking-[0.2em] text-white/50 uppercase">Síguenos</h3>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {CAMPUS_SOCIALS.map((c) => {
          const items = [
            { label: `Facebook de Bristol ${c.campus}`, href: c.facebook, icon: <GlyphFacebook size={16} /> },
            { label: `Instagram de Bristol ${c.campus}`, href: c.instagram, icon: <GlyphInstagram size={16} /> },
            {
              label: `WhatsApp de Bristol ${c.campus}`,
              href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`,
              icon: <GlyphWhatsApp size={16} />,
            },
          ];
          return (
            <div key={c.campus}>
              <p className="text-sm font-medium text-white/80">Bristol {c.campus}</p>
              <div className="mt-2 flex gap-2">
                {items.map((it) => (
                  <a
                    key={it.label}
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={it.label}
                    title={it.label}
                    className={clsx(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      linkBase
                    )}
                  >
                    {it.icon}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
