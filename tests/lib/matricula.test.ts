import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMatricula } from "@/lib/matricula";

describe("generateMatricula", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces BRI-<year>-<5-digit-padded-lastSuffix+1>", async () => {
    const tx = {
      student: { findMany: vi.fn().mockResolvedValue([{ matricula: "BRI-2026-00041" }]) },
    } as any;
    const matricula = await generateMatricula(tx, new Date("2026-03-01"));
    expect(matricula).toBe("BRI-2026-00042");
    expect(tx.student.findMany).toHaveBeenCalledWith({
      where: { matricula: { startsWith: "BRI-2026-" } },
      select: { matricula: true },
      orderBy: { matricula: "desc" },
      take: 1,
    });
  });

  it("continues from the highest existing suffix even if earlier rows were deleted", async () => {
    // Simulates 2 deletions: only 3 rows currently exist, but the highest
    // surviving matrícula's suffix is 00005 (from a row later deleted would
    // have been 00006, but here the highest remaining is 00005).
    const tx = {
      student: { findMany: vi.fn().mockResolvedValue([{ matricula: "BRI-2026-00005" }]) },
    } as any;
    const matricula = await generateMatricula(tx, new Date("2026-03-01"));
    expect(matricula).toBe("BRI-2026-00006");
  });

  it("starts at 00001 when no matrículas exist yet for the year", async () => {
    const tx = {
      student: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const matricula = await generateMatricula(tx, new Date("2026-03-01"));
    expect(matricula).toBe("BRI-2026-00001");
  });
});
