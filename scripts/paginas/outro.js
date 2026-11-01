/* Journal — página do Monk's Enhanced Journal que não tem equivalente aqui (tipo "outro"):
 * mostra o selo com o tipo original e abre o resto na ficha padrão. */
import { T } from "../idioma.js";
import { esc } from "../nucleo.js";
import { seloMonks } from "./comum.js";

export default {
  tipo: "outro",
  fichaNativa: true,
  selo: (ctx) => seloMonks(ctx.a),

  html(entry, app, ctx) {
    const { a, secao } = ctx;
    return secao(T("Janela.MonkSEnhancedJournal"), "fa-solid fa-puzzle-piece",
      `<p class="jm-dica">${T("Janela.EsteEUm")} "${esc(seloMonks(a))}" ${T("Janela.DoMonkSAquiDa")} <i class="fa-solid fa-pen"></i>${T("Janela.ORestoDosDadosDele")} <i class="fa-solid fa-up-right-from-square"></i>.</p>`);
  }
};
