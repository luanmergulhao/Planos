import { callGemini } from "@/lib/ai/gemini";
import type { RevisaoStatus } from "@/lib/supabase/types";

// Confere, com IA, se o deadline de UM edital foi prorrogado, mantido ou
// encerrado. Com link cadastrado a IA lê a página oficial (e os PDFs de
// retificação linkados nela); sem link ela tenta achar pela busca do
// Google — que só funciona com faturamento ativo na conta do Gemini.

export type ProrrogacaoResult = {
  status: RevisaoStatus;
  novo_deadline_iso: string | null;
  novo_deadline_texto: string | null;
  evidencia: string;
  fonte_link: string | null;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["mantido", "prorrogado", "encerrado", "nao_confirmado"] },
    novo_deadline_iso: { type: "STRING", nullable: true },
    novo_deadline_texto: { type: "STRING", nullable: true },
    evidencia: { type: "STRING" },
    fonte_link: { type: "STRING", nullable: true },
  },
  required: ["status", "novo_deadline_iso", "novo_deadline_texto", "evidencia", "fonte_link"],
};

function dataBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function buildPrompt(titulo: string, deadline: string, link: string | null): string {
  const origem = link
    ? `Link oficial do edital: ${link}\nUse essa página e os documentos oficiais linkados nela (edital em PDF, retificações, erratas, avisos).`
    : `Não temos o link do edital. Pesquise na internet a página oficial dele e os comunicados oficiais do órgão responsável.`;

  return `Você é um assistente de monitoramento de editais culturais, leis de incentivo e chamadas públicas. Sua tarefa é conferir se o prazo de inscrição de UM edital foi prorrogado, mantido ou encerrado.

Edital (como está anotado na nossa agenda): ${titulo}
Deadline que temos anotado: ${dataBR(deadline)}
${origem}

Procure especificamente por: aviso de prorrogação, retificação, errata, novo cronograma, adiamento, suspensão ou cancelamento das inscrições.

Regras obrigatórias:
- Não invente. Se não encontrar evidência oficial clara, use status "nao_confirmado".
- "prorrogado": só se houver comunicado oficial com nova data de inscrição POSTERIOR a ${dataBR(deadline)}.
- "mantido": a fonte oficial confirma a mesma data que temos anotada.
- "encerrado": inscrições encerradas antes do prazo, suspensas, ou edital cancelado.
- novo_deadline_iso: só quando "prorrogado" — a nova data no formato YYYY-MM-DD, convertida pro fuso de Brasília. Nos demais casos, null.
- novo_deadline_texto: só quando "prorrogado" — data, hora e fuso exatamente como aparecem na fonte (ex: "25/09/2026 às 18h, horário de Brasília"). Nos demais casos, null.
- evidencia: uma frase curta dizendo onde está a informação (ex: "Aviso de prorrogação publicado em 10/09 na página do edital").
- fonte_link: link direto da página ou documento onde encontrou a informação, ou null.`;
}

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function checkProrrogacao({
  titulo,
  deadline,
  link,
}: {
  titulo: string;
  deadline: string;
  link: string | null;
}): Promise<ProrrogacaoResult> {
  const text = await callGemini({
    contents: [{ parts: [{ text: buildPrompt(titulo, deadline, link) }] }],
    tools: [link ? { url_context: {} } : { google_search: {} }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let parsed: ProrrogacaoResult;
  try {
    parsed = JSON.parse(extractJsonText(text)) as ProrrogacaoResult;
  } catch {
    throw new Error("Não deu pra ler a resposta da IA como JSON");
  }

  // "prorrogado" sem uma data nova de fato posterior não serve pra
  // ninguém mexer na agenda — rebaixa pra não confirmado.
  if (
    parsed.status === "prorrogado" &&
    (!parsed.novo_deadline_iso || parsed.novo_deadline_iso <= deadline)
  ) {
    return {
      ...parsed,
      status: "nao_confirmado",
      evidencia: `Indício de prorrogação, mas sem nova data posterior a ${dataBR(deadline)} confirmada. ${parsed.evidencia}`,
    };
  }

  return parsed;
}
