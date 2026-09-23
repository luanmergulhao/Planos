import { enviarWhatsApp } from "@/lib/whatsapp/zapi";
import type { NotificationChannel } from "@/lib/notifications/types";

export const whatsappChannel: NotificationChannel = {
  name: "whatsapp",
  async send({ userPhone, title, body }) {
    if (!userPhone) {
      return { ok: false, skipped: true, error: "sem telefone cadastrado em notification_preferences.phone_number" };
    }
    const mensagem = body ? `*${title}*\n${body}` : `*${title}*`;
    const resultado = await enviarWhatsApp(userPhone, mensagem);
    return resultado.ok ? { ok: true } : { ok: false, error: resultado.error };
  },
};
