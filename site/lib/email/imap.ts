// Leitura da caixa de e-mail pela senha de aplicativo do Google (IMAP).
// É só leitura: o site nunca responde, apaga nem marca nada como lido.
// Usado pela coluna C do Plano, que resume o que a CB pediu por e-mail.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { EmailBruto } from "@/lib/ai/resumo-email";

// Corta a parte citada da conversa: o histórico repetido a cada resposta
// só gasta contexto da IA e atrapalha o resumo.
export function limparCorpo(texto: string): string {
  const marcadores = [
    /^\s*Em .+escreveu:\s*$/im,
    /^\s*On .+wrote:\s*$/im,
    /^-{2,}\s*Mensagem encaminhada\s*-{2,}/im,
    /^-{2,}\s*Forwarded message\s*-{2,}/im,
  ];

  let corte = texto.length;
  for (const marcador of marcadores) {
    const achado = texto.match(marcador);
    if (achado?.index !== undefined && achado.index < corte) corte = achado.index;
  }

  return texto
    .slice(0, corte)
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function buscarEmailsDaCB({ desdeDias = 3 }: { desdeDias?: number } = {}): Promise<EmailBruto[]> {
  const host = process.env.EMAIL_IMAP_HOST ?? "imap.gmail.com";
  const user = process.env.EMAIL_CAIXA;
  const pass = process.env.EMAIL_SENHA_APP;
  const remetente = process.env.EMAIL_CB_REMETENTE;

  if (!user || !pass || !remetente) {
    throw new Error(
      "Configuração de e-mail incompleta: preencha EMAIL_CAIXA, EMAIL_SENHA_APP e EMAIL_CB_REMETENTE."
    );
  }

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - desdeDias * 24 * 60 * 60 * 1000);
      const emails: EmailBruto[] = [];

      for await (const msg of client.fetch({ from: remetente, since }, { envelope: true, source: true })) {
        if (!msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const corpo = limparCorpo(parsed.text ?? "");
        if (!corpo) continue;

        // dependendo do servidor, a data do envelope vem como texto
        const bruta = parsed.date ?? msg.envelope?.date ?? new Date();
        const recebidoEm = bruta instanceof Date ? bruta : new Date(bruta);

        emails.push({
          id: parsed.messageId ?? `uid-${msg.uid}`,
          assunto: parsed.subject ?? "(sem assunto)",
          remetente: parsed.from?.text ?? remetente,
          data: recebidoEm.toISOString().slice(0, 10),
          corpo,
        });
      }

      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
