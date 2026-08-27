import type { LeadStatus } from "@prisma/client";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  ENROLLED: "Inscrito",
  LOST: "Perdido",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, "primary" | "accent" | "neutral"> = {
  NEW: "primary",
  CONTACTED: "primary",
  ENROLLED: "accent",
  LOST: "neutral",
};
