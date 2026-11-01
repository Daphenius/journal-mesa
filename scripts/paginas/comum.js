/* Journal — pedaços de HTML que todos os tipos de página usam (cabeçalho, seção, chip de página,
 * descrição, segredos, notas pessoais, páginas nativas do Foundry).
 * Cada tipo de página fica em scripts/paginas/<tipo>.js e recebe o "ctx" montado aqui por contexto(). */
import { T } from "../idioma.js";
import { CHAVE_DADOS, DETALHES, ICONES_PAGINA, MOD, NOMES_MEJ, TE, TIPOS, analisar, avatar, avisoUmaVez, caminhoDaPasta, dicaNota, ehGM, esc, fixados, nomeDoTipoDePagina, notaMestre, podeVerSecao, relatarErro, rotuloEstadoSecao, temModulo, textoParaHtml, tiposDePagina, visibilidade } from "../nucleo.js";
import { calApi, calNota, deusDaFesta } from "../partes/calendario.js";

/** Tudo o que os tipos de página precisam para montar o HTML: a página analisada, quem vê, modo de edição,
 *  e os ajudantes secao()/chipPagina()/enr() que contam as seções escondidas do jogador. */
function contexto(app, entry, visiveis, P) {
  const a = analisar(entry);
  const { page, m, x, tipo } = a;
  const gm = ehGM();
  const ed = gm && app.editando && P.editavel !== false;
  const visivelIds = new Set(visiveis.map((j) => j.id));
  const ctx = {
    app, entry, a, page, m, x, tipo, t: TIPOS[tipo], gm, ed, visiveis, visivelIds, P,
    escondidas: 0,
    traduzir: temModulo("translate-all"),
    enr: async (txt) => (txt ? await TE().enrichHTML(textoParaHtml(txt), { secrets: gm, relativeTo: page ?? entry }) : ""),
    get npcs() { return visiveis.filter((j) => analisar(j).tipo === "person").map((j) => [j.id, j.name]); }
  };
  ctx.chipPagina = (id, extra = "", oculto = false, trancado = false) => {
    const j = game.journal.get(id);
    if (!j) return "";
    const aj = analisar(j);
    if (!visivelIds.has(id)) {
      if (!trancado) return "";
      /* conexão revelada para uma página que o jogador ainda não pode abrir: mostra, mas sem link */
      return `<span class="jm-ref trancada" data-con-tipo="${aj.tipo}" data-con-busca="${esc(`${j.name} ${extra}`.toLowerCase())}" data-tooltip="${T("Janela.VoceAindaNaoTemAcesso")}">${avatar(aj.page?.src, aj.tipo, "mini")}
        <span><b>${esc(j.name)}</b>${extra ? `<small>${esc(extra)}</small>` : ""}</span><i class="fa-solid fa-lock"></i></span>`;
    }
    return `<a class="jm-ref ${oculto ? "oculta" : ""}" data-action="abrir" data-id="${id}" data-con-tipo="${aj.tipo}" data-con-busca="${esc(`${j.name} ${extra}`.toLowerCase())}">${avatar(aj.page?.src, aj.tipo, "mini")}
      <span><b>${esc(j.name)}</b>${extra ? `<small>${esc(extra)}</small>` : ""}</span></a>`;
  };
  ctx.secao = (titulo, icone, corpo, extra = "", attrs = "", controles = "", chave = null) => {
    if (chave && !podeVerSecao(entry, chave)) { ctx.escondidas++; return ""; }
    if (chave && gm) {
      const [cls, ic, dica] = rotuloEstadoSecao(entry, chave);
      controles = `<a class="jm-mini-btn jm-revela ${cls}" data-action="revelarSecao" data-chave="${esc(chave)}" data-tooltip="${esc(dica)} — ${T("Janela.CliqueParaMudar")}"><i class="fa-solid ${ic}"></i></a>` + controles;
    }
    return `<section class="jm-secao ${extra}" ${attrs}><h3><i class="${icone}"></i> <span class="jm-sec-titulo">${titulo}</span>${controles ? `<span class="jm-sec-ctrl">${controles}</span>` : ""}</h3>${corpo}</section>`;
  };
  ctx.avisoEscondidas = () => (!gm && ctx.escondidas
    ? `<p class="jm-vazio jm-centro jm-escondidas"><i class="fa-solid fa-lock"></i> ${ctx.escondidas === 1 ? T("Janela.UmaInformacaoAindaNaoFoi") : `${ctx.escondidas} ${T("Janela.InformacoesAindaNaoForamReveladas")}`}</p>` : "");
  return ctx;
}

/** Cabeçalho da página: retrato, selo do tipo, título, detalhes (campos curtos), nota do mestre e botões. */
function cabecalho(ctx) {
  const { entry, a, page, m, x, tipo, t, gm, ed, P, traduzir } = ctx;
  const selo = P.selo ? P.selo(ctx) : t.rotulo;
  let detalhes = "";
  const campos = P.campos ? P.campos(ctx) : (DETALHES[tipo] ?? []).map(([k, r]) => [`m:${k}`, r, m[k]]);
  const valorCampo = (k, v) => (P.valorCampo ? P.valorCampo(k, v) : v);
  if (ed && campos.length) detalhes = `<div class="jm-sub-linha">${campos.map(([k, r, v]) => (P.campoEditavel && P.campoEditavel(k, r, v))
    || `<label class="jm-sub-campo">${r}<input data-campo="${k}" value="${esc(v ?? "")}"></label>`).join("")}</div>`;
  else if (campos.some(([, , v]) => v)) detalhes = `<div class="jm-sub-linha">${campos.filter(([, , v]) => v)
    .map(([k, r, v]) => `<span class="jm-detalhe"><small>${r}</small>${esc(valorCampo(k, v))}</span>`).join("")}</div>`;
  if (P.detalhes) detalhes += P.detalhes(ctx);

  /* dia sagrado: mostra de qual divindade */
  const deusFesta = deusDaFesta(entry);
  if (deusFesta) detalhes += `<div class="jm-sub-linha">${ctx.chipPagina(deusFesta.id, T("Janela.DiaSagradoDe"), false, true)}</div>`;

  const visivel = visibilidade(entry);
  const estaFixa = fixados().has(entry.id);
  let botoes = `<button type="button" data-action="fixar" data-id="${entry.id}" class="${estaFixa ? "ativo" : ""}" data-tooltip="${estaFixa ? T("Janela.Desafixar") : T("Janela.FixarFicaNoTopoDa")}"><i class="fa-solid fa-thumbtack"></i></button>`;
  if (traduzir && page && (gm || page.isOwner)) botoes += `<button type="button" data-action="traduzir" data-tooltip="${T("Janela.TraduzirComOTranslateAll")}"><i class="fa-solid fa-language"></i></button>`;
  if (gm) {
    if (P.editavel !== false) botoes += `<button type="button" data-action="editar" class="${ed ? "ativo" : ""}" data-tooltip="${ed ? T("Janela.ConcluirEdicao") : T("Janela.Editar")}"><i class="fa-solid ${ed ? "fa-check" : "fa-pen"}"></i></button>`;
    if (P.fichaNativa) botoes += `<button type="button" data-action="fichaNativa" data-tooltip="${T("Janela.AbrirNaFichaPadraoDo")}"><i class="fa-solid fa-up-right-from-square"></i></button>`;
    botoes += `
      <button type="button" data-action="visivel" class="jm-vis ${visivel}" data-tooltip="${{ todos: T("Janela.TodosOsJogadoresVeem"), alguns: T("Janela.AlgunsJogadoresVeem"), ninguem: T("Janela.OcultoDosJogadores") }[visivel]} — ${T("Janela.CliqueParaEscolherQuemVe")}"><i class="fa-solid ${{ todos: "fa-eye", alguns: "fa-user-check", ninguem: "fa-eye-slash" }[visivel]}"></i></button>
      <button type="button" data-action="mostrar" data-tooltip="${T("Janela.AbrirNaTelaDosJogadores2")}"><i class="fa-solid fa-bullhorn"></i></button>
      ${calApi() && !calNota(entry) ? `<button type="button" data-action="calAdicionar" data-tooltip="${T("Janela.ColocarNoCalendario")}"><i class="fa-solid fa-calendar-plus"></i></button>` : ""}
      <button type="button" class="jm-lixeira" data-action="apagar" data-tooltip="${T("Janela.ApagarEstaPaginaPedeConfirmacao")}"><i class="fa-solid fa-trash"></i></button>`;
  }

  const caminho = entry.folder ? `<span class="jm-caminho"><i class="fa-solid fa-folder"></i> ${esc(caminhoDaPasta(entry.folder).join(" / "))}</span>` : "";
  const imgCab = P.imagemCabecalho ? P.imagemCabecalho(ctx) : page?.src ?? null;
  return `<header class="jm-cabecalho">
      <div class="jm-retrato ${ed ? "editavel" : ""}" ${ed ? `data-action="imagem" data-tooltip="${T("Janela.TrocarImagem")}"` : ""}>${avatar(imgCab, tipo, "grande")}</div>
      <div class="jm-cab-texto">
        <div class="jm-selos"><span class="jm-selo tipo-${tipo}"><i class="${t.icone}"></i> ${esc(selo)}</span>${caminho}</div>
        ${ed ? `<input class="jm-titulo" data-campo="__nome" value="${esc(entry.name)}">` : `<h1 class="jm-titulo">${esc(entry.name)}</h1>`}
        ${detalhes}
        ${gm ? (notaMestre(entry)
          ? `<a class="jm-nota-mestre" data-action="notaMestre" data-tooltip="${T("Janela.NotaDoMestreSoVoce")}"><i class="fa-solid fa-note-sticky"></i> ${dicaNota(notaMestre(entry))}</a>`
          : `<a class="jm-nota-mestre vazia" data-action="notaMestre"><i class="fa-solid fa-note-sticky"></i> ${T("Janela.AdicionarNotaDoMestre")}</a>`) : ""}
      </div>
      <div class="jm-cab-botoes">${botoes}</div>
    </header>`;
}

/** Imagem do cabeçalho e da lista para diários com várias páginas: a primeira página de imagem. */
const primeiraImagem = (a) => a.page?.src ?? a.pages.find((p) => p.type === "image")?.src ?? null;

/** Descrição (text.content nativo): editor rico no modo de edição, texto enriquecido fora dele. */
async function descricao(ctx) {
  const { page, gm, ed, P, secao } = ctx;
  const tituloResumo = P.tituloDescricao ? P.tituloDescricao() : T("Janela.Descricao");
  const html = page.text?.content ?? "";
  if (P.mostrarDescricao && !P.mostrarDescricao(ctx, html)) return "";
  return secao(tituloResumo, "fa-solid fa-align-left", ed
    ? `<div class="jm-editor-alvo" data-editor></div>`
    : `<div class="jm-texto">${html ? await TE().enrichHTML(html, { secrets: gm, relativeTo: page }) : `<em class="jm-vazio">${T("Janela.SemDescricao")}</em>`}</div>`,
    "", "", gm ? `<a class="jm-mini-btn" data-action="traduzir" data-tooltip="${T("Janela.AbrirNoEditorCompletoDo")}"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></a>` : "", "descricao");
}

/** Segredos do mestre (só ele vê). */
async function segredos(ctx) {
  const { x, gm, ed, secao, enr } = ctx;
  if (!gm || !(x.segredo || ed)) return "";
  return secao(T("Janela.SegredosDoMestre"), "fa-solid fa-user-secret", ed
    ? `<textarea data-campo="x:segredo" rows="4" placeholder="${T("Janela.SoOMestreVeIsto")}">${esc(x.segredo)}</textarea>`
    : `<div class="jm-texto">${await enr(x.segredo)}</div>`, "jm-segredo");
}

/** Notas pessoais de quem está vendo (cada usuário tem a sua). */
function notas(page, secao) {
  if (!page) return "";
  const nota = page.flags?.[MOD]?.[CHAVE_DADOS]?.notas?.[game.user.id] ?? "";
  return secao(`${T("Janela.MinhasNotas")} <small>${T("Janela.Pessoais")}</small>`, "fa-solid fa-feather",
    `<textarea data-nota rows="4" placeholder="${T("Janela.SuasSuspeitasNomesPistas")}">${esc(String(nota).replace(/<\/?p>/g, ""))}</textarea>`, "jm-notas");
}

/** Botões "Adicionar página" (tipos nativos do Foundry e do dnd5e), para diários e Histórias. */
function botoesAdicionarPagina() {
  return `<div class="jm-add-paginas"><span>${T("Janela.AdicionarPagina")}</span>${tiposDePagina().map((tp) =>
    `<button type="button" data-action="novaPagina" data-tipo="${tp}"><i class="${ICONES_PAGINA[tp] ?? "fa-solid fa-file"}"></i> ${esc(nomeDoTipoDePagina(tp))}</button>`).join("")}</div>`;
}

/** Mostra uma página nativa do Foundry (núcleo e dnd5e). */
async function paginaNativa(p) {
  const gm = ehGM();
  const enr = (h) => TE().enrichHTML(h ?? "", { secrets: gm, relativeTo: p });
  switch (p.type) {
    case "text":
    case "map":
      return `<div class="jm-texto">${(await enr(p.text?.content)) || `<em class="jm-vazio">${T("Janela.PaginaVazia")}</em>`}</div>`;
    case "image":
      return p.src ? `<figure class="jm-figura"><img src="${esc(p.src)}" alt="">${p.image?.caption ? `<figcaption>${esc(p.image.caption)}</figcaption>` : ""}</figure>`
        : `<em class="jm-vazio">${T("Janela.SemImagem")}</em>`;
    case "pdf": {
      if (!p.src) return `<em class="jm-vazio">${T("Janela.NenhumPDFEscolhidoEditeA")}</em>`;
      const absoluto = /^(https?:|blob:|data:)/i.test(p.src) ? p.src
        : new URL(foundry.utils.getRoute(p.src.replace(/^\//, "")), window.location.origin).href;
      const visor = `${foundry.utils.getRoute("scripts/pdfjs/web/viewer.html")}?${new URLSearchParams({ file: absoluto })}`;
      return `<div class="jm-pdf-busca" data-pdf>
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="search" placeholder="${T("Janela.BuscarNoPDF")}" data-pdf-busca>
          <span class="jm-pdf-contagem" data-pdf-contagem></span>
          <a class="jm-mini-btn" data-pdf-ir="anterior" data-tooltip="${T("Janela.AnteriorShiftEnter")}"><i class="fa-solid fa-chevron-up"></i></a>
          <a class="jm-mini-btn" data-pdf-ir="proximo" data-tooltip="${T("Janela.ProximoEnter")}"><i class="fa-solid fa-chevron-down"></i></a>
          <a class="jm-mini-btn" href="${esc(visor)}" target="_blank" data-tooltip="${T("Janela.AbrirNumaAba")}"><i class="fa-solid fa-up-right-from-square"></i></a>
        </div>
        <iframe class="jm-pdf" src="${esc(visor)}"></iframe>`;
    }
    case "video": {
      if (!p.src) return `<em class="jm-vazio">${T("Janela.NenhumVideoEscolhido")}</em>`;
      const yt = p.src.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
      return yt ? `<iframe class="jm-video" src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe>`
        : `<video class="jm-video" src="${esc(p.src)}" controls></video>`;
    }
    case "rule": {
      const dica = p.system?.tooltip?.value ?? (typeof p.system?.tooltip === "string" ? p.system.tooltip : "");
      return `<div class="jm-texto">${await enr(p.text?.content)}</div>${dica ? `<div class="jm-regra-dica"><small>${T("Janela.DicaTooltip")}</small>${await enr(dica)}</div>` : ""}`;
    }
    case "spells": {
      const uuids = [...(p.system?.spells ?? [])];
      const magias = uuids.map((u) => ({ u, d: fromUuidSync(u) })).filter((o) => o.d);
      const desc = p.system?.description?.value ?? "";
      const porNivel = new Map();
      const temNivel = magias.some((o) => o.d.system?.level != null);
      for (const o of magias) {
        const nv = temNivel ? Number(o.d.system?.level ?? 0) : "todas";
        if (!porNivel.has(nv)) porNivel.set(nv, []);
        porNivel.get(nv).push(o);
      }
      const rotNivel = (nv) => nv === "todas" ? T("Janela.Magias")
        : (CONFIG.DND5E?.spellLevels?.[nv] ? game.i18n.localize(CONFIG.DND5E.spellLevels[nv]) : (nv === 0 ? T("Janela.Truques") : `${nv}${T("Janela.Circulo")}`));
      const grupos = [...porNivel.keys()].sort((a, b) => (a === "todas" ? 0 : a) - (b === "todas" ? 0 : b)).map((nv) => {
        const lista = porNivel.get(nv).sort((a, b) => a.d.name.localeCompare(b.d.name, game.i18n.lang)).map(({ u, d }) =>
          `<a class="content-link jm-magia" draggable="true" data-link data-uuid="${esc(u)}" data-type="Item" data-tooltip="${esc(d.name)}"><img src="${esc(d.img)}" alt="">${esc(d.name)}</a>`).join("");
        return `<div class="jm-magias-grupo"><h4>${esc(rotNivel(nv))}</h4><div class="jm-magias">${lista}</div></div>`;
      }).join("");
      return `${desc ? `<div class="jm-texto">${await enr(desc)}</div>` : ""}${grupos || `<em class="jm-vazio">${T("Janela.ListaDeMagiasVazia")}</em>`}`;
    }
    case "class":
    case "subclass": {
      const item = p.system?.item ? fromUuidSync(p.system.item) : null;
      const intro = p.system?.description?.value ?? "";
      return `${item ? `<p>${await enr(`@UUID[${p.system.item}]{${item.name}}`)}</p>` : ""}${intro ? `<div class="jm-texto">${await enr(intro)}</div>` : ""}
        <p class="jm-dica">${T("Janela.TabelaEDetalhesCompletosFicam")} <i class="fa-solid fa-pen"></i>.</p>`;
    }
    default:
      return `<p class="jm-vazio">${T("Janela.PaginaDoTipo")} "${esc(nomeDoTipoDePagina(p.type))}". ${T("Janela.UseOLapisParaAbrir")}</p>`;
  }
}

/** Controles (lápis, lixeira, tradução) de uma página nativa dentro de um diário ou História. */
function controlesPaginaNativa(ctx, p, dicaEditar, dicaApagar) {
  const { gm, traduzir } = ctx;
  if (!gm) return "";
  return `
    ${traduzir && p.type === "text" ? `<a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${T("Janela.TraduzirAbreAPagina")}"><i class="fa-solid fa-language"></i></a>` : ""}
    <a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${dicaEditar}"><i class="fa-solid fa-pen"></i></a>
    <a class="jm-mini-btn" data-action="apagarPagina" data-page="${p.id}" data-tooltip="${dicaApagar}"><i class="fa-solid fa-trash"></i></a>`;
}

/* Editor da descrição. O texto é gravado 400 ms depois da última tecla; se a janela for redesenhada nesse
 * meio-tempo, o texto pendente é gravado na hora e o editor novo já nasce com ele (nada digitado se perde). */
function montarEditor(app, alvo) {
  const { page } = analisar(app._entry());
  if (!page) return;
  const pend = app._editorPendente;
  const html = pend?.pageId === page.id ? pend.valor : (page.text?.content ?? "");
  let timer = null;
  const gravar = async (valor) => {
    try { await page.update({ "text.content": valor }); }
    catch (err) { relatarErro(T("Janela.SalvarADescricao"), err); }
    finally { if (app._editorPendente?.valor === valor) app._editorPendente = null; }
  };
  const salvar = (valor) => {
    app._editorPendente = { pageId: page.id, valor };
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; gravar(valor); }, 400);
  };
  app._descarregarEditor = () => {
    if (!timer) return;
    clearTimeout(timer); timer = null;
    if (app._editorPendente?.pageId === page.id) gravar(app._editorPendente.valor);
  };
  app.editorAtivo = true;
  try {
    if (game.settings.get(MOD, "editor") === "simples") throw new Error(T("Janela.ModoSimples"));
    const PM = foundry.applications.elements.HTMLProseMirrorElement;
    if (!PM.create) throw new Error(T("Janela.SemProseMirror"));
    const el = PM.create({ name: "text.content", value: html, toggled: false, documentUUID: page.uuid, height: 280 });
    el.classList.add("jm-editor");
    el.addEventListener("change", () => salvar(el.value));
    el.addEventListener("input", () => { if (el.value !== undefined) salvar(el.value); });
    // clicar em qualquer parte vazia do editor coloca o cursor no texto
    el.addEventListener("pointerdown", (ev) => {
      const editavel = el.querySelector("[contenteditable]");
      if (editavel && !editavel.contains(ev.target) && !ev.target.closest("menu, button, .editor-menu")) {
        ev.preventDefault();
        editavel.focus();
      }
    });
    alvo.replaceWith(el);
  } catch (err) {
    // sem o editor rico do Foundry (API mudou?): caixa de texto simples, e um aviso no console
    avisoUmaVez(T("Janela.EditorDeTextoRico"), err);
    const ta = document.createElement("textarea");
    ta.rows = 10;
    ta.className = "jm-editor";
    ta.value = html;
    ta.addEventListener("input", () => salvar(ta.value));
    alvo.replaceWith(ta);
  }
}

/* ---------- ações e ouvintes das páginas nativas ---------- */

const acoes = {
  async novaPagina(app, ev, el) {
    const e = app._entry();
    const tipo = el.dataset.tipo;
    const [p] = await e.createEmbeddedDocuments("JournalEntryPage", [{
      name: nomeDoTipoDePagina(tipo), type: tipo,
      sort: (e.pages.contents.reduce((mx, pg) => Math.max(mx, pg.sort), 0) || 0) + 100000
    }]);
    p?.sheet.render(true);
  },
  editarPagina(app, ev, el) { app._entry()?.pages.get(el.dataset.page)?.sheet.render(true); },
  async apagarPagina(app, ev, el) { await app._entry()?.pages.get(el.dataset.page)?.deleteDialog(); }
};

/** Busca dentro do PDF (usa o leitor de PDF do próprio Foundry). */
function ouvintes(app, root) {
  root.querySelectorAll("[data-pdf]").forEach((barra) => {
    const iframe = barra.nextElementSibling;
    const campo = barra.querySelector("[data-pdf-busca]");
    const contagem = barra.querySelector("[data-pdf-contagem]");
    let ligado = false;
    const pdfApp = () => { try { return iframe.contentWindow?.PDFViewerApplication ?? null; } catch { return null; } };
    const buscar = async (tipo = "", anterior = false) => {
      const pdf = pdfApp();
      if (!pdf) return ui.notifications.warn(T("Janela.OPDFAindaEstaCarregando"));
      await pdf.initializedPromise;
      if (!ligado) {
        ligado = true;
        pdf.eventBus.on("updatefindmatchescount", ({ matchesCount }) => {
          contagem.textContent = matchesCount?.total ? `${matchesCount.current}/${matchesCount.total}` : "0";
        });
        pdf.eventBus.on("updatefindcontrolstate", ({ state, matchesCount }) => {
          if (state === 1) contagem.textContent = "0";
          else if (matchesCount?.total) contagem.textContent = `${matchesCount.current}/${matchesCount.total}`;
        });
      }
      pdf.eventBus.dispatch("find", {
        source: window, type: tipo, query: campo.value, caseSensitive: false, entireWord: false,
        highlightAll: true, findPrevious: anterior, matchDiacritics: false
      });
      if (!campo.value) contagem.textContent = "";
    };
    const adiar = foundry.utils.debounce(() => buscar(""), 300);
    campo.addEventListener("input", adiar);
    campo.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      buscar("again", ev.shiftKey);
    });
    barra.querySelector('[data-pdf-ir="proximo"]').addEventListener("click", () => buscar("again", false));
    barra.querySelector('[data-pdf-ir="anterior"]').addEventListener("click", () => buscar("again", true));
  });
}

/** Selo do cabeçalho e da lista para páginas vindas do Monk's. */
const seloMonks = (a) => NOMES_MEJ[a.tipoBase] ?? a.tipoBase;

export { acoes, botoesAdicionarPagina, cabecalho, contexto, controlesPaginaNativa, descricao, montarEditor, notas, ouvintes, paginaNativa, primeiraImagem, segredos, seloMonks };
