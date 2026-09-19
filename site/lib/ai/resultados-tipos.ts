// Tipos e rótulos da busca de resultados, separados da lógica que chama
// a IA. Usado pela tela (o diálogo de buscar resultados), então não pode
// importar nada de servidor — em especial o acesso com chave de serviço.

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
  id: string; // edital_id, ecoado de volta pra casar a resposta
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
