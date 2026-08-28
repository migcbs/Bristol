import { describe, it, expect } from "vitest";
import { computeAgeBracket } from "@/lib/age-bracket";

describe("computeAgeBracket", () => {
  it("classifies under 12 as NINO", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2016-06-01"), asOf)).toBe("NINO");
  });

  it("classifies 12-17 as ADOLESCENTE", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2012-06-01"), asOf)).toBe("ADOLESCENTE");
  });

  it("classifies 18+ as ADULTO", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2000-06-01"), asOf)).toBe("ADULTO");
  });

  it("handles a birthday that hasn't happened yet this year", () => {
    const asOf = new Date("2026-01-01");
    // turns 12 on 2026-12-01, so as of 2026-01-01 is still 11 -> NINO
    expect(computeAgeBracket(new Date("2014-12-01"), asOf)).toBe("NINO");
  });
});
