// Regras do espelho das planilhas: quais colunas nunca entram e como uma
// linha da planilha vira um objeto {cabeçalho: valor}.

export const PLANILHAS = ["inscritos", "triagem"] as const;
export type PlanilhaId = (typeof PLANILHAS)[number];

// Coluna de credencial nunca é guardada. O script da planilha já corta
// antes de enviar; aqui é a segunda trava, caso alguém mude o script.
const COLUNA_SECRETA = /(senha|password|passwd|login|usu[aá]rio|username|token|chave)/i;

export const ehColunaSecreta = (nome: string) => COLUNA_SECRETA.test(nome);

export type LinhaEspelhada = { linha: number; dados: Record<string, string> };

/**
 * Converte as linhas de um lote em objetos. Descarta linha totalmente em
 * branco e coluna de credencial; dá nome único a cabeçalho repetido ou vazio.
 */
export function espelharLote(
  cabecalho: string[],
  linhas: string[][],
  primeiraLinha: number
): { linhas: LinhaEspelhada[]; colunas: string[]; descartadas: string[] } {
  const usados = new Map<string, number>();
  const nomes = cabecalho.map((bruto, i) => {
    const base = bruto.trim() || `coluna ${i + 1}`;
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const descartadas = nomes.filter((n, i) => cabecalho[i]?.trim() && ehColunaSecreta(n));
  const manter = nomes.map((n, i) => !(cabecalho[i]?.trim() && ehColunaSecreta(n)));

  const resultado: LinhaEspelhada[] = [];
  linhas.forEach((celulas, i) => {
    const dados: Record<string, string> = {};
    let temConteudo = false;
    nomes.forEach((nome, c) => {
      if (!manter[c]) return;
      const valor = (celulas[c] ?? "").toString().trim();
      if (valor) {
        dados[nome] = valor.slice(0, 5000);
        temConteudo = true;
      }
    });
    if (temConteudo) resultado.push({ linha: primeiraLinha + i, dados });
  });

  return { linhas: resultado, colunas: nomes.filter((_, i) => manter[i]), descartadas };
}
