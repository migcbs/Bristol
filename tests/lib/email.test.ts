import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => {
  return {
    Resend: class {
      emails = { send: sendMock };
    },
  };
});

describe("sendAnnouncementEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue({});
  });

  it("sends an email with the announcement's title and body", async () => {
    const { sendAnnouncementEmail } = await import("@/lib/email");
    await sendAnnouncementEmail("parent@example.com", { title: "Suspensión de clases", body: "Mañana no hay clases." });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "parent@example.com",
        subject: "Suspensión de clases",
        html: expect.stringContaining("Mañana no hay clases."),
      })
    );
  });
});
