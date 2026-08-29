import { describe, it, expect } from "vitest";
import { computeFinancialStatus } from "@/lib/financial-status";

const FAR_FUTURE = "2999-01-01";
const FAR_PAST = "2000-01-01";

describe("computeFinancialStatus", () => {
  it("returns AL_CORRIENTE when there are no invoices", () => {
    expect(computeFinancialStatus([])).toBe("AL_CORRIENTE");
  });

  it("returns AL_CORRIENTE when every invoice is PAID or CANCELED", () => {
    expect(
      computeFinancialStatus([
        { status: "PAID", dueDate: FAR_PAST },
        { status: "CANCELED", dueDate: FAR_PAST },
      ])
    ).toBe("AL_CORRIENTE");
  });

  it("returns MOROSO when any invoice is OVERDUE, even if others are PENDING", () => {
    expect(
      computeFinancialStatus([
        { status: "PENDING", dueDate: FAR_FUTURE },
        { status: "OVERDUE", dueDate: FAR_FUTURE },
      ])
    ).toBe("MOROSO");
  });

  it("returns PENDIENTE_DE_COBRO when at least one invoice is PENDING and none are OVERDUE", () => {
    expect(
      computeFinancialStatus([
        { status: "PAID", dueDate: FAR_PAST },
        { status: "PENDING", dueDate: FAR_FUTURE },
      ])
    ).toBe("PENDIENTE_DE_COBRO");
  });

  it("returns MOROSO for a PENDING invoice whose dueDate is in the past", () => {
    expect(computeFinancialStatus([{ status: "PENDING", dueDate: FAR_PAST }])).toBe("MOROSO");
  });

  it("returns PENDIENTE_DE_COBRO for a PENDING invoice whose dueDate is in the future", () => {
    expect(computeFinancialStatus([{ status: "PENDING", dueDate: FAR_FUTURE }])).toBe(
      "PENDIENTE_DE_COBRO"
    );
  });
});
