// Os campos da triagem, separados da lógica que chama a IA.
// Isso aqui é usado pela tela (o diálogo de revisão), então não pode
// importar nada de servidor — em especial o acesso com chave de serviço.

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
