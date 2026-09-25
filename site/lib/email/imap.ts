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

export type Caixa = {
  email: string;
  senha: string;
  /** só e-mails desses remetentes entram */
  remetentes: string[];
};

// A caixa do .env, de antes de dar pra conectar contas por Plano.
export function caixaDoEnv(): Caixa | null {
  const email = process.env.EMAIL_CAIXA;
  const senha = process.env.EMAIL_SENHA_APP;
  const remetente = process.env.EMAIL_CB_REMETENTE;
  if (!email || !senha || !remetente) return null;
  return { email, senha, remetentes: remetente.split(",").map((r) => r.trim()).filter(Boolean) };
}

function conectar(caixa: Pick<Caixa, "email" | "senha">) {
  const host = process.env.EMAIL_IMAP_HOST ?? "imap.gmail.com";
  // o Google mostra a senha de app em 4 blocos com espaço
  const pass = caixa.senha.replace(/\s+/g, "");
  return new ImapFlow({ host, port: 993, secure: true, auth: { user: caixa.email, pass }, logger: false });
}

// Traduz a recusa de login do Google, que é o erro mais comum ao conectar.
export function mensagemDeErro(err: unknown): string {
  const e = err as { authenticationFailed?: boolean; message?: string };
  if (e?.authenticationFailed) {
    return "o Google recusou o login — confira se é a senha de app (16 letras) dessa conta, e não a senha normal";
  }
  return e?.message ?? "falha ao acessar a caixa de e-mail";
}

// Só entra e sai: usado ao conectar uma conta, pra avisar na hora se a
// senha está errada.
export async function testarCaixa(caixa: Pick<Caixa, "email" | "senha">) {
  const client = conectar(caixa);
  await client.connect();
  await client.logout();
}

export async function buscarEmailsDaCB(
  caixa: Caixa,
  { desdeDias = 3 }: { desdeDias?: number } = {}
): Promise<EmailBruto[]> {
  if (caixa.remetentes.length === 0) return [];

  const client = conectar(caixa);
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - desdeDias * 24 * 60 * 60 * 1000);
      const deQuem =
        caixa.remetentes.length === 1
          ? { from: caixa.remetentes[0] }
          : { or: caixa.remetentes.map((from) => ({ from })) };
      const emails: EmailBruto[] = [];

      for await (const msg of client.fetch({ ...deQuem, since }, { envelope: true, source: true })) {
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
          remetente: parsed.from?.text ?? caixa.remetentes[0],
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
