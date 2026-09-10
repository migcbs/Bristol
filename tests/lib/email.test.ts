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

  it("escapes HTML special characters in the body", async () => {
    const { sendAnnouncementEmail } = await import("@/lib/email");
    await sendAnnouncementEmail("parent@example.com", {
      title: "Aviso",
      body: "<script>alert('hi')</script> & \"quoted\"",
    });

    const call = sendMock.mock.calls[0][0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;alert(&#39;hi&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;");
  });

  it("converts newlines in the body to <br>", async () => {
    const { sendAnnouncementEmail } = await import("@/lib/email");
    await sendAnnouncementEmail("parent@example.com", {
      title: "Aviso",
      body: "Línea uno\nLínea dos",
    });

    const call = sendMock.mock.calls[0][0];
    expect(call.html).toContain("Línea uno<br>Línea dos");
  });
});

// The Resend SDK (v6) resolves with `{ data: null, error }` on an API-level
// failure instead of throwing — caught live via enviar-recibo marking
// reciboFiscalEnviado true on a 401 "API key is invalid". Every send*
// helper must turn that into a thrown error so callers' try/catch works.
describe("send* helpers reject when Resend reports an API error", () => {
  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue({ data: null, error: { message: "API key is invalid" } });
  });

  it("sendAnnouncementEmail throws instead of resolving silently", async () => {
    const { sendAnnouncementEmail } = await import("@/lib/email");
    await expect(sendAnnouncementEmail("parent@example.com", { title: "Aviso", body: "..." })).rejects.toThrow(
      "API key is invalid"
    );
  });

  it("sendReciboFiscalEmail throws instead of resolving silently", async () => {
    const { sendReciboFiscalEmail } = await import("@/lib/email");
    await expect(
      sendReciboFiscalEmail("alumno@example.com", {
        concepto: "Colegiatura",
        montoFormatted: "$1,500.00",
        fechaPago: "01/09/2026",
        fiscal: null,
      })
    ).rejects.toThrow("API key is invalid");
  });
});
