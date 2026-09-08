import { requireProfile } from "@/lib/auth/current-user";
import { NotificationList } from "@/components/notifications/NotificationList";

export default async function NotificacoesPage() {
  const { supabase, user } = await requireProfile();

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-muted-foreground">Menções, comentários e lembretes.</p>
      </div>
      <NotificationList initialNotifications={data ?? []} />
    </div>
  );
}
