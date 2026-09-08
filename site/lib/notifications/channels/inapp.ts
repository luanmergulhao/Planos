import type { NotificationChannel } from "@/lib/notifications/types";

// A linha em `notifications` já É a entrega in-app (é isso que a
// caixa de entrada e o sininho leem) — esse canal só existe pra
// aparecer no log de notification_deliveries de forma consistente com
// os outros canais.
export const inappChannel: NotificationChannel = {
  name: "inapp",
  async send() {
    return { ok: true };
  },
};
