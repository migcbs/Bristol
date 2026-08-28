import { describe, it, expect } from "vitest";
import { computeFinancialStatus } from "@/lib/financial-status";

describe("computeFinancialStatus", () => {
  it("returns AL_CORRIENTE when there are no invoices", () => {
    expect(computeFinancialStatus([])).toBe("AL_CORRIENTE");
  });

  it("returns AL_CORRIENTE when every invoice is PAID or CANCELED", () => {
    expect(computeFinancialStatus([{ status: "PAID" }, { status: "CANCELED" }])).toBe("AL_CORRIENTE");
  });

  it("returns MOROSO when any invoice is OVERDUE, even if others are PENDING", () => {
    expect(computeFinancialStatus([{ status: "PENDING" }, { status: "OVERDUE" }])).toBe("MOROSO");
  });

  it("returns PENDIENTE_DE_COBRO when at least one invoice is PENDING and none are OVERDUE", () => {
    expect(computeFinancialStatus([{ status: "PAID" }, { status: "PENDING" }])).toBe("PENDIENTE_DE_COBRO");
  });
});
