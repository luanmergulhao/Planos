import { Resend } from "resend";
import type { NotificationChannel } from "@/lib/notifications/types";

let resend: Resend | null = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export const emailChannel: NotificationChannel = {
  name: "email",
  async send({ userEmail, userName, title, body, linkPath }) {
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, skipped: true, error: "RESEND_API_KEY não configurada" };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = linkPath ? `${siteUrl}${linkPath}` : siteUrl;

    try {
      const { error } = await getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "Planos <onboarding@resend.dev>",
        to: userEmail,
        subject: title,
        html: `
          <p>Oi${userName ? " " + userName : ""},</p>
          <p>${body ?? title}</p>
          <p><a href="${link}">Abrir no Planos</a></p>
        `,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "erro desconhecido" };
    }
  },
};
