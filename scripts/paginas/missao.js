/* Journal — página de Missão (tipo "quest"): status, quem deu, prazo, objetivos e recompensas
 * (formato do Monk's: objectives e rewards com XP, moedas e itens). */
import { T } from "../idioma.js";
import { Tempo, textoPrazo } from "../partes/calendario.js";
import { campoData } from "../partes/historia.js";
import { Sessao } from "../partes/sessao.js";
import { CHAVE_DADOS, Dialogo, MOD, STATUS, TE, analisar, camposMoedas, chat, chavesMoedas, comoLista, dadosGet, dadosSet, dadosUnset, ehGM, esc, formatarMoedas, garantirObjeto, gravarJunto, itemLimpo, itemParaLoja, mostrarMoedas, novoId, opcoes, pedir } from "../nucleo.js";
import { precisaAtor } from "./loja.js";

/** Recompensas no formato do Monk's: grupos com XP, moedas e itens (itens, talentos ou magias). */
async function secaoRecompensas(ctx) {
  const { a, ed, secao, enr } = ctx;
  const { m, x } = a;
  const gm = ehGM();
  const grupos = comoLista(m.rewards).filter(([, r]) => gm || r.visible);
  if (!grupos.length && !gm) return "";
  const itensMapa = Object.fromEntries(comoLista(m.items));
  const rotuloTipo = (t) => { const k = CONFIG.Item?.typeLabels?.[t]; return k ? game.i18n.localize(k) : t; };
  const partes = [];
  for (const [gid, r] of grupos) {
    const ids = r.itemIds ?? (Array.isArray(r.items) ? r.items.map((i) => i._id) : []);
    const cartas = [];
    for (const iid of ids) {
      const it = itensMapa[iid] ?? (Array.isArray(r.items) ? r.items.find((i) => i._id === iid) : null);
      if (!it) continue;
      const origem = it.flags?.[MOD]?.origem;
      const nome = origem ? await TE().enrichHTML(`@UUID[${origem}]{${String(it.name).replace(/[{}]/g, "")}}`) : esc(it.name);
      cartas.push(`<div class="jm-premio-card">
        <img src="${esc(it.img)}" alt="">
        <div class="nome">${nome}<small>${esc(rotuloTipo(it.type))}</small></div>
        ${r.awarded ? `<button type="button" class="primario" data-action="pegarRecompensa" data-grupo="${gid}" data-id="${iid}"><i class="fa-solid fa-hand"></i> ${T("Janela.Pegar")}</button>` : ""}
        ${gm ? `<a class="jm-mini-btn" data-action="removerPremio" data-grupo="${gid}" data-id="${iid}" data-tooltip="${T("Janela.TirarDaRecompensa")}"><i class="fa-solid fa-trash"></i></a>` : ""}
      </div>`);
    }
    const xp = Number(r.xp) || 0;
    const blocoXp = gm
      ? `<label class="jm-xp-ed" data-tooltip="${T("Janela.XPQueCadaPersonagemRecebe")}"><i class="fa-solid fa-star"></i><input type="number" min="0" data-campo="m:rewards.${gid}.xp" data-num value="${xp}"><span>XP</span></label>`
      : (xp ? `<div class="jm-xp"><i class="fa-solid fa-star"></i> <b>${xp}</b> XP</div>` : "");
    const blocoMoedas = gm ? camposMoedas(r.currency ?? {}, `m:rewards.${gid}.currency`) : mostrarMoedas(r.currency ?? {});
    const topo = gm ? `<div class="jm-premio-topo">
        ${ed ? `<input class="jm-premio-nome" data-campo="m:rewards.${gid}.name" value="${esc(r.name ?? T("Comum.Recompensas"))}">` : `<b>${esc(r.name ?? T("Comum.Recompensas"))}</b>`}
        ${r.awarded ? `<span class="jm-tag achado">${T("Janela.Entregue")}</span>` : ""}
        <a class="jm-mini-btn jm-olho ${r.visible ? "aberto" : "fechado"}" data-action="recompensaVisivel" data-grupo="${gid}" data-tooltip="${r.visible ? T("Janela.JogadoresVeemEstaRecompensa") : T("Janela.OcultaDosJogadores")}"><i class="fa-solid ${r.visible ? "fa-eye" : "fa-eye-slash"}"></i></a>
        <button type="button" class="primario" data-action="entregarRecompensa" data-grupo="${gid}" data-tooltip="${T("Janela.XPParaCadaPersonagemMoedas")}"><i class="fa-solid fa-gift"></i> ${T("Janela.Entregar")}</button>
        ${ed ? `<a class="jm-mini-btn" data-action="apagarRecompensa" data-grupo="${gid}" data-tooltip="${T("Janela.ApagarEsteGrupo")}"><i class="fa-solid fa-trash"></i></a>` : ""}
      </div>` : (grupos.length > 1 ? `<div class="jm-premio-topo"><b>${esc(r.name ?? T("Comum.Recompensas"))}</b></div>` : "");
    partes.push(`<div class="jm-premio-grupo">
      ${topo}
      <div class="jm-premio-linha">${blocoXp}${blocoMoedas}</div>
      <div class="jm-premio-itens">${cartas.join("")}</div>
      ${gm ? `<div class="jm-soltar jm-premio-drop" data-drop="recompensa" data-grupo="${gid}"><i class="fa-solid fa-hand-holding-heart"></i> ${T("Janela.ArrasteItensTalentosOuMagias")}</div>` : ""}
      ${r.additional ? `<div class="jm-texto jm-premio-extra">${await enr(r.additional)}</div>` : ""}
    </div>`);
  }
  if (gm) partes.push(`<button type="button" class="jm-add" data-action="novaRecompensa"><i class="fa-solid fa-plus"></i> ${grupos.length ? T("Janela.OutroGrupoDeRecompensa") : T("Janela.CriarRecompensa")}</button>`);
  if (x.recompensas) partes.push(`<div class="jm-texto jm-premio-extra">${await enr(x.recompensas)}</div>`);
  return secao(T("Comum.Recompensas"), "fa-solid fa-gem", partes.join(""), "jm-recompensas", "", "", "recompensas");
}

async function secaoObjetivos(ctx) {
  const { m, gm, ed, secao, enr } = ctx;
  const objs = comoLista(m.objectives).filter(([, o]) => gm || o.available !== false);
  const linhas = [];
  for (const [id, o] of objs) {
    const req = Number(o.required) || 0;
    const feito = req ? (Number(o.done) || 0) >= req : !!Number(o.done) || o.done === true;
    linhas.push(`<div class="jm-obj ${feito ? "feito" : ""} ${o.available === false ? "oculto" : ""}">
      ${gm ? `<a class="caixa" data-action="alternarObjetivo" data-id="${id}">` : `<span class="caixa">`}
        <i class="fa-${feito ? "solid fa-square-check" : "regular fa-square"}"></i>${gm ? "</a>" : "</span>"}
      ${ed ? `<input data-obj-texto data-id="${id}" value="${esc(String(o.content ?? "").replace(/<[^>]+>/g, ""))}">`
           : `<span class="texto">${await enr(o.content)}</span>`}
      ${req ? `<small class="jm-contador">${Number(o.done) || 0}/${req}</small>` : ""}
      ${gm ? `<a class="jm-mini-btn" data-action="ocultarObjetivo" data-id="${id}" data-tooltip="${o.available === false ? T("Janela.OcultoDosJogadores") : T("Janela.VisivelAosJogadores")}"><i class="fa-solid ${o.available === false ? "fa-eye-slash" : "fa-eye"}"></i></a>` : ""}
      ${ed ? `<a class="jm-mini-btn" data-action="removerObjetivo" data-id="${id}"><i class="fa-solid fa-trash"></i></a>` : ""}
    </div>`);
  }
  return secao(T("Janela.Objetivos"), "fa-solid fa-list-check",
    (linhas.join("") || `<em class="jm-vazio">${T("Janela.NenhumObjetivoAinda")}</em>`) +
    (gm ? `<button type="button" class="jm-add" data-action="novoObjetivo"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoObjetivo")}</button>` : ""), "", "", "", "objetivos");
}

export default {
  tipo: "quest",

  /* cabeçalho: status, quem deu, rastreador e prazo */
  detalhes(ctx) {
    const { m, x, ed, chipPagina, npcs } = ctx;
    const s = STATUS[m.status] ?? STATUS.inprogress;
    return ed
      ? `<div class="jm-sub-linha">
          <label class="jm-sub-campo">${T("Janela.Status")} <select data-campo="m:status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === m.status ? "selected" : ""}>${v.rotulo}</option>`).join("")}</select></label>
          <label class="jm-sub-campo">${T("Janela.QuemDeu")} <select data-campo="x:doador">${opcoes(npcs, x.doador)}</select></label>
          <label class="jm-check"><input type="checkbox" data-campo="x:rastrear" ${x.rastrear ? "checked" : ""}> ${T("Janela.NoRastreador")}</label></div>
        ${Tempo.ok() ? `<div class="jm-sub-linha jm-prazo-ed">
          ${x.prazo != null
            ? `<label class="jm-sub-campo">${T("Janela.Prazo2")} ${campoData("prazo", Number(x.prazo))}</label>
               <label class="jm-sub-campo">${T("Janela.QuandoVencer")} <select data-campo="x:aoVencer">
                 <option value="avisar" ${x.aoVencer !== "falhar" ? "selected" : ""}>${T("Janela.SoMeAvisar")}</option>
                 <option value="falhar" ${x.aoVencer === "falhar" ? "selected" : ""}>${T("Janela.MarcarComoFalhou")}</option></select></label>
               <button type="button" class="sec" data-action="prazoLimpar" data-tooltip="${T("Janela.TirarOPrazo")}"><i class="fa-solid fa-xmark"></i></button>`
            : `<button type="button" class="sec" data-action="prazoDefinir"><i class="fa-solid fa-hourglass-half"></i> ${T("Janela.DefinirPrazo")}</button>`}
        </div>` : ""}`
      : `<div class="jm-sub-linha"><span class="jm-status ${m.status}"><i class="${s.icone}"></i> ${s.rotulo}</span>
          ${chipPagina(x.doador, T("Janela.QuemDeuAMissao")) || (m.source ? `<span class="jm-detalhe"><small>${T("Janela.Origem")}</small>${esc(m.source)}</span>` : "")}
          ${x.prazo != null && Tempo.ok() ? (() => {
            const tp = textoPrazo(Number(x.prazo));
            return `<span class="jm-detalhe jm-prazo ${["completed", "failed"].includes(m.status) ? "" : tp.classe}"><small>${T("Janela.Prazo2")}</small><i class="fa-solid fa-hourglass-half"></i> ${esc(Tempo.texto(Number(x.prazo)))}${["completed", "failed"].includes(m.status) ? "" : ` · ${esc(tp.quando)}`}</span>`;
          })() : ""}</div>`;
  },

  async html(entry, app, ctx) {
    return (await secaoObjetivos(ctx)) + (await secaoRecompensas(ctx));
  },

  /** Mudar o status marca a data de conclusão e anota no diário da sessão; "quem deu" preenche a origem. */
  async aoSalvarCampo(app, e, page, escopo, chave, v) {
    if (escopo === "m" && chave === "status") {
      const fim = ["completed", "failed"].includes(v);
      await page.update({ [`flags.${MOD}.concluidaEm`]: fim ? Tempo.hoje() : null });
      if (fim) Sessao.registrar("missao", `${T("Janela.Missao")} <b>${esc(e.name)}</b>: ${esc(STATUS[v]?.rotulo ?? v)}.`);
    }
    if (escopo === "x" && chave === "doador") await dadosSet(page, "source", game.journal.get(v)?.name ?? "");
  },

  acoes: {
    async prazoDefinir(app) {
      const { page } = analisar(app._entry());
      await page.update({ [`flags.${MOD}.prazo`]: Tempo.hoje() + 7, [`flags.${MOD}.prazoAvisado`]: false });
    },
    async prazoLimpar(app) {
      const { page } = analisar(app._entry());
      await page.update({ [`flags.${MOD}.prazo`]: null, [`flags.${MOD}.prazoAvisado`]: false });
    },

    async novoObjetivo(app) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "objectives");
      const id = novoId();
      app.editando = true;
      await dadosSet(page, `objectives.${id}`, { id, content: T("Janela.NovoObjetivo"), done: 0, required: "", available: true });
    },

    async alternarObjetivo(app, ev, el) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "objectives");
      const o = dadosGet(page, `objectives.${el.dataset.id}`); if (!o) return;
      const req = Number(o.required) || 0;
      const feito = req ? (Number(o.done) || 0) >= req : !!Number(o.done) || o.done === true;
      await dadosSet(page, `objectives.${el.dataset.id}.done`, feito ? 0 : (req || 1));
    },

    async ocultarObjetivo(app, ev, el) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "objectives");
      const o = dadosGet(page, `objectives.${el.dataset.id}`); if (!o) return;
      await dadosSet(page, `objectives.${el.dataset.id}.available`, o.available === false);
    },

    async removerObjetivo(app, ev, el) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "objectives");
      await dadosUnset(page, `objectives.${el.dataset.id}`);
    },

    /* ---------- recompensas ---------- */

    async novaRecompensa(app) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "rewards");
      const id = novoId();
      await dadosSet(page, `rewards.${id}`, {
        id, name: T("Comum.Recompensas"), active: true, visible: true, awarded: false,
        itemIds: [], xp: 0, additional: "", currency: {}
      });
    },

    async recompensaVisivel(app, ev, el) {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "rewards");
      const atual = !!dadosGet(page, `rewards.${el.dataset.grupo}.visible`);
      await dadosSet(page, `rewards.${el.dataset.grupo}.visible`, !atual);
    },

    async apagarRecompensa(app, ev, el) {
      const { page, m } = analisar(app._entry());
      const r = Object.fromEntries(comoLista(m.rewards))[el.dataset.grupo];
      const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarRecompensa") }, content: `<p>${T("Janela.ApagarOGrupo")} <b>${esc(r?.name ?? T("Comum.Recompensas"))}</b> ${T("Janela.EOsItensDele")}</p>` });
      if (!ok) return;
      await garantirObjeto(page, "rewards");
      await garantirObjeto(page, "items");
      // o grupo e os itens dele saem numa gravação só
      const apagar = (r?.itemIds ?? []).filter((iid) => dadosGet(page, `items.${iid}`)).map((iid) => `flags.${MOD}.${CHAVE_DADOS}.items.${iid}`);
      await gravarJunto(page, {}, [...apagar, `flags.${MOD}.${CHAVE_DADOS}.rewards.${el.dataset.grupo}`]);
    },

    async removerPremio(app, ev, el) {
      const { page, m } = analisar(app._entry());
      await garantirObjeto(page, "rewards");
      const r = Object.fromEntries(comoLista(m.rewards))[el.dataset.grupo];
      await dadosSet(page, `rewards.${el.dataset.grupo}.itemIds`, (r?.itemIds ?? []).filter((i) => i !== el.dataset.id));
      if (dadosGet(page, `items.${el.dataset.id}`)) await dadosUnset(page, `items.${el.dataset.id}`);
    },

    async entregarRecompensa(app, ev, el) {
      const e = app._entry(); const { page, m } = analisar(e);
      const gid = el.dataset.grupo;
      const r = Object.fromEntries(comoLista(m.rewards))[gid];
      if (!r) return;
      const herois = [...new Set(game.users.filter((u) => !u.isGM && u.character).map((u) => u.character))];
      if (!herois.length) return ui.notifications.warn(T("Janela.NenhumJogadorTemPersonagemDefinido"));
      const itensMapa = Object.fromEntries(comoLista(m.items));
      const itens = (r.itemIds ?? []).map((iid) => [iid, itensMapa[iid]]).filter(([, it]) => it);
      const moedas = r.currency ?? {};
      const temMoedas = chavesMoedas().some((k) => Number(moedas[k]) > 0);

      const content = `<div class="jm-entrega">
        <h4><i class="fa-solid fa-users"></i> ${T("Janela.QuemRecebe")}</h4>
        <div class="jm-entrega-herois">${herois.map((h) => `<label class="jm-entrega-heroi">
          <input type="checkbox" name="h-${h.id}" checked>
          <img src="${esc(h.img)}" alt=""><b>${esc(h.name)}</b>
          <span class="jm-xp-ed"><i class="fa-solid fa-star"></i><input type="number" min="0" name="xp-${h.id}" value="${Number(r.xp) || 0}"><span>XP</span></span>
        </label>`).join("")}</div>
        ${temMoedas ? `<h4><i class="fa-solid fa-coins"></i> ${T("Janela.Moedas")}: ${mostrarMoedas(moedas)}</h4>
          <div class="jm-entrega-opcoes">
            <label><input type="radio" name="moedas" value="dividir" checked> ${T("Janela.DividirEntreOsMarcadosO")}</label>
            <label><input type="radio" name="moedas" value="cada"> ${T("Janela.CadaUmRecebeOValor")}</label>
            <label><input type="radio" name="moedas" value="nada"> ${T("Janela.NaoEntregarMoedasAgora")}</label>
          </div>` : ""}
        ${itens.length ? `<h4><i class="fa-solid fa-gem"></i> ${T("Janela.ItensTalentosEMagias")}</h4>
          <div class="jm-entrega-itens">${itens.map(([iid, it]) => `<label class="jm-entrega-item">
            <img src="${esc(it.img)}" alt=""><b>${esc(it.name)}</b>
            <select name="i-${iid}">
              <option value="">${T("Janela.DeixarNaMissaoQuemQuiser")}</option>
              ${herois.map((h) => `<option value="${h.id}">${T("Janela.DarPara")} ${esc(h.name)}</option>`).join("")}
              <option value="todos">${T("Janela.UmParaCadaMarcado")}</option>
            </select></label>`).join("")}</div>` : ""}
        <label class="jm-entrega-check"><input type="checkbox" name="anunciar" checked> ${T("Janela.AnunciarNoChat")}</label>
      </div>`;

      const dados = await Dialogo().prompt({
        window: { title: `${T("Janela.Entregar")}: ${r.name ?? T("Comum.Recompensas")}`, icon: "fa-solid fa-gift" },
        position: { width: 560 },
        content,
        ok: {
          label: T("Janela.Entregar"), icon: "fa-solid fa-gift",
          callback: (ev2, botao) => {
            const f = botao.form;
            const val = (n) => f.querySelector(`[name="${n}"]`);
            return {
              herois: herois.filter((h) => val(`h-${h.id}`)?.checked).map((h) => ({ id: h.id, xp: Number(val(`xp-${h.id}`)?.value) || 0 })),
              moedas: f.querySelector("[name=moedas]:checked")?.value ?? "nada",
              itens: Object.fromEntries(itens.map(([iid]) => [iid, val(`i-${iid}`)?.value ?? ""])),
              anunciar: !!val("anunciar")?.checked
            };
          }
        }
      }).catch(() => null);
      if (!dados) return;
      const escolhidos = dados.herois.map((h) => ({ ...h, ator: game.actors.get(h.id) })).filter((h) => h.ator);
      if (!escolhidos.length) return ui.notifications.warn(T("Janela.NenhumPersonagemMarcado"));

      /* moedas */
      const parte = {};
      for (const k of chavesMoedas()) {
        const total = Number(moedas[k]) || 0;
        parte[k] = dados.moedas === "cada" ? total : (dados.moedas === "dividir" ? Math.floor(total / escolhidos.length) : 0);
      }
      const linhasChat = [];
      const updsFichas = [];
      for (const h of escolhidos) {
        const upd = { _id: h.ator.id };
        if (h.xp && h.ator.system?.details?.xp) upd["system.details.xp.value"] = (Number(h.ator.system.details.xp.value) || 0) + h.xp;
        if (chavesMoedas().some((k) => parte[k])) {
          const atual = h.ator.system?.currency ?? {};
          upd["system.currency"] = Object.fromEntries(chavesMoedas().map((k) => [k, (Number(atual[k]) || 0) + parte[k]]));
        }
        if (Object.keys(upd).length > 1) updsFichas.push(upd);
        const recebeu = [h.xp ? `${h.xp} XP` : "", chavesMoedas().some((k) => parte[k]) ? formatarMoedas(parte) : ""].filter(Boolean);
        if (recebeu.length) linhasChat.push(`<b>${esc(h.ator.name)}</b>: ${esc(recebeu.join(" · "))}`);
      }
      // XP e moedas de todos numa gravação só
      if (updsFichas.length) await (CONFIG.Actor?.documentClass ?? globalThis.Actor).updateDocuments(updsFichas);

      /* itens: junta tudo o que cada ficha recebe e cria de uma vez por ficha */
      await garantirObjeto(page, "rewards");
      await garantirObjeto(page, "items");
      let restantes = [...(r.itemIds ?? [])];
      const porFicha = new Map();
      const saem = [];
      for (const [iid, destino] of Object.entries(dados.itens)) {
        if (!destino) continue;
        const it = itensMapa[iid];
        if (!it) continue;
        const alvos = destino === "todos" ? escolhidos.map((h) => h.ator) : [game.actors.get(destino)].filter(Boolean);
        for (const alvo of alvos) {
          if (!porFicha.has(alvo)) porFicha.set(alvo, []);
          porFicha.get(alvo).push(itemLimpo(it));
          linhasChat.push(`<b>${esc(alvo.name)}</b> ${T("Janela.Recebeu")} <b>${esc(it.name)}</b>`);
        }
        restantes = restantes.filter((i) => i !== iid);
        saem.push(`flags.${MOD}.${CHAVE_DADOS}.items.${iid}`);
      }
      // fichas diferentes são independentes: criadas em paralelo; uma falha é relatada, não escondida
      const criados = await Promise.allSettled([...porFicha].map(([alvo, itens2]) => alvo.createEmbeddedDocuments("Item", itens2)));
      const falhou = criados.find((x) => x.status === "rejected");
      if (falhou) throw falhou.reason;

      const resto = Object.fromEntries(chavesMoedas().map((k) => [k, Math.max(0, (Number(moedas[k]) || 0) - (dados.moedas === "dividir" ? parte[k] * escolhidos.length : (dados.moedas === "cada" ? Number(moedas[k]) || 0 : 0)))]));
      // a página da missão numa gravação só: itens que saíram + estado do grupo
      await gravarJunto(page, {
        [`flags.${MOD}.${CHAVE_DADOS}.rewards.${gid}.currency`]: resto,
        [`flags.${MOD}.${CHAVE_DADOS}.rewards.${gid}.itemIds`]: restantes,
        [`flags.${MOD}.${CHAVE_DADOS}.rewards.${gid}.awarded`]: true,
        [`flags.${MOD}.${CHAVE_DADOS}.rewards.${gid}.visible`]: true
      }, saem);
      Sessao.registrar("missao", `${T("Janela.RecompensaDe")} <b>${esc(e.name)}</b> entregue.${linhasChat.length ? `<ul>${linhasChat.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}`);
      if (dados.anunciar) await chat(`<i class="fa-solid fa-gift"></i> ${T("Janela.RecompensaDe")} <b>${esc(e.name)}</b> entregue!${linhasChat.length ? `<ul>${linhasChat.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}${restantes.length ? `<p>${T("Janela.AindaHaItensNaMissao")}</p>` : ""}`);
    },

    pegarRecompensa(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      pedir("pegarRecompensa", { entryId: app.ativa, grupo: el.dataset.grupo, itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id });
    }
  },

  /* soltar um item, talento ou magia num grupo de recompensa */
  soltar: {
    async recompensa(app, doc, e, page, el) {
      if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItemTalentoOu"));
      await garantirObjeto(page, "rewards");
      await garantirObjeto(page, "items");
      const gid = el.dataset.grupo;
      const data2 = itemParaLoja(doc, {}, 1);
      await dadosSet(page, `items.${data2._id}`, data2);
      const ids = dadosGet(page, `rewards.${gid}.itemIds`) ?? [];
      await dadosSet(page, `rewards.${gid}.itemIds`, [...ids, data2._id]);
    }
  },

  /* seletor de data do prazo */
  data: {
    async prazo(app, td) {
      const e = app._entry();
      if (!e) return;
      const { page } = analisar(e);
      await page.update({ [`flags.${MOD}.prazo`]: td, [`flags.${MOD}.prazoAvisado`]: false });
    }
  },

  /* texto dos objetivos editado na própria lista */
  ouvintes(app, root) {
    root.querySelectorAll("[data-obj-texto]").forEach((el) => el.addEventListener("change", async () => {
      const { page } = analisar(app._entry());
      await garantirObjeto(page, "objectives");
      await dadosSet(page, `objectives.${el.dataset.id}.content`, el.value);
    }));
  }
};
