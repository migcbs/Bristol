import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMatricula } from "@/lib/matricula";

describe("generateMatricula", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces BRI-<year>-<5-digit-padded-count+1>", async () => {
    const tx = { student: { count: vi.fn().mockResolvedValue(41) } } as any;
    const matricula = await generateMatricula(tx, new Date("2026-03-01"));
    expect(matricula).toBe("BRI-2026-00042");
    expect(tx.student.count).toHaveBeenCalledWith({
      where: { matricula: { startsWith: "BRI-2026-" } },
    });
  });
});
