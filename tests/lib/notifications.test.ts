import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

describe("notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a notification with the given userId, message, and link", async () => {
    (prisma.notification.create as any).mockResolvedValue({ id: "n1" });
    await notify("u1", "Tu solicitud fue aprobada", "/admin/control-escolar/solicitudes");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Tu solicitud fue aprobada", link: "/admin/control-escolar/solicitudes" },
    });
  });

  it("creates a notification with a null link when omitted", async () => {
    (prisma.notification.create as any).mockResolvedValue({ id: "n1" });
    await notify("u1", "Se te asignó un lead");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Se te asignó un lead", link: null },
    });
  });

  it("swallows a Prisma error rather than throwing, so a failed notification never breaks the caller's business logic", async () => {
    (prisma.notification.create as any).mockRejectedValue(new Error("DB down"));
    await expect(notify("u1", "test")).resolves.toBeUndefined();
  });
});
