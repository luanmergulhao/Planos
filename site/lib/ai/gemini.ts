// Chamada base pro Gemini, compartilhada pela Triagem, Busca de
// Resultados, Conferência de Prorrogação e Resumo de E-mails.
//
// Tenta sempre o modelo Pro primeiro, que responde bem melhor. Sem cota
// de Pro, cai pro gratuito — mas devolve `pro: false`, pra tela poder
// avisar que aquela resposta é de qualidade menor. A conta gratuita do
// Gemini não tem cota de Pro nenhuma: só ativando faturamento.
//
// Detalhes que só aparecem na prática:
// - a chave vai no cabeçalho x-goog-api-key; no parâmetro ?key= da URL
//   as chaves no formato novo respondem 403;
// - os modelos gratuitos devolvem 503 ("high demand") com frequência, e
//   cada 503 pode demorar ~20s pra voltar;
// - nem todo modelo aceita toda ferramenta nessa chave (403/404/429).

const PRO_MODELS = ["gemini-3.1-pro-preview", "gemini-pro-latest"];

const GRATIS_MODELS = [
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

export type RespostaIA = {
  texto: string;
  modelo: string;
  /** false quando a resposta veio do modelo gratuito, de qualidade menor */
  pro: boolean;
};

type Tentativa = { texto: string; modelo: string } | null;

async function tentarModelos(
  modelos: string[],
  body: Record<string, unknown>,
  apiKey: string,
  timeLeft: () => number,
  rodadas: number,
  registrarErro: (erro: string) => void
): Promise<Tentativa> {
  // 403/404/429 não melhoram tentando de novo o mesmo modelo nessa
  // chamada; só 503 (sobrecarga) e falha de rede merecem outra rodada.
  const inutilizados = new Set<string>();

  for (let rodada = 1; rodada <= rodadas; rodada++) {
    for (const modelo of modelos) {
      if (inutilizados.has(modelo)) continue;
      if (timeLeft() <= 0) return null;

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(Math.max(1, Math.min(ATTEMPT_TIMEOUT_MS, Math.floor(timeLeft())))),
          }
        );
      } catch (err) {
        registrarErro(`${modelo}: ${err instanceof Error ? err.message : "falha de rede"}`);
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const texto: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text)
          .filter(Boolean)
          .join("");
        if (texto) return { texto, modelo };

        registrarErro(`${modelo} respondeu sem texto (pode ter bloqueado o conteúdo)`);
        inutilizados.add(modelo);
        continue;
      }

      registrarErro(`${modelo} respondeu ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      if (res.status !== 503) inutilizados.add(modelo);
    }

    if (inutilizados.size === modelos.length) return null;
    if (rodada < rodadas) await sleep(Math.min(2000 * rodada, Math.max(0, timeLeft())));
  }

  return null;
}

export async function callGemini(body: Record<string, unknown>): Promise<RespostaIA> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const startedAt = Date.now();
  const timeLeft = () => BUDGET_MS - (Date.now() - startedAt);

  let ultimoErro = "erro desconhecido";
  const registrarErro = (erro: string) => {
    ultimoErro = erro;
  };

  // Pro sem cota responde 429 na hora (uns 300ms), então tentar sai
  // barato mesmo quando não está disponível — uma rodada só basta.
  const comPro = await tentarModelos(PRO_MODELS, body, apiKey, timeLeft, 1, registrarErro);
  if (comPro) return { ...comPro, pro: true };

  const comGratis = await tentarModelos(GRATIS_MODELS, body, apiKey, timeLeft, ROUNDS, registrarErro);
  if (comGratis) return { ...comGratis, pro: false };

  throw new Error(`Gemini falhou. Último erro — ${ultimoErro}`);
}
