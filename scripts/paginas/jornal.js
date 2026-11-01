/* Journal — página de Jornal de Notícias (tipo "jornal"): identidade, edições e a folha.
 * O conteúdo em si vem de scripts/jornal/ (visual.js); aqui só a ligação com a janela. */
import * as Jornal from "../jornal/index.js";

export default {
  tipo: "jornal",
  editavel: false,
  fichaNativa: true,
  completa: true,
  imagemCabecalho: (ctx) => Jornal.identidade(ctx.entry).logo || null,

  html(entry, app, ctx) { return Jornal.corpoJornal(app, entry, ctx.secao); },

  acoes: {
    /** Botões do Jornal de Notícias (data-op diz qual). */
    jornal(app, ev, el) { return Jornal.acao(app, el.dataset.op, el, ev); }
  },

  ouvintes(app, root) { Jornal.ouvintes(app, root); }
};
