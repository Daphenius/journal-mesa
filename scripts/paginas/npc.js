/* Journal — página de NPC (tipo "person"): características (raça, idade, hobbies, personalidade...) e
 * ficha do ator ligada (formato Monk's: flags.actor). */
import { T } from "../idioma.js";
import { CAMPOS_NPC, TEXTOS_NPC, analisar, dadosSet, dadosUnset, esc } from "../nucleo.js";

/** Valor de uma característica: o do Journal; vazio, o atributo equivalente do Monk's (se houver). */
function valorNpc(ctx, k, nomesMonks) {
  const v = ctx.x.npc?.[k];
  if (v) return String(v);
  const attrs = ctx.m.attributes ?? {};
  for (const n of nomesMonks) {
    const a = attrs[n];
    const t = typeof a === "string" ? a : a?.value;
    if (t && (ctx.gm || !a?.hidden)) return String(t);
  }
  return "";
}

/** Seção "Características": campos curtos em grade e textos de personalidade. Vazia, só aparece editando. */
function caracteristicas(ctx) {
  const { ed, secao } = ctx;
  const curtos = CAMPOS_NPC.map(([k, r, mj]) => [k, r, valorNpc(ctx, k, mj)]);
  const longos = TEXTOS_NPC.map(([k, r, mj]) => [k, r, valorNpc(ctx, k, mj)]);
  if (!ed && ![...curtos, ...longos].some(([, , v]) => v)) return "";
  let corpo;
  if (ed) {
    corpo = `<div class="jm-npc-grade">${curtos.map(([k, r, v]) => `<label class="jm-sub-campo">${r}<input data-campo="x:npc.${k}" value="${esc(v)}"></label>`).join("")}</div>
      <div class="jm-npc-textos">${longos.map(([k, r, v]) => `<label class="jm-sub-campo">${r}<textarea data-campo="x:npc.${k}" rows="2">${esc(v)}</textarea></label>`).join("")}</div>`;
  } else {
    const grade = curtos.filter(([, , v]) => v).map(([, r, v]) => `<div class="jm-simbolo-campo"><small>${r}</small><span>${esc(v)}</span></div>`).join("");
    const textos = longos.filter(([, , v]) => v).map(([, r, v]) => `<div class="jm-npc-texto"><small>${r}</small><p>${esc(v).replace(/\n/g, "<br>")}</p></div>`).join("");
    corpo = `${grade ? `<div class="jm-npc-grade">${grade}</div>` : ""}${textos ? `<div class="jm-npc-textos">${textos}</div>` : ""}`;
  }
  return secao(T("Janela.Caracteristicas"), "fa-solid fa-address-card", corpo, "jm-npc-carac", "", "", "caracteristicas");
}

export default {
  tipo: "person",

  /* características vêm antes da descrição */
  antes(entry, app, ctx) { return caracteristicas(ctx); },

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
