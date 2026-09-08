"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (!res.ok) return;
        const { count: fresh } = await res.json();
        setCount(fresh);
      } catch {
        // silencioso — próxima rodada de polling tenta de novo
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      render={
        <Link href="/notificacoes">
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Link>
      }
    />
  );
}
