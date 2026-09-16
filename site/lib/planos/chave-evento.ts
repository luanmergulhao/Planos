/** Título do evento sem prefixo D/DP, datas e horários — é a chave que
 *  liga o evento da agenda ao link salvo e às revisões, e continua igual
 *  quando a equipe renomeia o evento de D pra DP ou troca a data no
 *  título.
 *
 *  Fica num arquivo só dele porque é usado tanto no servidor quanto na
 *  tela da linha A, e não pode arrastar código de servidor pro navegador.
 */
export function chaveEvento(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/^(dp|d)\s+/, "")
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ")
    .replace(/\b\d{1,2}(:\d{2}|h\d{0,2})\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
