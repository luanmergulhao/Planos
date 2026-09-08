"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type NotificationEntry = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  mention: "Menção",
  comment_reply: "Comentário",
  deadline_reminder: "Prazo",
  daily_digest: "Resumo diário",
  share_granted: "Acesso liberado",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function NotificationList({ initialNotifications }: { initialNotifications: NotificationEntry[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const supabase = useMemo(() => createClient(), []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }

  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="flex flex-col gap-3">
      {unread.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => unread.forEach((n) => markRead(n.id))}
        >
          Marcar todas como lidas
        </Button>
      )}
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
      ) : (
        notifications.map((n) => (
          <Card key={n.id} className={n.read_at ? "opacity-60" : undefined}>
            <CardContent className="flex items-start justify-between gap-3 py-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                {n.link_path && (
                  <Link
                    href={n.link_path}
                    onClick={() => !n.read_at && markRead(n.id)}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver no Plano
                  </Link>
                )}
              </div>
              {!n.read_at && (
                <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                  Marcar como lida
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
