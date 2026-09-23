export type NotificationChannelName = "inapp" | "email" | "whatsapp";

export type ChannelPayload = {
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  title: string;
  body: string | null;
  linkPath: string | null;
};

export type ChannelResult = { ok: boolean; error?: string; skipped?: boolean };

export interface NotificationChannel {
  name: NotificationChannelName;
  send(payload: ChannelPayload): Promise<ChannelResult>;
}
