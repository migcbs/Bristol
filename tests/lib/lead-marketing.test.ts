import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { groupBy: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getLeadMarketingSummary } from "@/lib/lead-marketing";

describe("getLeadMarketingSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups leads by status and by source using the given where clause", async () => {
    (prisma.lead.groupBy as any)
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ source: "WEB", _count: { _all: 2 } }]);

    const where = { campusId: { in: ["c1"] } };
    const result = await getLeadMarketingSummary(where);

    expect(result).toEqual({
      byStatus: [{ status: "NEW", count: 3 }],
      bySource: [{ source: "WEB", count: 2 }],
    });

    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["source"],
      where,
      _count: { _all: true },
    });
  });

  it("returns empty arrays when there are no leads", async () => {
    (prisma.lead.groupBy as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getLeadMarketingSummary({});

    expect(result).toEqual({ byStatus: [], bySource: [] });
  });
});
