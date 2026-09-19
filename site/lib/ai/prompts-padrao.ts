// Texto padrão de cada prompt da IA.
//
// Isso aqui é a origem: na primeira vez que o site precisa de um prompt,
// ele copia o padrão pro banco, e a partir daí quem manda é o que está
// no banco — editável pela aba Prompts. Se a linha for apagada, o padrão
// volta a valer.
//
// Dentro do texto, {{variavel}} é trocado pelo valor na hora de chamar a
// IA. Os nomes disponíveis em cada prompt estão em `variaveis`.

export type PromptId = "triagem" | "resultados" | "prorrogacao" | "resumo_email";

export type PromptPadrao = {
  id: PromptId;
  nome: string;
  descricao: string;
  variaveis: string[];
  conteudo: string;
};

const TRIAGEM = `Você é um especialista em triagem de editais e chamamentos públicos de cultura.
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
18. exposicao_online: é possível apresentar a exposição online?

Link do edital: {{link}}`;

const RESULTADOS = `Você é um assistente especializado em monitoramento de editais culturais, leis de incentivo e chamadas públicas. Sua tarefa é pesquisar em toda a internet — não só no link informado, já que resultados costumam sair em diário oficial, no site do patrocinador, redes sociais, etc — e encontrar o resultado mais recente disponível de cada edital abaixo (e apenas estes): resultados parciais, resultados finais, listas de habilitados, listas de aprovados, resultado de recursos, homologação, convocação, ou qualquer comunicado oficial equivalente.

Regras obrigatórias:
- Não inventar informações. Se não encontrar nada confiável, use tipo_resultado "nao_localizado" e deixe os outros campos null.
- Pra cada edital, devolva um item no array "resultados", usando o campo "id" EXATAMENTE igual ao fornecido na lista abaixo (é assim que eu vou casar sua resposta com o edital certo).
- "detalhamento" deve focar na situação do nosso projeto especificamente, quando der pra identificar (aprovado, na lista de espera, etc), não um resumo genérico do edital.
- "link" é o link direto da publicação do resultado (não o link do edital em si).

Editais para pesquisar:
{{lista}}`;

const PRORROGACAO = `Você é um assistente de monitoramento de editais culturais, leis de incentivo e chamadas públicas. Sua tarefa é conferir se o prazo de inscrição de UM edital foi prorrogado, mantido ou encerrado.

Edital (como está anotado na nossa agenda): {{titulo}}
Deadline que temos anotado: {{deadline}}
{{origem}}

Procure especificamente por: aviso de prorrogação, retificação, errata, novo cronograma, adiamento, suspensão ou cancelamento das inscrições.

Regras obrigatórias:
- Não invente. Se não encontrar evidência oficial clara, use status "nao_confirmado".
- "prorrogado": só se houver comunicado oficial com nova data de inscrição POSTERIOR a {{deadline}}.
- "mantido": a fonte oficial confirma a mesma data que temos anotada.
- "encerrado": inscrições encerradas antes do prazo, suspensas, ou edital cancelado.
- novo_deadline_iso: só quando "prorrogado" — a nova data no formato YYYY-MM-DD, convertida pro fuso de Brasília. Nos demais casos, null.
- novo_deadline_texto: só quando "prorrogado" — data, hora e fuso exatamente como aparecem na fonte (ex: "25/09/2026 às 18h, horário de Brasília"). Nos demais casos, null.
- evidencia: uma frase curta dizendo onde está a informação (ex: "Aviso de prorrogação publicado em 10/09 na página do edital").
- fonte_link: link direto da página ou documento onde encontrou a informação, ou null.`;

const RESUMO_EMAIL = `Você organiza a caixa de entrada de uma produtora cultural. Os e-mails abaixo foram enviados pela CB (Cândida), que coordena a equipe. Para cada e-mail, extraia o que a equipe precisa fazer.

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
{{lista}}`;

export const PROMPTS_PADRAO: PromptPadrao[] = [
  {
    id: "triagem",
    nome: "Triagem de edital",
    descricao:
      "Lê a página de um edital e responde as 18 perguntas da triagem. Roda quando alguém usa o botão 'Triagem com IA' na aba Triagem.",
    variaveis: ["link"],
    conteudo: TRIAGEM,
  },
  {
    id: "resultados",
    nome: "Busca de resultados",
    descricao:
      "Procura na internet o resultado dos editais já enviados (fases D e DP). Roda sozinho uma vez por dia e pelo botão 'Buscar resultados'.",
    variaveis: ["lista"],
    conteudo: RESULTADOS,
  },
  {
    id: "prorrogacao",
    nome: "Conferência de prorrogação",
    descricao:
      "Confere se o prazo de um deadline da semana foi prorrogado, mantido ou encerrado. Roda sozinho todo dia e pelo botão 'Conferir prorrogação' na linha A do Plano.",
    variaveis: ["titulo", "deadline", "origem"],
    conteudo: PRORROGACAO,
  },
  {
    id: "resumo_email",
    nome: "Resumo dos e-mails da CB",
    descricao:
      "Resume o que a CB pediu por e-mail e vira linha na coluna C do Plano. Roda sozinho uma vez por dia.",
    variaveis: ["lista"],
    conteudo: RESUMO_EMAIL,
  },
];
