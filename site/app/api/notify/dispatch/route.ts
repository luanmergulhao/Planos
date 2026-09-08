import { NextResponse } from "next/server";
import { dispatchNotification } from "@/lib/notifications/dispatch";

// Alvo do Supabase Database Webhook configurado no painel (Database >
// Webhooks): dispara em AFTER INSERT em `notifications` e manda pra
// cá o payload { type, table, record, ... }. Configure lá um header
// `x-automation-secret: <CRON_SECRET>` pra autenticar a chamada.
export async function POST(request: Request) {
  const secret = request.headers.get("x-automation-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const notificationId = payload?.record?.id;

  if (!notificationId) {
    return NextResponse.json({ error: "payload sem record.id" }, { status: 400 });
  }

  const result = await dispatchNotification(notificationId);
  return NextResponse.json(result);
}
