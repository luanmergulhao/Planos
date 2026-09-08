// Espelha os valores inseridos por seed_default_categories() em
// supabase/migrations/0001_init.sql — usado só como fallback de label
// no cliente antes dos dados reais carregarem, e como referência.
export const DEFAULT_CATEGORIES = [
  { code: "A", label: "PRÓX. DEADLINES" },
  { code: "B", label: "BUSCA R" },
  { code: "C", label: "EMAIL DE/PARA CB" },
  { code: "D", label: "INCÊNDIO" },
  { code: "E", label: "TRIAGEM" },
  { code: "F", label: "TAREFAS RÁPIDAS" },
  { code: "G", label: "TAREFAS DO DIA / ABRIR" },
  { code: "G1", label: "INTELIGÊNCIA ARTIFICIAL" },
] as const;

export function itemCode(categoryCode: string, itemNumber: number) {
  return `${categoryCode}${itemNumber}`;
}
