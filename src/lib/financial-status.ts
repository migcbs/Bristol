export type FinancialStatus = "AL_CORRIENTE" | "PENDIENTE_DE_COBRO" | "MOROSO";

export function computeFinancialStatus(
  invoices: { status: string; dueDate: Date | string }[],
  now: Date = new Date()
): FinancialStatus {
  const isOverdue = (i: { status: string; dueDate: Date | string }) =>
    i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < now);
  if (invoices.some(isOverdue)) return "MOROSO";
  if (invoices.some((i) => i.status === "PENDING")) return "PENDIENTE_DE_COBRO";
  return "AL_CORRIENTE";
}
