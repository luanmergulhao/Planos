// Extração assistida por IA da triagem de edital, a partir de um link.
// Mesma lógica que a equipe já fazia manualmente colando o link no
// Gemini com um prompt de perguntas fixas — só que agora dentro do
// site, com uma etapa de revisão antes de virar um edital de verdade.

export const TRIAGEM_FIELDS = [
  { key: "nome_edital", label: "Nome do edital" },
  { key: "tamanho_documento", label: "Tamanho do documento" },
  { key: "deadline_texto", label: "Data, hora e fuso do deadline" },
  { key: "proponente", label: "Proponente" },
  { key: "documentos_necessarios", label: "Documentos necessários" },
  { key: "link_principal", label: "Link principal" },
  { key: "resumo_produto", label: "Resumo / produto" },
  { key: "categorias_tematica", label: "Categorias / temática" },
  { key: "local", label: "Onde se realizará (cidade/país)" },
  { key: "periodo_execucao", label: "Período de execução" },
  { key: "custo_inscricao", label: "Custo pra inscrever (fee)" },
  { key: "remuneracao", label: "Remuneração / valor do fomento" },
  { key: "num_selecionados", label: "Nº de selecionados / vagas" },
  { key: "envio_obra", label: "Envio/instalação da obra (se exposição)" },
  { key: "carta_convite", label: "Carta-convite/anuência necessária?" },
  { key: "plano_expositivo", label: "Plano expositivo necessário? (se exposição)" },
  { key: "exposicao_online", label: "Possível apresentar online?" },
] as const;

export type TriagemFieldKey = (typeof TRIAGEM_FIELDS)[number]["key"];

export type TriagemResult = Record<TriagemFieldKey, string> & {
  deadline_iso_date: string | null;
};

const TRIAGEM_PROMPT = `Você é um especialista em triagem de editais e chamamentos públicos de cultura.
Use exclusivamente o conteúdo da página do link fornecido (e dos documentos linkados/anexados nela, se conseguir acessá-los). Extraia as informações pedidas.

Regras gerais:
- Caso uma informação não exista ou você não consiga encontrar, escreva "não encontrado". Nunca invente uma resposta.
- Responda no mesmo idioma original do edital.
- Quando possível, indique em qual página/item/seção do documento encontrou cada informação (ex: "Encontrado na página 5, item 7.1").
- Regra de horário do deadline: se o documento não especificar hora, use 23:59 no fuso da instituição responsável pelo edital. Se for uma chamada internacional (fora do Brasil), informe o horário no fuso local (com a sigla) E a conversão pro horário de Brasília (com a sigla) — ex: "23:59 CET / 18:59 BRT".

Extraia exatamente estes campos:
1. nome_edital: Órgão + Nome da chamada (sem a palavra "edital") + Ano.
2. tamanho_documento: responda exatamente PEQUENO (sem anexos pra preencher / formulário simples), MEDIO (sem planilha de cronograma ou orçamento), ou GRANDE (demais casos).
3. deadline_texto: data, hora e fuso do deadline, seguindo a regra de horário acima.
4. deadline_iso_date: só a data do deadline, no formato YYYY-MM-DD, já convertida pro fuso de Brasília. Use null se não encontrado ou não aplicável.
5. proponente: pode ser pessoa física ou jurídica? De onde pode se candidatar (qualquer lugar do mundo ou um local específico)? É possível inscrever mais de uma proposta pelo mesmo proponente?
6. documentos_necessarios: quais anexos são obrigatórios pra envio.
7. link_principal: a página oficial específica desse edital (não o PDF do regulamento).
8. resumo_produto: resumo do edital / produto esperado.
9. categorias_tematica: categoria/temática do edital.
10. local: onde o projeto vai se realizar (cidade/país).
11. periodo_execucao: quando o projeto vai ser realizado.
12. custo_inscricao: custo pra se inscrever e a moeda (fee), se houver.
13. remuneracao: remuneração / valor do fomento por projeto.
14. num_selecionados: número de selecionados / vagas.
15. envio_obra: se for uma exposição, como se envia/instala a obra.
16. carta_convite: é necessário apresentar carta-convite/anuência?
17. plano_expositivo: se for uma exposição, é necessário apresentar plano expositivo com base no layout do local?
18. exposicao_online: é possível apresentar a exposição online?`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries([
    ...TRIAGEM_FIELDS.map((f) => [f.key, { type: "STRING" }]),
    ["deadline_iso_date", { type: "STRING", nullable: true }],
  ]),
  required: [...TRIAGEM_FIELDS.map((f) => f.key), "deadline_iso_date"],
};

const MODEL = "gemini-2.5-flash";

export async function extractTriagemFromLink(link: string): Promise<TriagemResult> {
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
        contents: [{ parts: [{ text: `${TRIAGEM_PROMPT}\n\nLink do edital: ${link}` }] }],
        tools: [{ url_context: {} }],
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
    throw new Error("Gemini não devolveu texto (pode ter bloqueado o conteúdo do link)");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Não deu pra ler a resposta da IA como JSON");
  }

  return parsed as TriagemResult;
}
