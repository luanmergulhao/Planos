import { callGemini } from "@/lib/ai/gemini";

// Coluna C do Plano — EMAIL DE/PARA CB.
// Resume o que a CB pediu por e-mail: título, data e a tarefa solicitada.
// Nunca copia o e-mail inteiro, e ignora notificação de comentário de
// documento (essas chegam como e-mail, mas comentário já tem lugar
// próprio no Plano).

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

function buildPrompt(emails: EmailBruto[]): string {
  const lista = emails
    .map(
      (e) =>
        `--- E-MAIL id: ${e.id}\nDe: ${e.remetente}\nData: ${e.data}\nAssunto: ${e.assunto}\nCorpo:\n${e.corpo.slice(0, 4000)}`
    )
    .join("\n\n");

  return `Você organiza a caixa de entrada de uma produtora cultural. Os e-mails abaixo foram enviados pela CB (Cândida), que coordena a equipe. Para cada e-mail, extraia o que a equipe precisa fazer.

Regras obrigatórias:
- NUNCA copie o e-mail inteiro. "tarefa_solicitada" tem no máximo duas frases curtas, começando por um verbo no infinitivo (ex: "Enviar a planilha de orçamento revisada até sexta").
- "titulo": o assunto do e-mail, limpo de prefixos como "Re:", "Res:", "Fwd:" e "Enc:".
- "data": a data de recebimento, no formato AAAA-MM-DD.
- "tem_tarefa": true só quando há algo concreto pedido à equipe. Aviso, agradecimento, confirmação ou e-mail só informativo é false.
- Quando "tem_tarefa" for false, deixe "tarefa_solicitada" como string vazia.
- "eh_comentario": true APENAS quando o e-mail for notificação automática de comentário em documento (Google Docs, Drive, "comentou em", "respondeu a um comentário", "mentioned you"). E-mail escrito pela própria CB é sempre false, mesmo que fale sobre um comentário.
- "eh_comentario" e "tem_tarefa" são independentes: um e-mail informativo escrito por ela tem "eh_comentario" false e "tem_tarefa" false.
- Se o e-mail pedir várias coisas, junte no mesmo "tarefa_solicitada", separadas por ponto e vírgula.
- Não invente prazo, valor nem nome que não esteja escrito no e-mail.
- Devolva um item por e-mail, com o campo "id" EXATAMENTE igual ao fornecido.
- Responda em português do Brasil.

E-mails:
${lista}`;
}

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function resumirEmailsDaCB(emails: EmailBruto[]): Promise<ResumoEmail[]> {
  if (emails.length === 0) return [];

  const text = await callGemini({
    contents: [{ parts: [{ text: buildPrompt(emails) }] }],
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
