/* Jornal de Notícias — contexto compartilhado.
 * O journal.js entrega aqui as funções dele (esc, Tempo, analisar, filas...) no carregamento.
 * Os arquivos do jornal só usam J dentro de funções, nunca no carregamento, então a ordem não importa. */
export const J = {};
export function instalarContexto(c) { Object.assign(J, c); }
