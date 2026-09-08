import { createAdminClient } from "@/lib/supabase/admin";
import { inappChannel } from "@/lib/notifications/channels/inapp";
import { emailChannel } from "@/lib/notifications/channels/email";
import type { NotificationChannel } from "@/lib/notifications/types";

// Registro de canais ativos. Adicionar WhatsApp na fase 2 é: escrever
// lib/notifications/channels/whatsapp.ts e incluir aqui — nada nesta
// função nem no gatilho do banco (handle_new_comment) muda.
const CHANNELS: NotificationChannel[] = [inappChannel, emailChannel];

// Chamado pelo webhook do Supabase (POST /api/notify/dispatch) sempre
// que uma linha nova entra em `notifications`. Usa a service role
// porque precisa ler o perfil/preferências do destinatário, não de
// quem originou a ação.
export async function dispatchNotification(notificationId: string) {
  const admin = createAdminClient();

  const { data: notification } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, link_path")
    .eq("id", notificationId)
    .single();

  if (!notification) return { ok: false, error: "notificação não encontrada" };

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", notification.user_id).single(),
    admin.from("notification_preferences").select("*").eq("user_id", notification.user_id).single(),
  ]);

  if (!profile) return { ok: false, error: "perfil do destinatário não encontrado" };

  const activeChannels = CHANNELS.filter((channel) => {
    if (channel.name === "inapp") return true;
    if (channel.name === "email") return prefs?.email_enabled ?? true;
    if (channel.name === "whatsapp") return prefs?.whatsapp_enabled ?? false;
    return false;
  });

  for (const channel of activeChannels) {
    const result = await channel.send({
      userEmail: profile.email,
      userName: profile.full_name,
      title: notification.title,
      body: notification.body,
      linkPath: notification.link_path,
    });

    await admin.from("notification_deliveries").insert({
      notification_id: notification.id,
      channel: channel.name,
      status: result.skipped ? "skipped" : result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.error ?? null,
    });
  }

  return { ok: true };
}
