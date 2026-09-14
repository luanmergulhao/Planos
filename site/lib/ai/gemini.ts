// Chamada base pro Gemini, compartilhada pela Triagem e pela Busca de
// Resultados. Dois detalhes que só aparecem na prática:
// - a chave vai no cabeçalho x-goog-api-key; no parâmetro ?key= da URL
//   as chaves no formato novo respondem 403;
// - os modelos flash devolvem 503 ("high demand") com frequência, então
//   vale repetir e cair pro próximo da lista antes de desistir.

const MODELS = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.6-flash"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  let lastError = "erro desconhecido";

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text)
          .filter(Boolean)
          .join("");
        if (text) return text;
        lastError = `${model} respondeu sem texto (pode ter bloqueado o conteúdo)`;
        break;
      }

      lastError = `${model} respondeu ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;

      if (res.status === 503) {
        await sleep(2000 * attempt);
        continue;
      }
      break;
    }
  }

  throw new Error(`Gemini falhou. Último erro — ${lastError}`);
}
