import type { LeadSource } from "@prisma/client";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEB: "Sitio web",
  REDES_SOCIALES: "Redes sociales",
  REFERIDO: "Referido",
  VISITA_PRESENCIAL: "Visita presencial",
  OTRO: "Otro",
  PRESENCIAL_RECEPCION: "Presencial (Recepción)",
  VOLANTEO: "Volanteo",
};
