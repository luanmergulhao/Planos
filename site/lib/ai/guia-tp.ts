import { callGemini } from "@/lib/ai/gemini";
import { getPromptTexto, renderPrompt } from "@/lib/ai/prompts";
import { extractTriagemFromLink } from "@/lib/ai/triagem";
import type { TriagemResult } from "@/lib/ai/triagem-campos";

export type GuiaTpResult = { guia: string; tp: string };

// GUIA e TP são a 2ª e 3ª etapa da abertura de um edital (depois da
// Triagem), do jeito que a equipe faz hoje: cola um prompt, lê a
// resposta, cola o próximo prompt NO MESMO chat — cada um enxerga a
// pergunta e a resposta anterior. Aqui isso vira uma conversa de verdade
// com o Gemini (histórico em `contents`), em vez de 3 chamadas soltas.
export async function runGuiaTp(edital: {
  link: string | null;
  respostas: unknown;
}): Promise<GuiaTpResult> {
  if (!edital.link) throw new Error("edital sem link — GUIA/TP precisam do link do edital");

  const jaTemTriagem =
    !!edital.respostas && typeof edital.respostas === "object" && "nome_edital" in (edital.respostas as object);

  const triagem: TriagemResult = jaTemTriagem
    ? (edital.respostas as TriagemResult)
    : (await extractTriagemFromLink(edital.link)).result;

  const [triagemPrompt, guiaPrompt, tpPrompt] = await Promise.all([
    getPromptTexto("triagem").then((texto) => renderPrompt(texto, { link: edital.link! })),
    getPromptTexto("guia"),
    getPromptTexto("tp"),
  ]);

  const conversaAteTriagem = [
    { role: "user", parts: [{ text: triagemPrompt }] },
    { role: "model", parts: [{ text: JSON.stringify(triagem) }] },
  ];
  const turnoGuia = { role: "user", parts: [{ text: guiaPrompt }] };

  const { texto: guia } = await callGemini({
    contents: [...conversaAteTriagem, turnoGuia],
    tools: [{ url_context: {} }],
  });

  const { texto: tp } = await callGemini({
    contents: [
      ...conversaAteTriagem,
      turnoGuia,
      { role: "model", parts: [{ text: guia }] },
      { role: "user", parts: [{ text: tpPrompt }] },
    ],
    tools: [{ url_context: {} }],
  });

  return { guia, tp };
}
