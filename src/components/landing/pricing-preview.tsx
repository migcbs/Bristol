"use client";

import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PACKAGES = [
  { name: "Mensual", price: "$XXX/mes", note: "Ideal para empezar" },
  { name: "Semestral", price: "$X,XXX", note: "Ahorra 2 meses", highlight: true },
  { name: "Anual", price: "$XX,XXX", note: "El mejor precio por mes" },
];

export function PricingPreview() {
  return (
    <Section id="precios" className="bg-surface">
      <h2 className="text-center text-3xl font-bold text-primary">Paquetes y precios</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
        Elige el plan que mejor se adapte a tu ritmo. Precios de referencia.
      </p>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <Card key={pkg.name} className={pkg.highlight ? "border-primary" : ""}>
            {pkg.highlight && <Badge tone="accent">Más popular</Badge>}
            <h3 className="mt-3 text-lg font-semibold">{pkg.name}</h3>
            <p className="mt-2 text-2xl font-bold text-primary">{pkg.price}</p>
            <p className="mt-2 text-sm text-gray-600">{pkg.note}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8 text-center">
        <a href="/precios" className="font-medium text-primary hover:underline">
          Ver detalle de paquetes →
        </a>
      </div>
    </Section>
  );
}
