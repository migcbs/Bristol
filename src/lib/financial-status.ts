export type FinancialStatus = "AL_CORRIENTE" | "PENDIENTE_DE_COBRO" | "MOROSO";

export function computeFinancialStatus(invoices: { status: string }[]): FinancialStatus {
  if (invoices.some((i) => i.status === "OVERDUE")) return "MOROSO";
  if (invoices.some((i) => i.status === "PENDING")) return "PENDIENTE_DE_COBRO";
  return "AL_CORRIENTE";
}
