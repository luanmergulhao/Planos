// Busca de resultados assistida por IA (prompt "R" do manual) — pra
// editais já enviados, pesquisa na internet inteira (não só o link do
// edital) por resultados parciais, finais, homologações etc.

export type TipoResultado =
  | "parcial"
  | "final"
  | "habilitados"
  | "aprovados"
  | "recursos"
  | "homologacao"
  | "convocacao"
  | "outros"
  | "nao_localizado";

export type ResultadoFinding = {
  id: string; // edital_id, ecoado de volta pra eu casar a resposta
  data_divulgacao: string | null;
  tipo_resultado: TipoResultado;
  publicacao: string | null;
  detalhamento: string | null;
  link: string | null;
};

export type EditalForSearch = { id: string; titulo: string; link: string | null };

export const TIPO_RESULTADO_LABEL: Record<TipoResultado, string> = {
  parcial: "Resultado parcial",
  final: "Resultado final",
  habilitados: "Lista de habilitados",
  aprovados: "Lista de aprovados",
  recursos: "Resultado de recursos",
  homologacao: "Homologação",
  convocacao: "Convocação",
  outros: "Outros",
  nao_localizado: "Não localizado",
};

const MODEL = "gemini-2.5-flash";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resultados: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "o id do edital, exatamente como foi fornecido" },
          data_divulgacao: { type: "STRING", nullable: true, description: "YYYY-MM-DD, se souber" },
          tipo_resultado: {
            type: "STRING",
            enum: [
              "parcial",
              "final",
              "habilitados",
              "aprovados",
              "recursos",
              "homologacao",
              "convocacao",
              "outros",
              "nao_localizado",
            ],
          },
          publicacao: { type: "STRING", nullable: true },
          detalhamento: { type: "STRING", nullable: true },
          link: { type: "STRING", nullable: true },
        },
        required: ["id", "tipo_resultado"],
      },
    },
  },
  required: ["resultados"],
};

function buildPrompt(editais: EditalForSearch[]): string {
  const lista = editais
    .map((e, i) => `${i + 1}. id: ${e.id} | título: ${e.titulo}${e.link ? ` | link: ${e.link}` : ""}`)
    .join("\n");

  return `Você é um assistente especializado em monitoramento de editais culturais, leis de incentivo e chamadas públicas. Sua tarefa é pesquisar em toda a internet — não só no link informado, já que resultados costumam sair em diário oficial, no site do patrocinador, redes sociais, etc — e encontrar o resultado mais recente disponível de cada edital abaixo (e apenas estes): resultados parciais, resultados finais, listas de habilitados, listas de aprovados, resultado de recursos, homologação, convocação, ou qualquer comunicado oficial equivalente.

Regras obrigatórias:
- Não inventar informações. Se não encontrar nada confiável, use tipo_resultado "nao_localizado" e deixe os outros campos null.
- Pra cada edital, devolva um item no array "resultados", usando o campo "id" EXATAMENTE igual ao fornecido na lista abaixo (é assim que eu vou casar sua resposta com o edital certo).
- "detalhamento" deve focar na situação do nosso projeto especificamente, quando der pra identificar (aprovado, na lista de espera, etc), não um resumo genérico do edital.
- "link" é o link direto da publicação do resultado (não o link do edital em si).

Editais para pesquisar:
${lista}`;
}

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function searchResultados(editais: EditalForSearch[]): Promise<ResultadoFinding[]> {
  if (editais.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(editais) }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Gemini respondeu ${res.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini não devolveu texto (pode ter bloqueado a busca)");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch {
    throw new Error("Não deu pra ler a resposta da IA como JSON");
  }

  const resultados = (parsed as { resultados?: ResultadoFinding[] })?.resultados;
  return Array.isArray(resultados) ? resultados : [];
}
