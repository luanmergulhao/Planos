// Chamada base pro Gemini, compartilhada pela Triagem, Busca de
// Resultados e Revisão de Deadlines. Detalhes que só aparecem na prática:
// - a chave vai no cabeçalho x-goog-api-key; no parâmetro ?key= da URL
//   as chaves no formato novo respondem 403;
// - os modelos flash devolvem 503 ("high demand") com frequência, e cada
//   503 pode demorar ~20s pra voltar;
// - nem todo modelo aceita toda ferramenta nessa chave (403/404/429).

// Em ordem de preferência: os completos primeiro, os "lite" como
// reserva. A lista é longa de propósito — a sobrecarga é por modelo e
// varia ao longo do dia, então quanto mais alternativas, maior a chance
// de a revisão diária conseguir rodar.
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
];

// As rotas que chamam a IA têm maxDuration de 60s na Vercel. Passado
// esse tempo a execução é cortada sem aviso, então a chamada desiste
// antes, com folga pra quem chamou ainda gravar o resultado.
const BUDGET_MS = 45_000;

// Teto por tentativa: um modelo pendurado consumia o orçamento inteiro
// sozinho e os outros nem chegavam a ser testados.
const ATTEMPT_TIMEOUT_MS = 20_000;
const ROUNDS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const startedAt = Date.now();
  const timeLeft = () => BUDGET_MS - (Date.now() - startedAt);

  // 403/404/429 não melhoram tentando de novo o mesmo modelo nessa
  // chamada; só 503 (sobrecarga) e falha de rede merecem outra rodada.
  const unusable = new Set<string>();
  let lastError = "erro desconhecido";

  // Sobrecarga costuma ser por modelo, então passa pro próximo da lista
  // em vez de insistir três vezes no mesmo.
  for (let round = 1; round <= ROUNDS; round++) {
    for (const model of MODELS) {
      if (unusable.has(model)) continue;
      if (timeLeft() <= 0) {
        throw new Error(`Gemini não respondeu a tempo. Último erro — ${lastError}`);
      }

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(Math.max(1, Math.min(ATTEMPT_TIMEOUT_MS, Math.floor(timeLeft())))),
          }
        );
      } catch (err) {
        lastError = `${model}: ${err instanceof Error ? err.message : "falha de rede"}`;
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text)
          .filter(Boolean)
          .join("");
        if (text) return text;
        lastError = `${model} respondeu sem texto (pode ter bloqueado o conteúdo)`;
        unusable.add(model);
        continue;
      }

      lastError = `${model} respondeu ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      if (res.status !== 503) unusable.add(model);
    }

    if (unusable.size === MODELS.length) break;
    if (round < ROUNDS) await sleep(Math.min(2000 * round, Math.max(0, timeLeft())));
  }

  throw new Error(`Gemini falhou. Último erro — ${lastError}`);
}
