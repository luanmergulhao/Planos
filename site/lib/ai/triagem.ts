import { callGemini } from "@/lib/ai/gemini";
import { getPromptTexto, renderPrompt } from "@/lib/ai/prompts";
import { TRIAGEM_FIELDS, type TriagemResult } from "@/lib/ai/triagem-campos";

// Extração assistida por IA da triagem de edital, a partir de um link.
// Mesma lógica que a equipe já fazia manualmente colando o link no
// Gemini com um prompt de perguntas fixas — só que agora dentro do
// site, com uma etapa de revisão antes de virar um edital de verdade.
// O texto do prompt vem do banco, editável na aba Prompts.
//
// Este arquivo é só de servidor (chega no banco com chave de serviço).
// A tela importa de @/lib/ai/triagem-campos.

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries([
    ...TRIAGEM_FIELDS.map((f) => [f.key, { type: "STRING" }]),
    ["deadline_iso_date", { type: "STRING", nullable: true }],
  ]),
  required: [...TRIAGEM_FIELDS.map((f) => f.key), "deadline_iso_date"],
};

export async function extractTriagemFromLink(link: string): Promise<TriagemResult> {
  const prompt = renderPrompt(await getPromptTexto("triagem"), { link });

  const text = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ url_context: {} }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Não deu pra ler a resposta da IA como JSON");
  }

  return parsed as TriagemResult;
}
