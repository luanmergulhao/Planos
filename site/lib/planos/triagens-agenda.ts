// Linha E do Plano — TRIAGEM (FEITAS), lida da agenda do Google.
//
// Cada triagem feita vira um evento de dia inteiro na agenda, com título
// "T NOME DO EDITAL DATA FUSO" e que termina no dia do deadline (manual:
// "TRIAGEM = tabela + evento + planos"). A linha E só lista esses eventos:
// os que terminam nesta semana e os do resto do mês.
//
// Sem imports de runtime de propósito: fica fácil de testar sozinho.

export type EventoDeAgenda = { titulo: string; ultimoDia: string };

export type TriagemEntry = {
  /** título do evento, como está na agenda ("T Nome do edital 30/09 ...") */
  titulo: string;
  /** dia do deadline (AAAA-MM-DD) */
  dia: string;
};

export type TriagensLinhaE = {
  semana: TriagemEntry[];
  mes: TriagemEntry[];
};

// "T " seguido de espaço: TP, DP, DIL etc. não entram. "FC" é fluxo
// contínuo, que não tem deadline.
const EH_TRIAGEM = /^T\s/;
const TEM_FC = /\bFC\b/i;

export function separarTriagensDaAgenda(
  eventos: EventoDeAgenda[],
  janela: { inicioSemana: string; fimSemana: string; limiteMes: string }
): TriagensLinhaE {
  const vistos = new Set<string>();
  const semana: TriagemEntry[] = [];
  const mes: TriagemEntry[] = [];

  const triagens = eventos
    .filter((e) => EH_TRIAGEM.test(e.titulo) && !TEM_FC.test(e.titulo))
    .sort((a, b) => a.ultimoDia.localeCompare(b.ultimoDia) || a.titulo.localeCompare(b.titulo));

  for (const e of triagens) {
    const chave = e.titulo + "|" + e.ultimoDia;
    if (vistos.has(chave)) continue; // o mesmo evento em duas agendas
    vistos.add(chave);

    const entrada = { titulo: e.titulo, dia: e.ultimoDia };
    if (e.ultimoDia >= janela.inicioSemana && e.ultimoDia <= janela.fimSemana) semana.push(entrada);
    else if (e.ultimoDia > janela.fimSemana && e.ultimoDia <= janela.limiteMes) mes.push(entrada);
  }

  return { semana, mes };
}
