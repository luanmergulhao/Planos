// Envio de WhatsApp via Z-API (z-api.io) — conecta o número normal do
// WhatsApp (QR code no painel da Z-API), sem precisar de conta comercial
// verificada no Meta. Usado só pelo canal de notificação "whatsapp".

export async function enviarWhatsApp(numero: string, mensagem: string): Promise<{ ok: boolean; error?: string }> {
  const instancia = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  if (!instancia || !token) {
    return { ok: false, error: "Z-API não configurada (faltam ZAPI_INSTANCE_ID / ZAPI_TOKEN)" };
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const res = await fetch(`https://api.z-api.io/instances/${instancia}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(clientToken ? { "Client-Token": clientToken } : {}),
    },
    body: JSON.stringify({ phone: numero, message: mensagem }),
  });

  if (!res.ok) {
    return { ok: false, error: `Z-API respondeu ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  return { ok: true };
}
