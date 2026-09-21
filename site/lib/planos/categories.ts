// Espelha os valores inseridos por seed_default_categories() em
// supabase/migrations/0008_categorias_resolve_timer.sql — usado só
// como fallback de label no cliente antes dos dados reais carregarem,
// e como referência.
export const DEFAULT_CATEGORIES = [
  { code: "A", label: "PRÓX. DEADLINES" },
  { code: "B", label: "BUSCA R" },
  { code: "C", label: "EMAIL DE/PARA CB" },
  { code: "D", label: "INCÊNDIO" },
  { code: "E", label: "TRIAGEM" },
  { code: "F", label: "TAREFAS RÁPIDAS" },
  { code: "G", label: "TAREFAS DO DIA / ABRIR" },
] as const;

export function itemCode(categoryCode: string, itemNumber: number) {
  return `${categoryCode}${itemNumber}`;
}

// Como cada linha fixa aparece no Plano do Google: o nome exato na coluna 1
// e, na coluna 3, a marca (MANUAL / PROMPT) seguida da instrução da linha.
// Vive no código e não no banco pra a tela não depender de migração; o
// rótulo salvo no banco só serve de reserva pra um código desconhecido.
export type CategoryMeta = {
  label: string;
  modo: string;
  instrucoes: string[];
  /** D inteira aparece em vermelho no original */
  destaque?: boolean;
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  A: {
    label: "A. PRÓX. D",
    modo: "PROMPT",
    instrucoes: [
      "(AGENDA GOOGLE) 10 min - Apenas 2as feiras CAPTAÇÃO e LEIS 2023-24-25",
      "- Rever DIARIAMENTE os da semana se prorrogaram, ANOTAR e AVISAR NO ZAP SE SIM.",
      "- Indicar a data da revisão todos os dias ao lado de cada um desta semana e na agenda. Revisão: xx/xx, xx/xx",
    ],
  },
  B: {
    label: "B - BUSCA. R",
    modo: "MANUAL",
    instrucoes: [],
  },
  C: {
    label: "C - EMAIL DE/PARA CB",
    modo: "PROMPT",
    instrucoes: [
      "Resumir tudo o que CB manda e não é comentário",
      "Incluir Título do email, data. Tarefa solicitada. NAO COPIAR O EMAIL INTEIRO.",
    ],
  },
  D: {
    label: "D - INCÊNDIO - MIN/linha/DEADLINE",
    modo: "MANUAL",
    instrucoes: ["Toda mudança de manual será incêndio do dia - Leva 5 min. Indicar o LINK DE TUDO. DATA!!!"],
    destaque: true,
  },
  E: {
    label: "E. TRIAGEM (FEITAS)",
    modo: "MANUAL/ PROMPT",
    instrucoes: [
      "Dedicar até 30 minutos diários (cerca de 20% do tempo, se os incêndios tiverem acabado).",
      "Indicar todos os dias ao lado de cada um desta semana. Revisão: 11/01 - por exemplo.",
      "POR REVISAR TRIAGEM (com deadline):",
    ],
  },
  F: {
    label: "F. TAREFAS RÁPIDAS",
    modo: "MANUAL/ PROMPT",
    instrucoes: ["(Até 10 mins- avançar 2 por dia)", "DATAR/ DEADLINE"],
  },
  G: {
    label: "G. TAREFAS DO DIA / ABRIR",
    modo: "MANUAL/ PROMPT",
    instrucoes: [
      "Comentários, planos e whats CB - Pedido CB para o dia com LINK pro comentário.",
      "DIÁRIO - 15-30 min. Indicar links específicos, PASTA E GUIA de editais. Inserir deadline ao lado dos nomes dos editais",
      "DATAR/ DEADLINE",
    ],
  },
};

export function categoryLabel(code: string, labelDoBanco: string) {
  return CATEGORY_META[code]?.label ?? `${code}. ${labelDoBanco}`;
}
