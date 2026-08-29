import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget notification creation. A failure here (e.g. a transient
 * DB error) must never propagate to the caller — notify() is always called
 * from inside an already-successful business operation (an approval, an
 * assignment), and that operation's own success must not be undone by a
 * notification-side failure.
 */
export async function notify(userId: string, message: string, link?: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, message, link: link ?? null } });
  } catch (error) {
    console.error("No se pudo crear la notificación:", error);
  }
}
