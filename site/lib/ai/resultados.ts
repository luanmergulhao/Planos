import { callGemini } from "@/lib/ai/gemini";
import { getPromptTexto, renderPrompt } from "@/lib/ai/prompts";
import type { EditalForSearch, ResultadoFinding } from "@/lib/ai/resultados-tipos";

// Busca de resultados assistida por IA (prompt "R" do manual) — pra
// editais já enviados, pesquisa na internet inteira (não só o link do
// edital) por resultados parciais, finais, homologações etc.
// O texto do prompt vem do banco, editável na aba Prompts.
//
// Este arquivo é só de servidor (chega no banco com chave de serviço).
// A tela importa de @/lib/ai/resultados-tipos.

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

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function searchResultados(editais: EditalForSearch[]): Promise<ResultadoFinding[]> {
  if (editais.length === 0) return [];

  const lista = editais
    .map((e, i) => `${i + 1}. id: ${e.id} | título: ${e.titulo}${e.link ? ` | link: ${e.link}` : ""}`)
    .join("\n");

  const prompt = renderPrompt(await getPromptTexto("resultados"), { lista });

  const { texto: text } = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
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

  const resultados = (parsed as { resultados?: ResultadoFinding[] })?.resultados;
  return Array.isArray(resultados) ? resultados : [];
}
