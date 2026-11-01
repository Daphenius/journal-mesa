/* Journal — registro das páginas: um arquivo por tipo de página (TIPOS do núcleo) e os painéis especiais
 * (Linha do tempo, Nexus, Regras da Mesa). A janela (partes/janela.js) despacha por aqui:
 *   PAGINAS[tipo].html(entry, app, ctx)   HTML do corpo da página (ctx vem de comum.contexto)
 *   PAGINAS[tipo].acoes                   { nomeDaAcao: (app, event, target) => … }  (data-action="nomeDaAcao")
 *   PAGINAS[tipo].ouvintes(app, root)     ouvintes específicos depois de cada render
 *   PAGINAS[tipo].soltar                  { tipoDoDrop: (app, doc, entry, page, el) => … }  (data-drop="tipoDoDrop")
 *   PAGINAS[tipo].data                    { alvo: (app, td, caixa) => … }  (seletores de data, data-data="alvo")
 * Os módulos "comuns" (conexões, calendário, páginas nativas) só contribuem com ações/ouvintes/drops. */
import * as comum from "./comum.js";
import * as conexoes from "./conexoes.js";
import * as calendario from "./calendario.js";
import * as estoque from "./estoque.js";
import npc from "./npc.js";
import lugar from "./lugar.js";
import organizacao from "./organizacao.js";
import loja from "./loja.js";
import missao from "./missao.js";
import divindade from "./divindade.js";
import bau from "./bau.js";
import anotacao from "./anotacao.js";
import historia from "./historia.js";
import jornal from "./jornal.js";
import diario from "./diario.js";
import outro from "./outro.js";
import linhaDoTempo from "./linha-do-tempo.js";
import nexus from "./nexus.js";
import regras from "./regras.js";

/** Tipo de página (chave de TIPOS no núcleo, ou id da aba especial) → módulo. */
const PAGINAS = {
  person: npc,
  place: lugar,
  organization: organizacao,
  shop: loja,
  quest: missao,
  deus: divindade,
  loot: bau,
  journalentry: anotacao,
  historia,
  jornal,
  diario,
  outro,
  __linha: linhaDoTempo,
  __nexus: nexus,
  __regras: regras
};

/** Módulos que têm ações/ouvintes/drops mas não são um tipo de página. */
const COMUNS = [comum, conexoes, calendario, estoque];
const TODOS = [...COMUNS, ...new Set(Object.values(PAGINAS))];

/** Ações de todos os tipos, no formato do ApplicationV2 (this = janela). */
function acoesDasPaginas() {
  const acoes = {};
  for (const P of TODOS) for (const [nome, fn] of Object.entries(P.acoes ?? {})) {
    acoes[nome] = function (ev, el) { return fn(this, ev, el); };
  }
  return acoes;
}

function ouvintesDasPaginas(app, root) {
  for (const P of TODOS) P.ouvintes?.(app, root);
}

/** data-drop → função, juntando o que cada módulo registra. */
const SOLTAR = Object.assign({}, ...TODOS.map((P) => P.soltar ?? {}));
/** data-data (seletor de data) → função. */
const AO_ESCOLHER_DATA = Object.assign({}, ...TODOS.map((P) => P.data ?? {}));

export { AO_ESCOLHER_DATA, PAGINAS, SOLTAR, acoesDasPaginas, ouvintesDasPaginas };
