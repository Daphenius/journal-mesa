/* Journal — página de Baú de saque (tipo "loot"): moedas, itens para pegar, dividir moedas, Item Piles. */
import { T } from "../idioma.js";
import { CHAVE_DADOS, Dialogo, MOD, analisar, camposMoedas, chat, chavesMoedas, comoLista, dadosSet, ehGM, esc, formatarMoedas, itemLimpo, mostrarMoedas, pedir, substituirMapa, temModulo } from "../nucleo.js";
import { listaItens } from "./estoque.js";
import { precisaAtor } from "./loja.js";

async function secaoBau(ctx) {
  const { a, ed, secao } = ctx;
  const { m } = a;
  const gm = ehGM();
  const moedas = m.currency ?? {};
  const campoMoedas = ed
    ? camposMoedas(moedas, "m:currency")
    : (mostrarMoedas(moedas) || `<div class="jm-moedas"><i class="fa-solid fa-coins"></i> ${T("Comum.NenhumaMoeda")}</div>`);
  const barra = gm ? `<div class="jm-barra">
      <button type="button" class="primario" data-action="dividirMoedas" data-tooltip="${T("Janela.DivideAsMoedasIgualmenteEntre")}"><i class="fa-solid fa-scale-balanced"></i> ${T("Janela.DividirMoedas")}</button>
      ${temModulo("item-piles") ? `<button type="button" data-action="itemPiles" data-tooltip="${T("Janela.CriaUmaPilhaDoItem")}"><i class="fa-solid fa-box-archive"></i> ${T("Janela.ColocarNoMapa")}</button>` : ""}
      <button type="button" class="sec" data-action="exportarItens" data-tooltip="${T("Janela.CopiarOsItensParaA")}"><i class="fa-solid fa-file-export"></i></button>
    </div>` : "";
  const linhas = await listaItens(m, ed, "bau");
  const vazio = `<p class="jm-vazio">${gm ? T("Janela.BauVazioArrasteItensPara") : T("Janela.OBauEstaVazio")}</p>`;
  return secao(T("Janela.ConteudoDoBau"), "fa-solid fa-box-open",
    campoMoedas + barra + `<div class="jm-produtos" ${gm ? `data-drop="itemLoja"` : ""}>${linhas.join("") || vazio}</div>`, "jm-bau");
}

export default {
  tipo: "loot",
  tituloDescricao: () => T("Janela.SobreOBau"),
  /* baú sem descrição não mostra a seção vazia (fora do modo de edição) */
  mostrarDescricao: (ctx, html) => !!(html || ctx.ed),

  html(entry, app, ctx) { return secaoBau(ctx); },

  acoes: {
    pegar(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      pedir("pegar", { entryId: app.ativa, itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id });
    },

    async dividirMoedas(app) {
      const e = app._entry(); const { page, m } = analisar(e);
      const herois = [...new Set(game.users.filter((u) => !u.isGM && u.character).map((u) => u.character))];
      if (!herois.length) return ui.notifications.warn(T("Janela.NenhumJogadorTemPersonagemDefinido"));
      const moedas = m.currency ?? {};
      const resto = {};
      const parte = {};
      for (const k of chavesMoedas()) {
        const total = Number(moedas[k]) || 0;
        parte[k] = Math.floor(total / herois.length);
        resto[k] = total - parte[k] * herois.length;
      }
      if (!chavesMoedas().some((k) => parte[k] > 0)) return ui.notifications.warn(T("Janela.NaoHaMoedasSuficientesPara"));
      // todas as fichas numa gravação só (são independentes)
      const Ator = CONFIG.Actor?.documentClass ?? globalThis.Actor;
      await Ator.updateDocuments(herois.map((h) => {
        const atual = h.system?.currency ?? {};
        return { _id: h.id, "system.currency": Object.fromEntries(chavesMoedas().map((k) => [k, (Number(atual[k]) || 0) + parte[k]])) };
      }));
      await dadosSet(page, "currency", resto);
      await chat(`<i class="fa-solid fa-scale-balanced"></i> ${T("Janela.AsMoedasDe")} <b>${esc(e.name)}</b> ${T("Janela.ForamDivididasEntre")} ${herois.length}: ${T("Janela.CadaUmRecebeu")} <b>${esc(formatarMoedas(parte))}</b>.`);
    },

    async itemPiles(app) {
      const api = game.itempiles?.API;
      if (!api?.createItemPile) return ui.notifications.warn(T("Janela.OItemPilesNaoEsta"));
      if (!canvas?.scene) return ui.notifications.warn(T("Janela.AbraUmaCenaParaColocar"));
      const e = app._entry(); const { page, m } = analisar(e);
      const items = comoLista(m.items).map(([, it]) => itemLimpo(it));
      const moedas = m.currency ?? {};
      if (!items.length && !chavesMoedas().some((k) => Number(moedas[k]) > 0)) return ui.notifications.warn(T("Janela.OBauEstaVazio"));
      const ok = await Dialogo().confirm({
        window: { title: T("Janela.ColocarNoMapa") },
        content: `<p>${T("Janela.CriarUmaPilhaDoItem")} <b>${esc(e.name)}</b>?</p><p>${T("Janela.OsItensEAsMoedas")}</p>`
      });
      if (!ok) return;
      const centro = canvas.stage.pivot;
      const grade = canvas.grid?.size ?? 100;
      try {
        await api.createItemPile({
          position: { x: Math.round(centro.x / grade) * grade, y: Math.round(centro.y / grade) * grade },
          sceneId: canvas.scene.id,
          items,
          actorOverrides: { name: e.name, system: { currency: Object.fromEntries(chavesMoedas().map((k) => [k, Number(moedas[k]) || 0])) } },
          tokenOverrides: { name: e.name }
        });
        await substituirMapa(page, `flags.${MOD}.${CHAVE_DADOS}.items`, {}, { [`flags.${MOD}.${CHAVE_DADOS}.currency`]: Object.fromEntries(chavesMoedas().map((k) => [k, 0])) });
        ui.notifications.info(T("Janela.BauColocadoNoMapa"));
      } catch (err) {
        console.error(err);
        ui.notifications.error(`${T("Janela.OItemPilesRecusou")}: ${err.message ?? err}`);
      }
    }
  }
};
