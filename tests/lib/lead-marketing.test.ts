import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { groupBy: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getLeadMarketingSummary } from "@/lib/lead-marketing";

describe("getLeadMarketingSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups leads by status, by source, and computes conversion rate per source", async () => {
    (prisma.lead.groupBy as any)
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ source: "WEB", _count: { _all: 4 } }])
      .mockResolvedValueOnce([
        { source: "WEB", status: "NEW", _count: { _all: 3 } },
        { source: "WEB", status: "ENROLLED", _count: { _all: 1 } },
      ]);

    const where = { campusId: { in: ["c1"] } };
    const result = await getLeadMarketingSummary(where);

    expect(result).toEqual({
      byStatus: [{ status: "NEW", count: 3 }],
      bySource: [{ source: "WEB", count: 4, enrolled: 1, conversionRate: 25 }],
    });

    expect(prisma.lead.groupBy).toHaveBeenCalledWith({ by: ["status"], where, _count: { _all: true } });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({ by: ["source"], where, _count: { _all: true } });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({ by: ["source", "status"], where, _count: { _all: true } });
  });

  it("a source with zero ENROLLED leads gets a 0% conversion rate, not NaN", async () => {
    (prisma.lead.groupBy as any)
      .mockResolvedValueOnce([{ status: "LOST", _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ source: "REDES_SOCIALES", _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ source: "REDES_SOCIALES", status: "LOST", _count: { _all: 2 } }]);

    const result = await getLeadMarketingSummary({});
    expect(result.bySource).toEqual([{ source: "REDES_SOCIALES", count: 2, enrolled: 0, conversionRate: 0 }]);
  });

  it("returns empty arrays when there are no leads", async () => {
    (prisma.lead.groupBy as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getLeadMarketingSummary({});

    expect(result).toEqual({ byStatus: [], bySource: [] });
  });
});
