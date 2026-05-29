"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, Bell, Check, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  recentNotificationsAction,
  type NotificationItem,
} from "@/server/actions/notifications";

const SEEN_KEY = "tripos:notifications:lastSeen";
const POLL_MS = 45_000;

// Top-bar awareness layer. Polls for inbound WhatsApp replies + accepted
// quotes; the unread badge counts items newer than the last time the user
// opened the dropdown (persisted in localStorage).
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem(SEEN_KEY) ?? "0");
    setLastSeen(stored);
  }, []);

  const load = useCallback(() => {
    recentNotificationsAction()
      // Guard against a server-action edge case where the resolved value
      // arrives as undefined — treat it as "no change", not "empty list".
      .then((next) => Array.isArray(next) && setItems(next))
      .catch(() => {
        /* transient — keep prior list */
      });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Defensive: items should always be an array per the useState default,
  // but a stale dev-time hot-reload chunk has been seen handing back
  // undefined here. Coalesce so the bell never crashes the page.
  const safeItems = Array.isArray(items) ? items : [];
  const unread = safeItems.filter(
    (i) => new Date(i.createdAt).getTime() > lastSeen
  ).length;

  function markSeen() {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && markSeen()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-line bg-paper text-ink-2 transition-colors hover:border-[var(--gold-line)] hover:bg-paper-2"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-medium text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-line">
          <p className="text-sm font-medium text-navy">Notifications</p>
          {unread > 0 ? (
            <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">
              {unread} new
            </span>
          ) : null}
        </div>

        {safeItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Check className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">
              You're all caught up.
            </p>
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {safeItems.map((n) => {
              const fresh = new Date(n.createdAt).getTime() > lastSeen;
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className={
                      "flex gap-2.5 px-3 py-2.5 hover:bg-ivory transition-colors border-b border-line/60 last:border-b-0 " +
                      (fresh ? "bg-emerald-50/40" : "")
                    }
                  >
                    <span
                      className={
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border " +
                        (n.kind === "whatsapp_inbound"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                          : "border-sand-200 bg-sand-50 text-sand-800")
                      }
                    >
                      {n.kind === "whatsapp_inbound" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-navy truncate">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {n.body}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
