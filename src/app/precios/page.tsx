import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-primary">Paquetes y precios</h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          Precios de referencia — el costo final puede variar por plantel y
          promociones vigentes. Contáctanos para una cotización exacta.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <Card key={pkg.name} className={pkg.highlight ? "border-primary" : ""}>
              {pkg.highlight && <Badge tone="accent">Más popular</Badge>}
              <h2 className="mt-3 text-xl font-semibold">{pkg.name}</h2>
              <p className="mt-2 text-2xl font-bold text-primary">{pkg.price}</p>
              <ul className="mt-4 space-y-1 text-sm text-gray-600">
                {pkg.features.map((f) => (
                  <li key={f}>• {f}</li>
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
