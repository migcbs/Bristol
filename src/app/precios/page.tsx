import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clsx } from "clsx";

const PACKAGES = [
  {
    name: "Mensual",
    price: "$XXX/mes",
    features: ["Acceso a un grupo por nivel", "Material digital incluido", "Sin permanencia forzosa"],
  },
  {
    name: "Semestral",
    price: "$X,XXX",
    features: ["Equivale a 2 meses gratis", "Material digital incluido", "Prioridad de horario"],
    highlight: true,
  },
  {
    name: "Anual",
    price: "$XX,XXX",
    features: ["El mejor precio por mes", "Material digital incluido", "Un cambio de horario sin costo"],
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="bg-primary px-6 py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Paquetes y precios
          </h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Precios de referencia — el costo final puede variar por plantel y
            promociones vigentes. Contáctanos para una cotización exacta.
          </p>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid items-center gap-6 md:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <Card
              key={pkg.name}
              className={clsx(
                pkg.highlight
                  ? "border-transparent bg-primary text-primary-foreground md:scale-105 md:py-9"
                  : ""
              )}
            >
              {pkg.highlight && <Badge tone="accent">Más popular</Badge>}
              <h2 className="mt-3 font-display text-xl font-semibold">{pkg.name}</h2>
              <p className="mt-2 font-display text-2xl font-bold">{pkg.price}</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {pkg.features.map((f) => (
                  <li
                    key={f}
                    className={clsx(
                      "flex items-start gap-2",
                      pkg.highlight ? "text-white/85" : "text-muted"
                    )}
                  >
                    <span className={pkg.highlight ? "text-white" : "text-accent"}>
                      <CheckIcon />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
