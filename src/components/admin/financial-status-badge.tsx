import { Badge } from "@/components/ui/badge";
import type { FinancialStatus } from "@/lib/financial-status";

const LABELS: Record<FinancialStatus, string> = {
  AL_CORRIENTE: "Al Corriente",
  PENDIENTE_DE_COBRO: "Pendiente de Cobro",
  MOROSO: "Moroso",
};

const TONES: Record<FinancialStatus, "primary" | "accent" | "neutral"> = {
  AL_CORRIENTE: "primary",
  PENDIENTE_DE_COBRO: "neutral",
  MOROSO: "accent",
};

export function FinancialStatusBadge({ status }: { status: FinancialStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
