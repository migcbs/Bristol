import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";

// The "banner de pendientes al ingresar a la sesión" the user asked for
// 2026-09-09 — a home-dashboard summary of unread notifications, more
// prominent than the header bell (which stays for ongoing use once
// you're already working). Renders nothing when there's nothing pending,
// so it never becomes permanent decoration.
export async function PendingBanner({ userId }: { userId: string }) {
  const notifications = await prisma.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  if (notifications.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <Bell size={16} />
        {notifications.length === 1 ? "Tienes 1 pendiente" : `Tienes ${notifications.length}+ pendientes`}
      </div>
      <ul className="mt-2 space-y-1.5">
        {notifications.map((n) => (
          <li key={n.id} className="text-sm text-amber-900">
            {n.link ? (
              <Link href={n.link} className="underline decoration-amber-400 underline-offset-2 hover:text-amber-700">
                {n.message}
              </Link>
            ) : (
              n.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
