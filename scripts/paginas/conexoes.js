/* Journal — seção "Conexões" (relationships do Monk's + fichas de personagem ligadas), usada por todos os
 * tipos de ficha (NPC, local, organização, loja, missão, divindade, baú, anotação, Monk's). */
import { T } from "../idioma.js";
import { MOD, TIPOS, analisar, apagarChave, comoLista, dadosGet, dadosSet, dadosUnset, ehGM, esc, fichasDe, garantirObjeto, infoCon } from "../nucleo.js";

function secaoConexoes(ctx) {
  const { entry, page, m, tipo, gm, ed, app, visiveis, chipPagina, secao } = ctx;
  const rels = comoLista(m.relationships).filter(([, r]) => gm || !r.hidden);
  const meus = rels.map(([id, r]) => {
    const chip = chipPagina(r.id ?? id, r.relationship, r.hidden, true);
    if (!chip) return "";
    return `<div class="jm-link">${chip}${gm ? `
      <a class="jm-mini-btn jm-olho ${r.hidden ? "fechado" : "aberto"}" data-action="ocultarLink" data-id="${id}" data-tooltip="${r.hidden ? T("Janela.OcultaOsJogadoresNaoVeem") : T("Janela.OsJogadoresVeemEstaConexao")}"><i class="fa-solid ${r.hidden ? "fa-eye-slash" : "fa-eye"}"></i></a>` : ""}${gm && ed ? `
      <a class="jm-mini-btn" data-action="removerLink" data-id="${id}" data-tooltip="${T("Janela.RemoverConexao")}"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>`;
  }).join("");
  /* fichas de personagem ligadas */
  const fichas = fichasDe(page).filter(([, f]) => gm || !f.hidden).map(([id, f]) => {
    const ator = fromUuidSync(f.uuid);
    if (!ator) return gm ? `<div class="jm-link"><span class="jm-ref trancada" data-con-tipo="ficha" data-con-busca="ficha apagada"><i class="fa-solid fa-user-slash"></i><span><b>${T("Janela.FichaApagada")}</b></span></span>${ed ? `
      <a class="jm-mini-btn" data-action="removerFicha" data-id="${id}" data-tooltip="${T("Janela.RemoverConexao")}"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>` : "";
    const pode = gm || ator.testUserPermission(game.user, "LIMITED");
    const dono = game.users.find((u) => !u.isGM && u.character?.id === ator.id) ?? game.users.find((u) => !u.isGM && ator.testUserPermission(u, "OWNER"));
    const extra = [f.relacao, dono ? `${T("Janela.Jogador")}: ${dono.name}` : ""].filter(Boolean).join(" · ");
    const busca = esc(`${ator.name} ${f.relacao ?? ""} ${dono?.name ?? ""}`.toLowerCase());
    const miolo = `<img class="jm-av mini" src="${esc(ator.img)}" alt=""><span><b>${esc(ator.name)}</b>${extra ? `<small>${esc(extra)}</small>` : ""}</span><i class="fa-solid fa-user-shield jm-ficha-ico"></i>`;
    const chip = pode
      ? `<a class="jm-ref jm-ref-ficha ${f.hidden ? "oculta" : ""}" data-action="abrirFicha" data-uuid="${esc(f.uuid)}" data-con-tipo="ficha" data-con-busca="${busca}" data-tooltip="${T("Janela.AbrirAFicha")}">${miolo}</a>`
      : `<span class="jm-ref jm-ref-ficha trancada" data-con-tipo="ficha" data-con-busca="${busca}">${miolo}</span>`;
    return `<div class="jm-link">${chip}${gm ? `
      <a class="jm-mini-btn jm-olho ${f.hidden ? "fechado" : "aberto"}" data-action="ocultarFicha" data-id="${id}" data-tooltip="${f.hidden ? T("Janela.OcultaOsJogadoresNaoVeem") : T("Janela.OsJogadoresVeemEstaConexao")}"><i class="fa-solid ${f.hidden ? "fa-eye-slash" : "fa-eye"}"></i></a>` : ""}${gm && ed ? `
      <a class="jm-mini-btn" data-action="removerFicha" data-id="${id}" data-tooltip="${T("Janela.RemoverConexao")}"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>`;
  }).join("");

  /* páginas já ligadas daqui (inclusive as ocultas, para a ligação de volta não "vazar" uma conexão escondida) */
  const ja = new Set(comoLista(m.relationships).map(([id, r]) => r.id ?? id));
  const reversos = [];
  for (const j of game.journal.contents) {
    if (j.id === entry.id || ja.has(j.id)) continue;
    const aj = analisar(j);
    if (aj.tipo === "shop" && aj.x.dono === entry.id) reversos.push(chipPagina(j.id, T("Janela.TrabalhaAqui")));
    else if (aj.tipo === "quest" && aj.x.doador === entry.id) reversos.push(chipPagina(j.id, T("Janela.MissaoOferecida")));
    else {
      const r = comoLista(aj.m.relationships).find(([id, rr]) => (rr.id ?? id) === entry.id);
      if (r && (gm || !r[1].hidden)) reversos.push(chipPagina(j.id, r[1].relationship || T("Janela.Menciona"), false, true));
    }
  }
  const outros = visiveis.filter((j) => j.id !== entry.id && analisar(j).page)
    .map((j) => ({ id: j.id, tipo: analisar(j).tipo, nome: j.name }))
    .sort((a2, b2) => a2.nome.localeCompare(b2.nome));
  /* seletor de páginas para ligar: busca + tipo, opções agrupadas por tipo */
  const ROTULOS_LIGAR = tipo === "deus" ? { deus: T("Janela.PanteaoDivindades"), organization: T("Janela.IgrejasOrganizacoes"), person: T("Janela.FieisNPCs") } : {};
  const ordemLigar = [...(tipo === "deus" ? ["deus", "organization", "person"] : []), ...Object.keys(TIPOS)].filter((k, i, arr) => arr.indexOf(k) === i);
  const gruposLigar = ordemLigar.map((k) => [k, outros.filter((o) => o.tipo === k)]).filter(([, l]) => l.length);
  /* fichas dos jogadores (primeiro) e as demais fichas de personagem do mundo */
  const jaFichas = new Set(fichasDe(page).map(([id]) => id));
  const atoresLigar = ed ? game.actors.filter((a2) => !jaFichas.has(a2.id) && (a2.hasPlayerOwner || a2.type === "character"))
    .sort((a2, b2) => (b2.hasPlayerOwner - a2.hasPlayerOwner) || a2.name.localeCompare(b2.name))
    .map((a2) => ({ id: `ficha:${a2.uuid}`, tipo: "ficha", nome: a2.name, dono: game.users.find((u) => !u.isGM && a2.testUserPermission(u, "OWNER"))?.name ?? "" })) : [];
  if (atoresLigar.length) gruposLigar.unshift(["ficha", atoresLigar]);
  const totalLigar = outros.length + atoresLigar.length;
  const addLink = ed ? `<div class="jm-ligar-filtro" data-ligar-filtro>
      <div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-link-busca placeholder="${T("Janela.BuscarPaginaParaLigar")}"></div>
      <select data-link-tipo><option value="">${T("Janela.TodosOsTipos")} (${totalLigar})</option>${gruposLigar.map(([k, l]) =>
        `<option value="${k}">${esc(ROTULOS_LIGAR[k] ?? infoCon(k).plural)} (${l.length})</option>`).join("")}</select>
    </div>
    <div class="jm-add-link">
      <select data-novo-link><option value="" data-vazio>— ${T("Janela.EscolhaUmaPaginaOuFicha")} (${totalLigar}) —</option>${gruposLigar.map(([k, l]) =>
        `<optgroup label="${esc(ROTULOS_LIGAR[k] ?? infoCon(k).plural)}" data-grupo-tipo="${k}">${l.map((o) =>
          `<option value="${esc(o.id)}" data-con-tipo="${o.tipo}" data-con-busca="${esc(`${o.nome} ${o.dono ?? ""}`.toLowerCase())}">${esc(o.nome)}${o.dono ? ` (${esc(o.dono)})` : ""}</option>`).join("")}</optgroup>`).join("")}</select>
      <input data-novo-rotulo placeholder="${tipo === "deus" ? T("Janela.RelacaoExIgrejaRivalConsorte") : T("Janela.RelacaoExIrmaoFornecedorRival")}">
      <button type="button" data-action="adicionarLink"><i class="fa-solid fa-link"></i> ${T("Janela.Ligar")}</button>
    </div><p class="jm-dica">${T("Janela.OuArrasteUmaPaginaDa")}</p>` : "";
  const reversosVisiveis = reversos.filter(Boolean);
  reversos.length = 0; reversos.push(...reversosVisiveis);
  /* filtros: por texto e por tipo (Panteão = divindades, Igrejas = organizações, Fiéis = NPCs) */
  const ROTULOS_CON = tipo === "deus" ? { deus: T("Janela.Panteao"), organization: T("Janela.Igrejas"), person: T("Janela.Fieis") } : {};
  const contagem = {};
  const contar = (html) => { for (const mt of String(html).matchAll(/data-con-tipo="(\w+)"/g)) contagem[mt[1]] = (contagem[mt[1]] ?? 0) + 1; };
  contar(meus); contar(fichas); reversos.forEach(contar);
  const ordemCon = [...(tipo === "deus" ? ["deus", "organization", "person"] : []), "ficha", ...Object.keys(TIPOS)].filter((k, i, arr) => arr.indexOf(k) === i);
  const tiposCon = ordemCon.filter((k) => contagem[k] || (ed && ROTULOS_CON[k]));
  const total = Object.values(contagem).reduce((a2, b2) => a2 + b2, 0);
  if (app.conFiltro?.tipo && !tiposCon.includes(app.conFiltro.tipo)) app.conFiltro.tipo = "";
  const filtroCon = total > 3 ? `<div class="jm-con-filtros">
      <div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-con-busca-campo placeholder="${T("Janela.FiltrarConexoesNomeOuRelacao")}" value="${esc(app.conFiltro?.texto ?? "")}"></div>
      <div class="jm-con-chips">
        <button type="button" class="jm-chip ${!app.conFiltro?.tipo ? "ativo" : ""}" data-action="conTipo" data-tipo="">${T("Janela.Todos")} <span>${total}</span></button>
        ${tiposCon.map((k) => `<button type="button" class="jm-chip ${app.conFiltro?.tipo === k ? "ativo" : ""}" data-action="conTipo" data-tipo="${k}"><i class="${infoCon(k).icone}"></i> ${esc(ROTULOS_CON[k] ?? (k === "ficha" ? T("Janela.Personagens") : TIPOS[k].plural))} <span>${contagem[k] ?? 0}</span></button>`).join("")}
      </div></div>` : "";
  if (!(meus || fichas || reversos.length || ed)) return "";
  return secao(tipo === "deus" ? T("Janela.PanteaoIgrejasEFieis") : T("Janela.Conexoes"), "fa-solid fa-diagram-project",
    filtroCon + `<p class="jm-vazio jm-con-nada" hidden>${T("Janela.NenhumaConexaoComEsseFiltro")}</p>` +
    `<div class="jm-links">${fichas}${meus}</div>` +
    (reversos.length ? `<div class="jm-reversos"><span>${T("Janela.TambemLigadoA")}</span><div class="jm-links">${reversos.join("")}</div></div>` : "") +
    addLink, "jm-conexoes", ed ? `data-drop="link"` : "");
}

/** Esconde as conexões (e as opções de "ligar") que não batem com o filtro. */
function filtrarConexoes(app, raiz) {
  const texto = (app.conFiltro?.texto ?? "").trim().toLowerCase();
  const tipo = app.conFiltro?.tipo ?? "";
  const passa = (el) => (!tipo || el.dataset.conTipo === tipo) && (!texto || (el.dataset.conBusca ?? "").includes(texto));
  let visiveis = 0, total = 0;
  raiz.querySelectorAll(".jm-links > .jm-link").forEach((linha) => {
    const ref = linha.querySelector("[data-con-tipo]");
    const ok = !ref || passa(ref);
    linha.hidden = !ok; total++; if (ok) visiveis++;
  });
  raiz.querySelectorAll(".jm-reversos [data-con-tipo]").forEach((ref) => { const ok = passa(ref); ref.hidden = !ok; total++; if (ok) visiveis++; });
  const rev = raiz.querySelector(".jm-reversos");
  if (rev) rev.hidden = !rev.querySelector("[data-con-tipo]:not([hidden])");
  const nada = raiz.querySelector(".jm-con-nada");
  if (nada) nada.hidden = !(total && !visiveis);
}

/** Filtra o seletor "escolha uma página" pela busca e pelo tipo. */
function filtrarLigar(raiz) {
  const texto = (raiz.querySelector("[data-link-busca]")?.value ?? "").trim().toLowerCase();
  const tipo = raiz.querySelector("[data-link-tipo]")?.value ?? "";
  const sel = raiz.querySelector("[data-novo-link]");
  if (!sel) return;
  let n = 0, primeira = null;
  sel.querySelectorAll("optgroup").forEach((g) => {
    let algum = false;
    g.querySelectorAll("option").forEach((o) => {
      const ok = (!tipo || o.dataset.conTipo === tipo) && (!texto || o.dataset.conBusca.includes(texto));
      o.hidden = !ok; o.disabled = !ok;
      if (ok) { algum = true; n++; primeira ??= o; }
    });
    g.hidden = !algum;
  });
  const vazio = sel.querySelector("[data-vazio]");
  if (vazio) vazio.textContent = n ? `— ${T("Janela.EscolhaUmaPaginaOuFicha")} (${n}) —` : T("Janela.NadaComEsseFiltro");
  if (sel.selectedOptions[0]?.hidden) sel.value = "";
  /* buscou e só sobrou uma (ou a busca está digitada): já deixa a primeira escolhida */
  if (texto && primeira && (!sel.value || sel.selectedOptions[0]?.hidden)) sel.value = primeira.value;
}

async function ligar(entry, page, outro, rotulo) {
  await garantirObjeto(page, "relationships");
  await dadosSet(page, `relationships.${outro.id}`, { id: outro.id, uuid: outro.uuid, hidden: false, relationship: rotulo });
  const outroPage = analisar(outro).page;
  if (outroPage && !comoLista(dadosGet(outroPage, "relationships")).some(([id, r]) => (r.id ?? id) === entry.id)) {
    await garantirObjeto(outroPage, "relationships");
    await dadosSet(outroPage, `relationships.${entry.id}`, { id: entry.id, uuid: entry.uuid, hidden: false });
  }
}

/** Liga uma ficha de personagem (ator) à página. */
async function ligarFicha(page, ator, rotulo) {
  if (!page) return;
  if (fichasDe(page).some(([id]) => id === ator.id)) return ui.notifications.info(`"${ator.name}" ${T("Janela.JaEstaLigadoAqui")}`);
  await page.update({ [`flags.${MOD}.fichas.${ator.id}`]: { uuid: ator.uuid, relacao: rotulo, hidden: false } });
}

const acoes = {
  async adicionarLink(app, ev, el) {
    const raiz = el.closest(".jm-add-link");
    const id = raiz.querySelector("[data-novo-link]").value;
    const rotulo = raiz.querySelector("[data-novo-rotulo]").value.trim();
    if (!id) return ui.notifications.warn(T("Janela.EscolhaUmaPaginaOuFicha2"));
    const e = app._entry();
    if (id.startsWith("ficha:")) {
      const ator = await fromUuid(id.slice(6));
      return ator ? ligarFicha(analisar(e).page, ator, rotulo) : ui.notifications.warn(T("Janela.EssaFichaNaoExisteMais"));
    }
    await ligar(e, analisar(e).page, game.journal.get(id), rotulo);
  },

  async removerLink(app, ev, el) {
    const e = app._entry(); const { page } = analisar(e);
    const id = el.dataset.id;
    await garantirObjeto(page, "relationships");
    await dadosUnset(page, `relationships.${id}`);
    const outroPage = game.journal.get(id) ? analisar(game.journal.get(id)).page : null;
    if (dadosGet(outroPage, `relationships.${e.id}`)) await dadosUnset(outroPage, `relationships.${e.id}`);
  },

  async ocultarLink(app, ev, el) {
    const { page } = analisar(app._entry());
    await garantirObjeto(page, "relationships");
    const atual = !!dadosGet(page, `relationships.${el.dataset.id}.hidden`);
    await dadosSet(page, `relationships.${el.dataset.id}.hidden`, !atual);
  },

  async abrirFicha(app, ev, el) {
    const ator = await fromUuid(el.dataset.uuid);
    if (!ator) return ui.notifications.warn(T("Janela.EssaFichaNaoExisteMais"));
    if (!ehGM() && !ator.testUserPermission(game.user, "LIMITED")) return ui.notifications.warn(T("Janela.VoceNaoTemAcessoA"));
    ator.sheet.render(true);
  },
  async ocultarFicha(app, ev, el) {
    const { page } = analisar(app._entry());
    const atual = !!page.flags?.[MOD]?.fichas?.[el.dataset.id]?.hidden;
    await page.update({ [`flags.${MOD}.fichas.${el.dataset.id}.hidden`]: !atual });
  },
  async removerFicha(app, ev, el) {
    const { page } = analisar(app._entry());
    await apagarChave(page, `flags.${MOD}.fichas`, el.dataset.id);
  },

  conTipo(app, ev, el) {
    app.conFiltro = { texto: app.conFiltro?.texto ?? "", tipo: el.dataset.tipo || "" };
    const raiz = el.closest(".jm-conexoes");
    raiz?.querySelectorAll("[data-action=conTipo]").forEach((b) => b.classList.toggle("ativo", b === el));
    if (raiz) filtrarConexoes(app, raiz);
  }
};

/* soltar uma página ou ficha na seção (só no modo de edição) */
const soltar = {
  async link(app, doc, e, page) {
    if (doc.documentName === "Actor") return ligarFicha(page, doc, "");
    if (doc.documentName !== "JournalEntry" || doc.id === e.id) return ui.notifications.warn(T("Janela.ArrasteUmaPaginaDoJournal"));
    return ligar(e, page, doc, "");
  }
};

function ouvintes(app, root) {
  const conexoes = root.querySelector(".jm-conexoes");
  if (!conexoes) return;
  conexoes.querySelector("[data-con-busca-campo]")?.addEventListener("input", (ev) => {
    app.conFiltro = { tipo: app.conFiltro?.tipo ?? "", texto: ev.target.value };
    filtrarConexoes(app, conexoes);
  });
  filtrarConexoes(app, conexoes);
  const ligarEl = conexoes.querySelector("[data-ligar-filtro]");
  if (ligarEl) {
    ligarEl.querySelector("[data-link-busca]").addEventListener("input", () => filtrarLigar(conexoes));
    ligarEl.querySelector("[data-link-tipo]").addEventListener("change", () => filtrarLigar(conexoes));
    ligarEl.querySelector("[data-link-busca]").addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      conexoes.querySelector("[data-novo-rotulo]")?.focus();
    });
  }
}

export { acoes, ouvintes, secaoConexoes, soltar };
