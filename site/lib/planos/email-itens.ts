// Linhas da C que vieram da rotina de e-mails. Elas moram em plano_items
// (assim herdam a cópia de um dia pro outro), mas aparecem como a lista
// E-MAILS dentro da linha C, e não como C1, C2, C3.

import type { PlanoItemContent } from "@/lib/supabase/types";

const PREFIXO_ANTIGO = "E-mail da CB recebido em ";

/** Inclui as linhas de antes do campo `origem`, reconhecidas pelo texto
 *  que a rotina gravava em `links`. */
export function ehLinhaDeEmail(content: PlanoItemContent | null | undefined) {
  return content?.origem === "email" || !!content?.links?.startsWith(PREFIXO_ANTIGO);
}

/** "dd/mm" do e-mail, ou null quando não dá pra saber. */
export function diaDoEmail(content: PlanoItemContent): string | null {
  if (content.data_email) return `${content.data_email.slice(8, 10)}/${content.data_email.slice(5, 7)}`;
  const m = content.links?.match(/(\d{2}\/\d{2})\/\d{4}/);
  return m ? m[1] : null;
}
