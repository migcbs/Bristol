"use client";

import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";

const PACKAGES = [
  { name: "Mensual", price: "$XXX", period: "/mes", note: "Ideal para empezar" },
  { name: "Semestral", price: "$X,XXX", period: "/semestre", note: "Ahorra 2 meses", highlight: true },
  { name: "Anual", price: "$XX,XXX", period: "/año", note: "El mejor precio por mes" },
];

export function PricingPreview() {
  return (
    <Section id="precios" className="bg-surface">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-primary md:text-4xl">Paquetes y precios</h2>
        <p className="mt-3 text-muted">
          Elige el plan que mejor se adapte a tu ritmo. Precios de referencia.
        </p>
      </div>
      <div className="mx-auto mt-14 grid max-w-4xl items-center gap-6 md:grid-cols-3">
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
            <h3 className="mt-3 font-display text-lg font-semibold">{pkg.name}</h3>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold">{pkg.price}</span>
              <span className={pkg.highlight ? "text-white/60" : "text-muted"}>{pkg.period}</span>
            </p>
            <p className={clsx("mt-2 text-sm", pkg.highlight ? "text-white/75" : "text-muted")}>
              {pkg.note}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-12 text-center">
        <a href="/precios">
          <Button variant="outline">Ver detalle de paquetes</Button>
        </a>
      </div>
    </Section>
  );
}
