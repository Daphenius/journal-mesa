/* Journal — página de NPC (tipo "person"): ficha do ator ligada (formato Monk's: flags.actor). */
import { T } from "../idioma.js";
import { analisar, dadosSet, dadosUnset, esc } from "../nucleo.js";

export default {
  tipo: "person",

  async html(entry, app, ctx) {
    const { m, gm, ed, secao } = ctx;
    const link = m.actor;
    const ator = link ? (typeof link === "string" ? fromUuidSync(link) : (link.uuid ? fromUuidSync(link.uuid) : game.actors.get(link.id))) : null;
    const pode = ator && (gm || ator.testUserPermission(game.user, "LIMITED"));
    let corpo = "";
    if (pode) corpo = `<div class="jm-ator"><img src="${esc(ator.img)}"><b>${esc(ator.name)}</b>
      <button type="button" data-action="abrirAtor"><i class="fa-solid fa-id-card"></i> ${T("Janela.AbrirFicha")}</button>
      ${ed ? `<button type="button" class="sec" data-action="limparAtor"><i class="fa-solid fa-link-slash"></i></button>` : ""}</div>`;
    else if (ed) corpo = `<div class="jm-soltar"><i class="fa-solid fa-user-plus"></i> ${T("Janela.ArrasteUmAtorAquiPara")}</div>`;
    return corpo ? secao(T("Janela.Ficha"), "fa-solid fa-id-card", corpo, "", ed ? `data-drop="ator"` : "") : "";
  },

  acoes: {
    async abrirAtor(app) {
      const link = analisar(app._entry()).m.actor;
      const ator = typeof link === "string" ? await fromUuid(link) : (link?.uuid ? await fromUuid(link.uuid) : game.actors.get(link?.id));
      ator?.sheet.render(true);
    },
    async limparAtor(app) { await dadosUnset(analisar(app._entry()).page, "actor"); }
  },

  /* soltar um ator na seção "Ficha" (só no modo de edição) */
  soltar: {
    async ator(app, doc, e, page) {
      if (doc.documentName !== "Actor") return ui.notifications.warn(T("Janela.ArrasteUmAtor"));
      await dadosSet(page, "actor", doc.uuid);
      if (!page.src) await page.update({ src: doc.img });
    }
  }
};
