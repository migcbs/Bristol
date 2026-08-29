"use client";

import { useEffect, useState } from "react";

interface NotificationRow {
  id: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch {
      // silent — the bell just stays as-is
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full px-2 py-1 text-sm"
        aria-label="Notificaciones"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-white p-2 shadow-lg">
          {notifications.length === 0 && <p className="p-2 text-sm text-muted">Sin notificaciones.</p>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-md p-2 text-sm ${n.readAt ? "text-muted" : "font-medium"}`}
            >
              <p>{n.message}</p>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} className="mt-1 text-xs text-primary underline">
                  Marcar como leída
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
