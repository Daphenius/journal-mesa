/* Journal — versão dos dados: os ganchos que invalidam o cache de analisar() (carregados antes de todos os outros).
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T, TF } from "../idioma.js";

/* ---------- versão dos dados (para o cache de analisar) ----------
 * Sobe a cada criação, alteração ou exclusão de Diário ou página. Esses ganchos são registrados aqui,
 * antes de todos os outros, para que nenhum outro gancho leia uma análise velha. */
let VERSAO_DADOS = 0;
for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry", "createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) {
  Hooks.on(h, () => { VERSAO_DADOS++; });
}

export { VERSAO_DADOS };
