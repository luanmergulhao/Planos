// Plano do dia como texto pro WhatsApp — o manual pede pra colar o Plano
// no grupo no ALINHAMENTO INICIAL e de novo no FINAL. Usa a marcação do
// próprio WhatsApp: *negrito*, _itálico_, ~riscado~.

import { categoryLabel, itemCode } from "@/lib/planos/categories";
import type { DeadlineEntry, DeadlinesComRevisao, RevisaoResumo } from "@/lib/planos/deadlines";
import type { PlanoItemContent } from "@/lib/supabase/types";

type Categoria = { id: string; code: string; label: string };
type Item = { category_id: string; item_number: number; content: unknown; deadline_at: string | null; riscado: boolean };

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// O WhatsApp só risca/negrita dentro de uma linha e sem espaço colado no
// símbolo, então cada linha é marcada separadamente.
function marcar(texto: string, simbolo: string) {
  return texto
    .split("\n")
    .map((linha) => (linha.trim() ? `${simbolo}${linha.trim()}${simbolo}` : linha))
    .join("\n");
}

const DATA_NO_TITULO = /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/;

function situacao(revisao: RevisaoResumo | undefined) {
  if (!revisao) return "Sem revisão";
  const status =
    revisao.status === "prorrogado" && revisao.novo_deadline
      ? `Prorrogado até ${diaCurto(revisao.novo_deadline)}`
      : revisao.status === "encerrado"
        ? "Encerrado"
        : revisao.status === "mantido"
          ? "Não prorrogado"
          : "Não confirmado";
  return `${status} · Revisão: ${revisao.datas.map(diaCurto).join(", ")}`;
}

function linhaDeadline(entrada: DeadlineEntry, revisao: RevisaoResumo | undefined) {
  let titulo = DATA_NO_TITULO.test(entrada.titulo) ? entrada.titulo : `${entrada.titulo} ${diaCurto(entrada.dia)}`;

  // prorrogou: data antiga riscada e a nova em negrito, como no Plano
  if (revisao?.status === "prorrogado" && revisao.novo_deadline) {
    const m = DATA_NO_TITULO.exec(titulo)!;
    titulo =
      titulo.slice(0, m.index) + `~${m[0]}~ *${diaCurto(revisao.novo_deadline)}*` + titulo.slice(m.index + m[0].length);
  }

  return `• ${titulo} — ${situacao(revisao)}`;
}

function blocoDeadlines(deadlines: DeadlinesComRevisao) {
  const lista = (entradas: DeadlineEntry[]) =>
    entradas.length === 0
      ? ["Nenhum deadline nesse período."]
      : entradas.map((e) => linhaDeadline(e, deadlines.revisoes[`${e.titulo}|${e.dia}`]));

  return [
    "_Deadlines desta semana_",
    ...lista(deadlines.semana),
    "_Deadlines da próxima semana_",
    ...lista(deadlines.proximaSemana),
  ];
}

function linhaItem(codigoCategoria: string, item: Item) {
  const content = (item.content ?? {}) as PlanoItemContent;
  const cabeca = [`${itemCode(codigoCategoria, item.item_number)}.`, content.titulo?.trim()].filter(Boolean).join(" ");
  const partes = [cabeca];
  if (content.tarefa?.trim()) partes.push(content.tarefa.trim());
  if (item.deadline_at) partes.push(`Prazo: ${item.deadline_at.split("-").reverse().join("/")}`);
  if (content.links?.trim()) partes.push(content.links.trim());

  const texto = partes.join("\n");
  return item.riscado ? marcar(texto, "~") : texto;
}

export function planoParaWhatsApp({
  alinhamento,
  dia,
  categorias,
  itens,
  deadlines,
}: {
  alinhamento: string;
  dia: string;
  categorias: Categoria[];
  itens: Item[];
  deadlines: DeadlinesComRevisao;
}) {
  const blocos = [`*${alinhamento}* — ${dia.split("-").reverse().join("/")}`];

  for (const categoria of categorias) {
    const linhas = [`*${categoryLabel(categoria.code, categoria.label)}*`];
    if (categoria.code === "A") linhas.push(...blocoDeadlines(deadlines));

    const daCategoria = itens
      .filter((i) => i.category_id === categoria.id)
      .sort((a, b) => a.item_number - b.item_number);
    for (const item of daCategoria) linhas.push(linhaItem(categoria.code, item));

    blocos.push(linhas.join("\n"));
  }

  return blocos.join("\n\n");
}
