// Monta o HTML de uma seção do manual a partir do que está no banco.
//
// O texto guardado tem marcadores [[seg:N]] no lugar de cada senha. Quem
// não pode ver senhas nem recebe os valores (a política do banco devolve
// zero linhas em manual_segredos), então aqui o marcador vira máscara.

const MASCARA = "••••••••";

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function montarHtmlDoManual(html: string, segredos: Map<number, string>): string {
  return html.replace(/\[\[seg:(\d+)\]\]/g, (_, id: string) => {
    const valor = segredos.get(Number(id));
    return valor === undefined ? MASCARA : `<mark class="manual-senha">${escapar(valor)}</mark>`;
  });
}
