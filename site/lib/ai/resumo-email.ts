import { callGemini } from "@/lib/ai/gemini";
import { getPromptTexto, renderPrompt } from "@/lib/ai/prompts";

// Coluna C do Plano — EMAIL DE/PARA CB.
// Resume o que a CB pediu por e-mail: título, data e a tarefa solicitada.
// Nunca copia o e-mail inteiro, e ignora notificação de comentário de
// documento (essas chegam como e-mail, mas comentário já tem lugar
// próprio no Plano). O texto do prompt vem do banco, editável na aba
// Prompts.

export type EmailBruto = {
  id: string;
  assunto: string;
  remetente: string;
  /** Data de recebimento, AAAA-MM-DD. */
  data: string;
  corpo: string;
};

export type ResumoEmail = {
  /** ecoado de volta pra eu casar a resposta com o e-mail certo */
  id: string;
  titulo: string;
  data: string;
  tarefa_solicitada: string;
  /** false quando o e-mail é só aviso, sem nada pedido */
  tem_tarefa: boolean;
  /** notificação automática de comentário em documento — essas ficam
   *  fora do Plano, porque comentário já tem lugar próprio lá */
  eh_comentario: boolean;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    emails: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "o id do e-mail, exatamente como foi fornecido" },
          titulo: { type: "STRING" },
          data: { type: "STRING", description: "AAAA-MM-DD" },
          tarefa_solicitada: { type: "STRING" },
          tem_tarefa: { type: "BOOLEAN" },
          eh_comentario: { type: "BOOLEAN" },
        },
        required: ["id", "titulo", "data", "tarefa_solicitada", "tem_tarefa", "eh_comentario"],
      },
    },
  },
  required: ["emails"],
};

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function resumirEmailsDaCB(emails: EmailBruto[]): Promise<ResumoEmail[]> {
  if (emails.length === 0) return [];

  const lista = emails
    .map(
      (e) =>
        `--- E-MAIL id: ${e.id}\nDe: ${e.remetente}\nData: ${e.data}\nAssunto: ${e.assunto}\nCorpo:\n${e.corpo.slice(0, 4000)}`
    )
    .join("\n\n");

  const prompt = renderPrompt(await getPromptTexto("resumo_email"), { lista });

  const { texto: text } = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch {
    throw new Error("Não deu pra ler a resposta da IA como JSON");
  }

  const resumos = (parsed as { emails?: ResumoEmail[] })?.emails;
  return Array.isArray(resumos) ? resumos : [];
}
