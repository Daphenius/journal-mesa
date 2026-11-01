/* Journal — janela principal do Journal (JournalApp): abas, lista lateral (pastas), busca, cabeçalho comum,
 * barra de baixo, menus de botão direito, drag & drop e os ouvintes comuns.
 * O HTML de cada tipo de página (NPC, loja, missão…) e as ações dele ficam em scripts/paginas/<tipo>.js,
 * registrados em scripts/paginas/index.js; esta janela só despacha por tipo. */
import { T } from "../idioma.js";
import * as Jornal from "../jornal/index.js";
import { Tempo, calApi, calNota } from "./calendario.js";
import { calNormalizar, calProxima, calTextoDia, paginasHistoria } from "./historia.js";
import { Nexus, Sessao } from "./sessao.js";
import { AO_ESCOLHER_DATA, PAGINAS, SOLTAR, acoesDasPaginas, ouvintesDasPaginas } from "../paginas/index.js";
import { cabecalho, contexto, descricao, montarEditor, notas, segredos, seloMonks } from "../paginas/comum.js";
import { secaoCalendario } from "../paginas/calendario.js";
import { secaoConexoes } from "../paginas/conexoes.js";
import { renovarEstoques } from "../paginas/loja.js";
import { Dialogo, FP, LV, MOD, Menu, NOVOS, STATUS, TEMAS, TIPOS, abrirFichaPadrao, abrirImagem, abrirPermissoes, alternarFixado, alternarPastaOculta, analisar, apagarEntrada, avatar, chat, baixarJson, bolinhasDono, corDaPasta, criarBauDoCombate, criarTipo, diaAtual, dicaNota, editarNotaMestre, ehGM, entradaOculta, entradas, esc, estaVisivel, estadoSecao, exportarPasta, fixados, garantirObjeto, importarJson, importarDoMonks, dadosSet, mostrarAosJogadores, mostrarImagem, nomeDoTipoDePagina, nomeTema, notaMestre, pastaMarcadaOculta, pastaOculta, pedir, revelarPara, temModulo, tiposDePagina, visibilidade } from "../nucleo.js";

/* ---------------- janela principal ---------------- */

const { ApplicationV2 } = foundry.applications.api;

function seletorDe(el) {
  for (const a of ["data-campo", "data-nota", "data-novo-rotulo", "data-novo-link"]) {
    if (el.hasAttribute(a)) { const v = el.getAttribute(a); return v ? `[${a}="${CSS.escape(v)}"]` : `[${a}]`; }
  }
  if (el.dataset.objTexto !== undefined) return `[data-obj-texto][data-id="${el.dataset.id}"]`;
  if (el.dataset.itemCampo) return `[data-item-campo="${el.dataset.itemCampo}"][data-id="${el.dataset.id}"]`;
  if (el.closest(".jm-busca")) return ".jm-busca input";
  return null;
}

class JournalApp extends ApplicationV2 {
  abas = [];
  ativa = null;
  editando = false;
  grupo = "todos";
  filtro = "";
  subLoja = "semanal";
  subDeus = "geral";
  filtroLinha = "tudo";
  histDesc = false;
  histAbertos = new Set();
  _rolarLinha = null;
  pastaAlvo = null;
  forcarRaiz = false;
  verOcultas = false;
  editorAtivo = false;
  _ultima = null;

  static DEFAULT_OPTIONS = {
    id: "journal-mesa",
    classes: ["jm-janela"],
    tag: "div",
    window: { title: "Journal da Mesa", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 1060, height: 760 },
    actions: {
      /* lista lateral, abas e barra */
      abrir: JournalApp._abrir,
      fecharAba: JournalApp._fecharAba,
      fecharTodas: JournalApp._fecharTodas,
      fixar: JournalApp._fixar,
      criar: JournalApp._criar,
      grupo: JournalApp._grupo,
      pasta: JournalApp._pasta,
      novaPasta: JournalApp._novaPasta,
      editarPasta: JournalApp._editarPasta,
      limparAlvo: JournalApp._limparAlvo,
      expandir: JournalApp._expandir,
      importar: JournalApp._importar,
      importarMonks: JournalApp._importarMonks,
      novoDia: JournalApp._novoDia,
      voltarDia: JournalApp._voltarDia,
      rastreador: JournalApp._rastreador,
      tema: JournalApp._tema,
      bauCombate: JournalApp._bauCombate,
      abrirEspecial: JournalApp._abrirEspecial,
      sessaoIniciar: JournalApp._sessaoIniciar,
      sessaoEncerrar: JournalApp._sessaoEncerrar,
      verOcultas: JournalApp._verOcultas,
      ocultarPasta: JournalApp._ocultarPasta,
      /* cabeçalho comum de qualquer página */
      editar: JournalApp._editar,
      visivel: JournalApp._visivel,
      mostrar: JournalApp._mostrar,
      fichaNativa: JournalApp._fichaNativa,
      traduzir: JournalApp._traduzir,
      imagem: JournalApp._imagem,
      apagar: JournalApp._apagar,
      revelarSecao: JournalApp._revelarSecao,
      notaMestre: JournalApp._notaMestre,
      /* ações de cada tipo de página (scripts/paginas/<tipo>.js) */
      ...acoesDasPaginas()
    }
  };


  get abertas() { return new Set(game.settings.get(MOD, "pastasAbertas") ?? []); }
  _setAbertas(set) { game.settings.set(MOD, "pastasAbertas", [...set]); }

  _entry() { return game.journal.get(this.ativa); }

  /** Onde nasce a página nova: pasta clicada; senão, a pasta da página aberta; "raiz" se o mestre tirou a pasta. */
  get pastaDestino() {
    if (this.pastaAlvo && game.folders.get(this.pastaAlvo)) return this.pastaAlvo;
    if (this.forcarRaiz) return null;
    return this._entry()?.folder?.id ?? null;
  }

  abrirPagina(id, { editar = false, pagina = null, ancora = null } = {}) {
    const e = game.journal.get(id);
    if (!e) return;
    this._rolarPara = (pagina || ancora) ? { pagina, ancora } : null;
    if (!this.abas.includes(id)) this.abas.push(id);
    if (this.ativa !== id) { this.forcarRaiz = false; this.editando = false; this.subLoja = "semanal"; this.subDeus = "geral"; this.conFiltro = null; this.iconesAbertos = false; }
    this.ativa = id;
    if (editar) this.editando = true;
    const abertas = this.abertas; let mudou = false;
    for (let p = e.folder; p; p = p.folder) if (!abertas.has(p.id)) { abertas.add(p.id); mudou = true; }
    if (mudou) this._setAbertas(abertas);
    this.render({ force: true });
  }

  /* ---------- lateral: árvore de pastas ---------- */

  _arvore(visiveis, ocultas = false) {
    const gm = ehGM();
    const abertas = this.abertas;
    const pastas = game.folders.filter((f) => f.type === "JournalEntry");
    const porPai = new Map();
    for (const f of pastas) {
      const pai = f.folder?.id ?? null;
      if (!porPai.has(pai)) porPai.set(pai, []);
      porPai.get(pai).push(f);
    }
    const porPasta = new Map();
    for (const j of visiveis) {
      const pid = j.folder?.id ?? null;
      if (!porPasta.has(pid)) porPasta.set(pid, []);
      porPasta.get(pid).push(j);
    }
    const ordenar = (lista, modo) => lista.sort((a, b) => (modo === "a"
      ? a.name.localeCompare(b.name, game.i18n.lang)
      : (a.sort - b.sort) || a.name.localeCompare(b.name, game.i18n.lang)));

    const contagem = new Map();
    const conta = (pid) => {
      if (contagem.has(pid)) return contagem.get(pid);
      let n = (porPasta.get(pid) ?? []).length;
      for (const f of porPai.get(pid) ?? []) n += conta(f.id);
      contagem.set(pid, n);
      return n;
    };
    const mostrarTudo = !!this.filtro || this.grupo !== "todos";

    const nivel = (pid, modo) => {
      let html = "";
      const pastasDoNivel = ocultas && pid === null
        ? pastas.filter((f) => pastaMarcadaOculta(f) && !pastaOculta(f.folder))
        : (porPai.get(pid) ?? []).filter((f) => ocultas || !pastaMarcadaOculta(f));
      for (const f of ordenar([...pastasDoNivel], modo)) {
        if (!gm && conta(f.id) === 0) continue;
        const aberta = abertas.has(f.id);
        const cor = corDaPasta(f);
        const estilo = cor ? `style="--jm-pasta-fundo:${cor.fundo};--jm-pasta-texto:${cor.texto}"` : "";
        html += `<div class="jm-pasta ${aberta ? "aberta" : ""} ${cor ? "colorida" : ""}" ${estilo}>
          <div class="jm-pasta-linha ${gm && this.pastaAlvo === f.id ? "alvo" : ""}" data-action="pasta" data-id="${f.id}"
            draggable="${gm}" data-uuid="${f.uuid}" data-drop="pasta" data-pasta="${f.id}">
            <i class="fa-solid ${aberta ? "fa-folder-open" : "fa-folder"}"></i>
            <span class="nome">${esc(f.name)}</span>
            ${gm ? `<span class="jm-pasta-ctrl">
              <a data-action="novaPasta" data-id="${f.id}" data-tooltip="${T("Janela.NovaSubpasta")}"><i class="fa-solid fa-folder-plus"></i></a>
              <a data-action="ocultarPasta" data-id="${f.id}" data-tooltip="${pastaMarcadaOculta(f) ? T("Janela.MostrarPasta") : T("Janela.OcultarPastaVaiParaOcultos")}"><i class="fa-solid ${pastaMarcadaOculta(f) ? "fa-eye" : "fa-eye-slash"}"></i></a>
              <a data-action="editarPasta" data-id="${f.id}" data-tooltip="${T("Janela.ConfigurarPasta")}"><i class="fa-solid fa-gear"></i></a>
            </span>` : ""}
          </div>
          <div class="jm-pasta-filhos">${aberta || mostrarTudo ? nivel(f.id, f.sorting) : ""}</div>
        </div>`;
      }
      if (!(ocultas && pid === null)) for (const j of ordenar([...(porPasta.get(pid) ?? [])], modo)) html += this._itemLista(j);
      return html;
    };
    return nivel(null, "m");
  }

  _itemLista(j) {
    const a = analisar(j);
    const t = TIPOS[a.tipo];
    let sub = a.tipo === "outro" ? seloMonks(a) : t.rotulo;
    if (a.tipo === "person" && a.m.role) sub = a.m.role;
    if (a.tipo === "quest") sub = STATUS[a.m.status]?.rotulo ?? sub;
    if (a.tipo === "shop" && a.x.dono && game.journal.get(a.x.dono)) sub = game.journal.get(a.x.dono).name;
    if (a.tipo === "deus" && a.x.deus.dominios) sub = a.x.deus.dominios;
    if (a.tipo === "diario") sub = j.pages.size === 1 ? nomeDoTipoDePagina(a.pages[0].type) : `${j.pages.size} ${T("Janela.Paginas")}`;
    if (a.tipo === "historia") { const n = paginasHistoria(j).length; sub = n === 1 ? T("Janela.N1Acontecimento") : `${n} ${T("Janela.Acontecimentos")}`; }
    if (a.tipo === "jornal") { const n = Jornal.edicoes(j).filter(({ ed }) => Jornal.publicaEstado(ed.estado)).length; sub = n === 1 ? T("Janela.N1Edicao") : `${n} ${T("Janela.Edicoes")}`; }
    const nCal = calNota(j);
    if (nCal && calApi() && ["diario", "journalentry"].includes(a.tipo)) {
      const rep = (calNormalizar(nCal)?.repetir ?? "nao") !== "nao";
      const prox = rep ? calProxima(j) : null;
      sub = `📅 ${prox != null ? `${T("Janela.Proxima")}: ${Tempo.texto(prox)}` : calTextoDia(nCal.td)}`;
    }
    const P = PAGINAS[a.tipo];
    const img = P.imagemCabecalho ? P.imagemCabecalho({ entry: j, a }) : a.page?.src ?? null;
    const vis = ehGM() ? visibilidade(j) : "todos";
    const oculto = !ehGM() ? "" : (vis === "ninguem"
      ? `<i class="fa-solid fa-eye-slash jm-oculto" data-tooltip="${T("Janela.OcultoDosJogadores")}"></i>`
      : (game.settings.get(MOD, "donos") ? bolinhasDono(j) : ""));
    const nota = notaMestre(j);
    return `<div class="jm-item ${j.id === this.ativa ? "ativo" : ""} ${nota ? "tem-nota" : ""}" data-action="abrir" data-id="${j.id}" draggable="true"
      ${nota ? `data-tooltip="<b>${esc(j.name)}</b><br>${dicaNota(nota)}" data-tooltip-direction="RIGHT"` : ""}
      data-uuid="${j.uuid}" data-tipo="${a.tipo}" data-busca="${esc((j.name + " " + sub).toLowerCase())}"
      data-drop="pasta" data-pasta="${j.folder?.id ?? ""}">
      ${avatar(img, a.tipo, "mini")}
      <div class="jm-item-txt"><b>${esc(j.name)}${nota ? ` <i class="fa-solid fa-note-sticky jm-nota-ico"></i>` : ""}</b><small>${esc(sub)}</small></div>${oculto}</div>`;
  }

  /* ---------- montagem do HTML ---------- */

  async _renderHTML() {
    const visiveis = entradas();
    const ids = new Set(visiveis.map((j) => j.id));
    this.abas = this.abas.filter((id) => ids.has(id) || (id === "__linha") || (id === "__regras") || (id === "__jornais") || (id === "__nexus" && Nexus.ligado() && (ehGM() || Nexus.jogadoresVeem())));
    // páginas fixadas: sempre abertas, nas primeiras abas
    const fix = [...fixados()].filter((id) => ids.has(id));
    this.abas = [...fix, ...this.abas.filter((id) => !fix.includes(id))];
    if (!this.abas.includes(this.ativa)) this.ativa = this.abas.at(-1) ?? null;
    if (!ehGM() && this.subLoja === "config") this.subLoja = "semanal";
    if (this.pastaAlvo && !game.folders.get(this.pastaAlvo)) this.pastaAlvo = null;
    const gm = ehGM();

    const pastasOcultas = game.folders.filter((f) => f.type === "JournalEntry" && pastaMarcadaOculta(f));
    if (!pastasOcultas.length || !gm) this.verOcultas = false;
    const naLista = visiveis.filter((j) => entradaOculta(j) === !!this.verOcultas);

    const contagem = {};
    for (const j of naLista) { const t = analisar(j).tipo; contagem[t] = (contagem[t] ?? 0) + 1; }
    const chips = [["todos", T("Janela.Tudo"), "fa-solid fa-layer-group", naLista.length],
      ...Object.entries(TIPOS).filter(([k]) => contagem[k]).map(([k, t]) => [k, t.plural, t.icone, contagem[k]])]
      .map(([k, r, i, n]) => `<button type="button" class="jm-chip ${this.grupo === k ? "ativo" : ""}" data-action="grupo" data-grupo="${k}" data-tooltip="${r}"><i class="${i}"></i><span>${n}</span></button>`).join("");

    const alvo = this.pastaDestino ? game.folders.get(this.pastaDestino) : null;
    const temRegra = tiposDePagina().includes("rule");
    const botoesNovos = NOVOS.filter(([k]) => (k !== "regra" || temRegra) && (k !== "evento" || calApi())).map(([k, r, i]) => {
      const rot = r ?? TIPOS[k].rotulo; const ic = i ?? TIPOS[k].icone;
      return `<button type="button" data-action="criar" data-tipo="${k}" data-tooltip="${T("Janela.NovoA")} ${rot}"><i class="${ic}"></i></button>`;
    }).join("");
    const criar = gm ? `<div class="jm-criar">
      <div class="jm-criar-topo"><span>${T("Janela.NovaPagina")} ${alvo ? `${T("Comum.Em")} <b>${esc(alvo.name)}</b>${this.pastaAlvo ? "" : ` <small class="jm-da-aberta">(${T("Janela.PastaDaPaginaAberta")})</small>`} <a data-action="limparAlvo" data-tooltip="${T("Janela.CriarNaRaiz")}"><i class="fa-solid fa-xmark"></i></a>` : `<em>${T("Comum.NaRaiz")}</em>`}
        <small class="jm-posicao-nova" data-tooltip="${T("Janela.MudeNasConfiguracoesDoModulo")}">${game.settings.get(MOD, "posicaoNova") === "inicio" ? T("Janela.NoInicio") : T("Janela.NoFim")}</small></span>
        <a data-action="novaPasta" data-tooltip="${T("Janela.NovaPasta")}"><i class="fa-solid fa-folder-plus"></i></a>
        <a data-action="importar" data-tooltip="${T("Janela.ImportarJSON")}"><i class="fa-solid fa-file-import"></i></a>
        ${temModulo("monks-enhanced-journal") || game.journal.some((j) => j.pages.some((pg) => pg.flags?.["monks-enhanced-journal"]?.type)) ? `<a data-action="importarMonks" data-tooltip="${T("Janela.ImportarDoMonkSEnhanced")}"><i class="fa-solid fa-puzzle-piece"></i></a>` : ""}</div>
      <div class="jm-criar-btns">${botoesNovos}</div>
    </div>` : "";

    const rodape = `<div class="jm-rodape">
      ${gm && pastasOcultas.length ? `<button type="button" class="jm-ocultos ${this.verOcultas ? "ativo" : ""}" data-action="verOcultas" data-tooltip="${this.verOcultas ? T("Janela.VoltarParaAListaNormal") : T("Janela.VerAsPastasOcultas")}">
        <i class="fa-solid ${this.verOcultas ? "fa-arrow-left" : "fa-eye-slash"}"></i> ${this.verOcultas ? T("Janela.Voltar") : `${T("Janela.Ocultos")} <small>${pastasOcultas.length}</small>`}</button>` : `<span class="jm-rodape-espaco"></span>`}
      ${gm && game.combat ? `<button type="button" data-action="bauCombate" data-tooltip="${T("Janela.GerarBauComOSaque")}"><i class="fa-solid fa-box-open"></i></button>` : ""}
      <button type="button" data-action="abrirEspecial" data-id="__linha" class="${this.ativa === "__linha" ? "ativo" : ""}" data-tooltip="${T("Janela.LinhaDoTempo")}"><i class="fa-solid fa-timeline"></i></button>
      <button type="button" data-action="abrirEspecial" data-id="__jornais" class="${this.ativa === "__jornais" ? "ativo" : ""}" data-tooltip="${esc(Jornal.t("Jornal.Titulo"))}"><i class="fa-solid fa-newspaper"></i></button>
      <button type="button" data-action="abrirEspecial" data-id="__regras" class="${this.ativa === "__regras" ? "ativo" : ""}" data-tooltip="${T("Janela.RegrasDaMesaSessao0")}"><i class="fa-solid fa-handshake"></i></button>
      ${Nexus.ligado() && (gm || Nexus.jogadoresVeem()) ? `<button type="button" data-action="abrirEspecial" data-id="__nexus" class="${this.ativa === "__nexus" ? "ativo" : ""}" data-tooltip="${T("Comum.Nexus")}"><i class="fa-solid fa-gauge-high"></i></button>` : ""}
      ${gm ? (Sessao.ativa()
        ? `<button type="button" class="jm-sessao gravando" data-action="sessaoEncerrar" data-tooltip="${T("Comum.Sessao")} ${Sessao.atual().n} ${T("Janela.EmAndamentoCliqueParaEncerrar")}"><i class="fa-solid fa-circle-stop"></i></button>`
        : `<button type="button" class="jm-sessao" data-action="sessaoIniciar" data-tooltip="${T("Janela.IniciarODiarioDaSessao")}"><i class="fa-solid fa-book-bookmark"></i></button>`) : ""}
      <button type="button" data-action="expandir" data-tooltip="${T("Janela.RecolherTodasAsPastas")}"><i class="fa-solid fa-angles-up"></i></button>
      <button type="button" data-action="rastreador" class="${game.settings.get(MOD, "rastreador") ? "ativo" : ""}" data-tooltip="${T("Janela.RastreadorDeMissoesNaTela")}"><i class="fa-solid fa-list-check"></i></button>
      <button type="button" data-action="tema" data-tooltip="${esc(Jornal.t("Tema.Trocar", { tema: nomeTema(game.settings.get(MOD, "tema")) }))}"><i class="fa-solid fa-palette"></i></button>
    </div>`;

    const ESPECIAIS = { __linha: [T("Janela.LinhaDoTempo"), "fa-solid fa-timeline"], __jornais: [esc(Jornal.t("Jornal.Titulo")), "fa-solid fa-newspaper"], __nexus: [T("Comum.Nexus"), "fa-solid fa-gauge-high"], __regras: [T("Comum.RegrasDaMesa"), "fa-solid fa-handshake"] };
    const abas = this.abas.map((id) => {
      if (ESPECIAIS[id]) return `<div class="jm-aba especial ${id === this.ativa ? "ativa" : ""}" data-action="abrirEspecial" data-id="${id}">
        <i class="${ESPECIAIS[id][1]}"></i><span>${ESPECIAIS[id][0]}</span>
        <a class="jm-aba-x" data-action="fecharAba" data-id="${id}"><i class="fa-solid fa-xmark"></i></a></div>`;
      const j = game.journal.get(id); const a = analisar(j); const t = TIPOS[a.tipo];
      const fixa = fix.includes(id);
      return `<div class="jm-aba ${id === this.ativa ? "ativa" : ""} ${fixa ? "fixa" : ""}" data-action="abrir" data-id="${id}">
        <i class="${fixa ? "fa-solid fa-thumbtack" : t.icone}"></i><span>${esc(j.name)}</span>
        ${fixa ? "" : `<a class="jm-aba-x" data-action="fecharAba" data-id="${id}"><i class="fa-solid fa-xmark"></i></a>`}</div>`;
    }).join("");
    const fecharTodas = this.abas.length - fix.length > 1
      ? `<a class="jm-fechar-todas" data-action="fecharTodas" data-tooltip="${T("Janela.FechaAsAbasNaoApaga")}"><i class="fa-solid fa-xmark"></i> ${T("Janela.FecharTodas")}</a>` : "";

    /* abas especiais (__linha, __nexus, __regras) têm painel próprio em scripts/paginas; __jornais vem do Jornal */
    const especial = this.ativa?.startsWith("__") ? PAGINAS[this.ativa] : null;
    const corpo = this.ativa === "__jornais" ? await Jornal.painelJornais(this)
      : especial ? await especial.html(null, this, { visiveis })
      : this.ativa ? await this._pagina(this._entry(), visiveis) : this._boasVindas();

    return `<div class="jm-raiz">
      <aside class="jm-lateral">
        <div class="jm-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="${T("Janela.Buscar")}" value="${esc(this.filtro)}"></div>
        <div class="jm-chips">${chips}</div>
        ${this.verOcultas ? `<div class="jm-ocultos-titulo"><i class="fa-solid fa-eye-slash"></i> ${T("Janela.PastasOcultas")} <small>${T("Janela.NaoAparecemNoJournalDa")}</small></div>` : ""}
        ${!this.verOcultas && fix.length ? `<div class="jm-fixados"><div class="jm-fixados-titulo"><i class="fa-solid fa-thumbtack"></i> ${T("Janela.Fixados")}</div>${fix.map((id) => this._itemLista(game.journal.get(id))).join("")}</div>` : ""}
        <div class="jm-lista ${this.verOcultas ? "ocultas" : ""}" data-drop="pasta" data-pasta="">${this._arvore(naLista, !!this.verOcultas) || `<p class="jm-vazio">${T("Janela.NadaPorAquiAinda")}</p>`}</div>
        ${criar}
        ${rodape}
      </aside>
      <section class="jm-principal">
        <nav class="jm-abas"><div class="jm-abas-lista">${abas || `<span class="jm-abas-vazio">${T("Janela.AbraUmaPaginaNaLista")}</span>`}</div>${fecharTodas}</nav>
        <div class="jm-conteudo">${corpo}</div>
        <div class="jm-dia-canto">
          <span data-tooltip="${T("Janela.DiaDoMundoAsOfertas")}"><i class="fa-solid fa-sun"></i> ${T("Comum.Dia2")} ${diaAtual()}</span>
          ${gm ? `<a data-action="voltarDia" data-tooltip="${T("Janela.VoltarUmDia")}"><i class="fa-solid fa-backward"></i></a><a data-action="novoDia" data-tooltip="${T("Janela.AvancarODia")}"><i class="fa-solid fa-forward"></i></a>` : ""}
        </div>
      </section>
    </div>`;
  }

  _boasVindas() {
    return `<div class="jm-boas-vindas">
      <i class="fa-solid fa-book-open"></i>
      <h2>${T("Comum.JournalDaMesa")}</h2>
      <p>${ehGM()
        ? `${T("Janela.TudoAquiEDiarioNativo")} <b>${T("Janela.BotaoDireito")}</b> ${T("Janela.ParaConfigurarPaginasEPastas")}`
        : T("Janela.EscolhaUmaPaginaNaLista")}</p>
    </div>`;
  }

  /* ---------- página aberta ---------- */

  /** Monta a página pelo módulo do tipo dela (scripts/paginas/<tipo>.js). Cabeçalho, descrição, conexões,
   *  segredos e notas são comuns; o que é do tipo vem de P.html(). Diários, História e Jornal (P.completa)
   *  montam tudo depois do cabeçalho por conta própria. */
  async _pagina(entry, visiveis) {
    const tipo = analisar(entry).tipo;
    const P = PAGINAS[tipo];
    const ctx = contexto(this, entry, visiveis, P);
    const blocos = [cabecalho(ctx)];
    if (P.completa) {
      blocos.push(await P.html(entry, this, ctx));
      return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
    }
    /* data no calendário (qualquer tipo de página) */
    blocos.push(await secaoCalendario(ctx));
    if (P.antes) blocos.push(await P.antes(entry, this, ctx));
    blocos.push(await descricao(ctx));
    blocos.push(await P.html(entry, this, ctx));
    blocos.push(secaoConexoes(ctx));
    blocos.push(await segredos(ctx));
    /* matérias de jornal ligadas a esta página */
    blocos.push(Jornal.secaoRelacionadas(entry, ctx.secao));
    blocos.push(ctx.avisoEscondidas());
    blocos.push(notas(ctx.page, ctx.secao));
    return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
  }

  /* ---------- troca de HTML e ouvintes ---------- */

  async close(options) {
    this._descarregarEditor?.();
    return super.close(options);
  }

  _replaceHTML(html, content) {
    // texto da descrição ainda não gravado vai para o servidor antes de o editor ser trocado
    this._descarregarEditor?.();
    this._descarregarEditor = null;
    const mesma = this._ultima === this.ativa;
    const rolagem = content.querySelector(".jm-conteudo")?.scrollTop ?? 0;
    const rolLista = content.querySelector(".jm-lista")?.scrollTop ?? 0;
    const foco = content.contains(document.activeElement) ? document.activeElement : null;
    const sel = foco ? seletorDe(foco) : null;
    const valorFoco = foco?.value;
    let cursor = null;
    try { cursor = foco?.selectionStart; } catch { /* ignora */ }

    // rascunhos das Regras da Mesa (outra pessoa votar redesenha a janela)
    const rascunhos = [...content.querySelectorAll("[data-regra-nova], [data-regra-coment]")].map((el) => ({
      sel: el.dataset.regraNova ? `[data-regra-nova="${el.dataset.regraNova}"]` : `[data-regra-id="${el.closest("[data-regra-id]")?.dataset.regraId}"] [data-regra-coment]`,
      valor: el.type === "checkbox" ? el.checked : el.value
    })).filter((r) => r.valor);
    content.innerHTML = html;
    for (const r of rascunhos) { const el = content.querySelector(r.sel); if (el) { if (el.type === "checkbox") el.checked = r.valor; else el.value = r.valor; } }
    this.element.dataset.tema = game.settings.get(MOD, "tema");
    const c = content.querySelector(".jm-conteudo");
    if (c && mesma) c.scrollTop = rolagem;
    const l = content.querySelector(".jm-lista");
    if (l) l.scrollTop = rolLista;
    this._ultima = this.ativa;

    if (sel && mesma) {
      const alvo = content.querySelector(sel);
      if (alvo) {
        if (valorFoco !== undefined && alvo.value !== valorFoco) alvo.value = valorFoco;
        alvo.focus();
        try { if (cursor != null) alvo.setSelectionRange(cursor, cursor); } catch { /* ignora */ }
      }
    }
    this._marcarAncoras(content);
    if (this._rolarPara) { const alvoRolagem = this._rolarPara; this._rolarPara = null; this._rolar(alvoRolagem); }
    if (this._rolarLinha != null && this.ativa === "__linha") {
      const alvoTd = Number(this._rolarLinha);
      let alvoDia = content.querySelector(`[data-lt-td="${alvoTd}"]`);
      // dia sem nada: o dia mais próximo que aparece na linha
      if (!alvoDia) {
        let melhor = Infinity;
        for (const el of content.querySelectorAll("[data-lt-td]")) { const d = Math.abs(Number(el.dataset.ltTd) - alvoTd); if (d < melhor) { melhor = d; alvoDia = el; } }
      }
      this._rolarLinha = null;
      if (alvoDia) {
        alvoDia.scrollIntoView({ block: "center", behavior: "smooth" });
        alvoDia.classList.add("jm-destaque-link");
        setTimeout(() => alvoDia.classList.remove("jm-destaque-link"), 1600);
      }
    }
    this._ouvintes(content);
  }

  /** Dá a cada título do texto a mesma âncora que o Foundry usa (para links do tipo Página#titulo). */
  _marcarAncoras(root) {
    const Classe = CONFIG.JournalEntryPage?.documentClass ?? globalThis.JournalEntryPage;
    const slug = (t) => Classe?.slugifyHeading?.(t) ?? String(t).slugify?.({ strict: true }) ?? String(t).toLowerCase().replace(/\s+/g, "-");
    root.querySelectorAll(".jm-texto :is(h1, h2, h3, h4, h5, h6)").forEach((h) => {
      if (!h.dataset.anchor) h.dataset.anchor = slug(h.textContent.trim());
    });
  }

  _rolar({ pagina, ancora }) {
    const raiz = this.element?.querySelector(".jm-conteudo");
    if (!raiz) return;
    const escopo = (pagina && raiz.querySelector(`[data-page-id="${pagina}"]`)) || raiz;
    const alvo = (ancora && (escopo.querySelector(`[data-anchor="${CSS.escape(ancora)}"]`) ?? escopo.querySelector(`#${CSS.escape(ancora)}`)))
      || (pagina ? escopo : null);
    if (!alvo) return;
    alvo.scrollIntoView({ block: "start", behavior: "smooth" });
    alvo.classList.add("jm-destaque-link");
    setTimeout(() => alvo.classList.remove("jm-destaque-link"), 1600);
  }

  _filtrarLista(root) {
    const q = this.filtro.trim().toLowerCase();
    const grupo = this.grupo;
    const filtrando = !!q || grupo !== "todos";
    root.querySelectorAll(".jm-item").forEach((i) => {
      i.hidden = (!!q && !i.dataset.busca.includes(q)) || (grupo !== "todos" && i.dataset.tipo !== grupo);
    });
    for (const p of [...root.querySelectorAll(".jm-pasta")].reverse()) {
      p.classList.toggle("filtrando", filtrando);
      p.hidden = filtrando && !p.querySelector(".jm-item:not([hidden])");
    }
  }

  _ouvintes(root) {
    root.querySelectorAll("[data-campo]").forEach((el) => el.addEventListener("change", () => this._salvarCampo(el)));

    const editor = root.querySelector("[data-editor]");
    if (editor) montarEditor(this, editor);
    else this.editorAtivo = false;

    root.querySelector("[data-nota]")?.addEventListener("change", (ev) => {
      const a = analisar(this._entry());
      const page = a.page ?? a.pages[0];
      if (!page) return;
      const texto = ev.target.value;
      if (page.isOwner) dadosSet(page, `notas.${game.user.id}`, texto);
      else pedir("nota", { pageUuid: page.uuid, userId: game.user.id, texto });
    });

    const busca = root.querySelector(".jm-busca input");
    busca?.addEventListener("input", () => {
      const antes = !!this.filtro;
      this.filtro = busca.value;
      if (antes !== !!this.filtro) return this.render();
      this._filtrarLista(root);
    });
    this._filtrarLista(root);

    /* seletores de data: dia/mês/ano → td, entregue para quem usa (calendário, prazo, acontecimento, dia sagrado) */
    root.querySelectorAll("[data-data]").forEach((caixa) => caixa.querySelectorAll("[data-parte]").forEach((el) => el.addEventListener("change", () => {
      const val = (k) => Number(caixa.querySelector(`[data-parte="${k}"]`)?.value);
      const td = Tempo.tdDe(val("ano"), val("mes"), val("dia"));
      if (td == null) return ui.notifications.warn(T("Comum.EssaDataNaoExisteNeste"));
      AO_ESCOLHER_DATA[caixa.dataset.data]?.(this, td, caixa);
    })));

    root.querySelectorAll("[draggable=true][data-uuid]").forEach((el) => el.addEventListener("dragstart", (ev) => {
      ev.stopPropagation();
      const tipo = el.classList.contains("jm-pasta-linha") ? "Folder" : "JournalEntry";
      ev.dataTransfer.setData("text/plain", JSON.stringify({ type: tipo, uuid: el.dataset.uuid }));
    }));

    const limparMarcas = (el) => el.classList.remove("sobre", "sobre-antes", "sobre-depois");
    root.querySelectorAll("[data-drop]").forEach((el) => {
      el.addEventListener("dragover", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        limparMarcas(el);
        const pos = el.dataset.drop === "pasta" ? posicaoSoltar(el, ev) : "dentro";
        el.classList.add(pos === "dentro" ? "sobre" : `sobre-${pos}`);
      });
      el.addEventListener("dragleave", () => limparMarcas(el));
      el.addEventListener("drop", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const pos = el.dataset.drop === "pasta" ? posicaoSoltar(el, ev) : "dentro";
        limparMarcas(el);
        this._soltar(el.dataset.drop, ev, el, pos);
      });
    });

    /* clicar em qualquer lugar do Journal (fora das pastas e dos botões de criar) desmarca a pasta */
    if (!root.dataset.jmDesmarca) root.dataset.jmDesmarca = "1", root.addEventListener("click", (ev) => {
      if (!this.pastaAlvo || ev.target.closest(".jm-pasta-linha, .jm-criar")) return;
      this.pastaAlvo = null;
      if (!ev.target.closest("[data-action]")) this.render();
      else root.querySelectorAll(".jm-pasta-linha.alvo").forEach((x2) => x2.classList.remove("alvo"));
    }, true);

    /* bolinhas de permissão: clique abre "quem vê" */
    root.querySelectorAll(".jm-donos").forEach((el) => el.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const doc = await fromUuid(el.dataset.uuid);
      if (doc) revelarPara(doc);
    }));

    /* botão direito em imagens: mostrar aos jogadores */
    root.querySelectorAll(".jm-conteudo img, .jm-conteudo .jm-av-icone").forEach((img) => img.addEventListener("contextmenu", (ev) => this._menuImagem(ev, img)));

    /* botão direito */
    root.querySelectorAll(".jm-item, .jm-aba").forEach((el) => el.addEventListener("contextmenu", (ev) => this._menuEntrada(ev, el.dataset.id)));
    root.querySelectorAll(".jm-pasta-linha").forEach((el) => el.addEventListener("contextmenu", (ev) => this._menuPasta(ev, el.dataset.id)));

    /* ouvintes de cada tipo de página e dos painéis (scripts/paginas) */
    ouvintesDasPaginas(this, root);
  }


  /* ---------- menus de botão direito ---------- */

  _menuEntrada(ev, id) {
    const e = game.journal.get(id);
    if (!e) return;
    const gm = ehGM();
    const a = analisar(e);
    const visivel = estaVisivel(e);
    Menu.abrir(ev, [
      { icone: "fa-solid fa-book-open", rotulo: T("Janela.Abrir"), acao: () => this.abrirPagina(id) },
      { icone: "fa-solid fa-thumbtack", rotulo: fixados().has(id) ? T("Janela.Desafixar") : T("Janela.Fixar"), acao: () => JournalApp._fixar.call(this, null, { dataset: { id } }) },
      this.abas.includes(id) && !fixados().has(id) && { icone: "fa-solid fa-xmark", rotulo: T("Janela.FecharAba"), acao: () => JournalApp._fecharAba.call(this, { stopPropagation() {} }, { dataset: { id } }) },
      gm && !["diario", "historia"].includes(a.tipo) && { icone: "fa-solid fa-pen", rotulo: T("Janela.Editar"), acao: () => this.abrirPagina(id, { editar: true }) },
      gm && { icone: "fa-solid fa-i-cursor", rotulo: T("Janela.Renomear"), acao: () => this._renomear(e) },
      gm && { icone: "fa-solid fa-note-sticky", rotulo: T("Janela.NotaDoMestre"), acao: () => editarNotaMestre(e) },
      gm && "-",
      gm && { icone: "fa-solid fa-user-check", rotulo: T("Janela.QuemVePorJogador"), acao: () => revelarPara(e) },
      gm && { icone: `fa-solid ${visivel ? "fa-eye-slash" : "fa-eye"}`, rotulo: visivel ? T("Janela.OcultarDeTodos") : T("Janela.MostrarATodos"), acao: () => e.update({ "ownership.default": visivel ? LV().NONE : LV().OBSERVER }) },
      gm && { icone: "fa-solid fa-bullhorn", rotulo: T("Janela.AbrirNaTelaDosJogadores"), acao: () => mostrarAosJogadores(e) },
      gm && { icone: "fa-solid fa-lock", rotulo: T("Janela.Permissoes"), acao: () => abrirPermissoes(e) },
      gm && "-",
      gm && { icone: "fa-solid fa-copy", rotulo: T("Janela.Duplicar"), acao: () => e.clone({ name: `${e.name} (${T("Janela.Copia")})` }, { save: true }) },
      gm && { icone: "fa-solid fa-file-export", rotulo: T("Janela.ExportarJSON"), acao: () => baixarJson(e.toObject(), e.name) },
      gm && { icone: "fa-solid fa-up-right-from-square", rotulo: T("Janela.AbrirNaFichaPadrao"), acao: () => abrirFichaPadrao(e) },
      gm && "-",
      gm && { icone: "fa-solid fa-trash", rotulo: T("Comum.Apagar"), perigo: true, acao: () => apagarEntrada(e) }
    ]);
  }

  _menuImagem(ev, img) {
    const src = img.getAttribute("src");
    if (!src) return;
    const e = this._entry();
    const linha = img.closest(".jm-produto, .jm-premio-card, .jm-oferta, .jm-ator, .jm-magia, .jm-ref");
    const nome = linha?.querySelector(".nome, b")?.childNodes[0]?.textContent?.trim() || linha?.textContent?.trim() || e?.name || "";
    const jogadores = game.users.filter((u) => !u.isGM && u.active);
    Menu.abrir(ev, [
      { icone: "fa-solid fa-magnifying-glass-plus", rotulo: T("Janela.AmpliarSoParaMim"), acao: () => abrirImagem(src, nome) },
      ehGM() && "-",
      ehGM() && { icone: "fa-solid fa-image", rotulo: T("Janela.MostrarSoAImagemSem"), acao: () => mostrarImagem(src, "") },
      ehGM() && { icone: "fa-solid fa-id-card", rotulo: `${T("Janela.MostrarImagemENome")} (${nome})`, acao: () => mostrarImagem(src, nome) },
      ...(ehGM() && jogadores.length ? ["-", ...jogadores.map((u) => ({
        icone: "fa-solid fa-user", rotulo: `${T("Janela.SoAImagemPara")} ${u.name}`, acao: () => mostrarImagem(src, "", [u.id])
      }))] : [])
    ]);
  }

  _menuPasta(ev, id) {
    if (!ehGM()) return;
    const f = game.folders.get(id);
    if (!f) return;
    Menu.abrir(ev, [
      { icone: "fa-solid fa-crosshairs", rotulo: T("Janela.CriarNovasPaginasAqui"), acao: () => { this.pastaAlvo = id; this.render(); } },
      { icone: "fa-solid fa-folder-plus", rotulo: T("Janela.NovaSubpasta"), acao: () => this._criarPasta(id) },
      { icone: "fa-solid fa-i-cursor", rotulo: T("Janela.Renomear"), acao: () => this._renomear(f) },
      { icone: "fa-solid fa-gear", rotulo: T("Janela.ConfigurarNomeCorOrdem"), acao: () => f.sheet.render(true) },
      { icone: `fa-solid ${pastaMarcadaOculta(f) ? "fa-eye" : "fa-eye-slash"}`, rotulo: pastaMarcadaOculta(f) ? T("Janela.MostrarPasta") : T("Janela.OcultarPasta"), acao: () => alternarPastaOculta(f) },
      "-",
      { icone: "fa-solid fa-file-export", rotulo: T("Janela.ExportarPastaJSON"), acao: () => exportarPasta(f) },
      { icone: "fa-solid fa-file-import", rotulo: T("Janela.ImportarJSONAqui"), acao: () => importarJson(id) },
      "-",
      { icone: "fa-solid fa-trash", rotulo: T("Janela.ApagarPasta"), perigo: true, acao: () => f.deleteDialog() }
    ]);
  }

  async _renomear(doc) {
    const nome = await Dialogo().prompt({
      window: { title: T("Janela.Renomear") },
      content: `<input type="text" name="nome" value="${esc(doc.name)}" autofocus style="width:100%">`,
      ok: { label: T("Comum.Salvar"), callback: (ev, botao) => botao.form.elements.nome.value }
    }).catch(() => null);
    if (!nome?.trim()) return;
    await doc.update({ name: nome.trim() });
    if (doc.documentName === "JournalEntry") {
      const { page } = analisar(doc);
      if (page) await page.update({ name: nome.trim() });
    }
  }

  async _criarPasta(pai) {
    const f = await Folder.implementation.createDialog({ type: "JournalEntry", folder: pai ?? null });
    if (f) { this.pastaAlvo = f.id; if (pai) { const ab = this.abertas; ab.add(pai); this._setAbertas(ab); } }
  }

  async _salvarCampo(el) {
    const e = this._entry(); if (!e) return;
    const { page, tipo } = analisar(e);
    const campo = el.dataset.campo;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.dataset.num !== undefined) v = Number(v) || 0;
    if (campo === "__nome") {
      const nome = String(v).trim() || T("Janela.SemNome");
      await e.update({ name: nome });
      if (page) await page.update({ name: nome });
      return;
    }
    if (!page) return;
    const [escopo, chave] = campo.split(":");
    const P = PAGINAS[tipo];
    if (escopo === "m") {
      const raiz = chave.split(".")[0];
      if (["rewards", "items", "objectives", "relationships"].includes(raiz)) await garantirObjeto(page, raiz);
      if (P?.aoSalvarCampo) await P.aoSalvarCampo(this, e, page, escopo, chave, v);
      return dadosSet(page, chave, v);
    }
    await page.setFlag(MOD, chave, v);
    if (P?.aoSalvarCampo) await P.aoSalvarCampo(this, e, page, escopo, chave, v);
  }

  async _soltar(tipo, ev, el, pos = "dentro") {
    let data;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    const doc = data?.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
    if (!doc) return;

    if (tipo === "pasta") {
      if (pos === "dentro") return this._moverParaPasta(doc, el.dataset.pasta || null);
      return this._ordenar(doc, el, pos);
    }
    if (!ehGM()) return;

    const e = this._entry(); if (!e) return;
    const { page } = analisar(e);
    if (!page) return;
    /* o resto (ficha, conexão, dia sagrado, relíquia, recompensa, item) é de cada tipo de página */
    return SOLTAR[tipo]?.(this, doc, e, page, el);
  }


  /** Coloca um diário ou pasta antes/depois de outro (ordem manual). */
  async _ordenar(doc, el, pos) {
    if (!ehGM()) return;
    const alvo = el.classList.contains("jm-pasta-linha") ? game.folders.get(el.dataset.id) : game.journal.get(el.dataset.id);
    if (!alvo || alvo === doc) return;
    const pai = alvo.folder?.id ?? null;
    if (doc.documentName !== alvo.documentName) return this._moverParaPasta(doc, pai);
    if (doc.documentName === "Folder") {
      if (doc.type !== "JournalEntry") return;
      for (let p = pai ? game.folders.get(pai) : null; p; p = p.folder) if (p.id === doc.id) return ui.notifications.warn(T("Janela.NaoDaParaColocarUma"));
    }
    const irmaos = doc.documentName === "Folder"
      ? game.folders.filter((f) => f.type === "JournalEntry" && (f.folder?.id ?? null) === pai && f.id !== doc.id)
      : game.journal.filter((j) => (j.folder?.id ?? null) === pai && j.id !== doc.id);
    try {
      await doc.sortRelative({ target: alvo, siblings: irmaos, sortBefore: pos === "antes", updateData: { folder: pai } });
      const pastaPai = pai ? game.folders.get(pai) : null;
      if (pastaPai && pastaPai.sorting === "a") {
        await pastaPai.update({ sorting: "m" });
        ui.notifications.info(`"${pastaPai.name}" ${T("Janela.PassouParaOrdemManual")}`);
      }
    } catch (err) {
      ui.notifications.error(err.message ?? String(err));
    }
  }

  async _moverParaPasta(doc, pastaId) {
    if (!ehGM() && !doc.isOwner) return;
    const alvo = pastaId ? game.folders.get(pastaId) : null;
    try {
      if (doc.documentName === "JournalEntry") {
        if ((doc.folder?.id ?? null) === pastaId) return;
        await doc.update({ folder: pastaId });
      } else if (doc.documentName === "Folder" && doc.type === "JournalEntry") {
        if (doc.id === pastaId || (doc.folder?.id ?? null) === pastaId) return;
        for (let p = alvo; p; p = p.folder) if (p.id === doc.id) return ui.notifications.warn(T("Janela.NaoDaParaColocarUma"));
        await doc.update({ folder: pastaId });
      } else return;
      if (pastaId) { const ab = this.abertas; ab.add(pastaId); this._setAbertas(ab); }
    } catch (err) {
      ui.notifications.error(err.message ?? String(err));
    }
  }

  /* ---------- ações comuns (this = janela) ---------- */

  static _abrir(ev, el) { this.abrirPagina(el.dataset.id, { pagina: el.dataset.pagina || null }); }

  static _fecharAba(ev, el) {
    ev.stopPropagation();
    if (fixados().has(el.dataset.id)) return ui.notifications.info(T("Janela.PaginaFixadaDesafixeParaFechar"));
    this.abas = this.abas.filter((i) => i !== el.dataset.id);
    if (this.ativa === el.dataset.id) { this.ativa = this.abas.at(-1) ?? null; this.editando = false; }
    this.render();
  }

  static _fecharTodas() {
    const fix = fixados();
    this.abas = this.abas.filter((id) => fix.has(id));
    if (!this.abas.includes(this.ativa)) { this.ativa = this.abas.at(-1) ?? null; this.editando = false; }
    this.render();
  }

  static async _fixar(ev, el) {
    const id = el?.dataset?.id ?? this.ativa;
    if (!id || !game.journal.get(id)) return;
    const agora = await alternarFixado(id);
    ui.notifications.info(`"${game.journal.get(id).name}" ${agora ? T("Janela.Fixada") : T("Janela.Desafixada")}`);
    if (agora && !this.abas.includes(id)) this.abas.push(id);
    this.render();
  }

  static async _criar(ev, el) {
    const r = await criarTipo(el.dataset.tipo, this.pastaDestino);
    if (!r) return;
    this.grupo = "todos";
    this.abrirPagina(r.entry.id, { editar: r.editar });
    if (r.abrirFicha) r.entry.pages.contents[0]?.sheet.render(true);
    if (r.jornal) Jornal.EditorJornal.abrir(r.entry.id);
  }

  static _grupo(ev, el) { this.grupo = el.dataset.grupo; this.render(); }

  static _pasta(ev, el) {
    const id = el.dataset.id;
    const ab = this.abertas;
    if (ehGM()) { this.pastaAlvo = id; this.forcarRaiz = false; }
    if (ab.has(id)) ab.delete(id); else ab.add(id);
    this._setAbertas(ab);
    this.render();
  }

  static _limparAlvo(ev) { ev.stopPropagation(); this.pastaAlvo = null; this.forcarRaiz = true; this.render(); }
  static _expandir() { this._setAbertas(new Set()); this.render(); }
  static _novaPasta(ev, el) { ev.stopPropagation(); this._criarPasta(el.dataset.id ?? this.pastaAlvo ?? null); }
  static _editarPasta(ev, el) { ev.stopPropagation(); game.folders.get(el.dataset.id)?.sheet.render(true); }

  static _editar() { this.editando = !this.editando; this.render(); }

  static _visivel() { revelarPara(this._entry()); }

  static _mostrar() { mostrarAosJogadores(this._entry()); }
  static _fichaNativa() { abrirFichaPadrao(this._entry()); }

  static _traduzir() {
    const a = analisar(this._entry());
    (a.page ?? a.pages[0])?.sheet.render(true);
  }

  static _imagem() {
    const { page } = analisar(this._entry());
    new (FP())({ type: "image", current: page.src, callback: (path) => page.update({ src: path }) }).render(true);
  }

  /** Menu de revelação de uma caixa de texto: padrão, todos, ninguém ou jogador por jogador. */
  static _revelarSecao(ev, el) {
    const e = this._entry();
    const chave = el.dataset.chave;
    const st = estadoSecao(e, chave);
    const lista = Array.isArray(st) ? st : [];
    const salvar = (v) => (v == null ? e.unsetFlag(MOD, `revelado.${chave}`) : e.setFlag(MOD, `revelado.${chave}`, v));
    const marca = (ok) => (ok ? "fa-solid fa-circle-check" : "fa-regular fa-circle");
    const jogadores = game.users.filter((u) => !u.isGM);
    const r = el.getBoundingClientRect();
    Menu.abrir({ preventDefault() {}, stopPropagation() {}, clientX: r.left, clientY: r.bottom + 4 }, [
      { icone: marca(st == null), rotulo: T("Janela.SeguirAPermissaoDaPagina"), acao: () => salvar(null) },
      { icone: marca(st === "todos"), rotulo: T("Janela.RevelarATodosQueVeem"), acao: () => salvar("todos") },
      { icone: marca(st === "ninguem"), rotulo: T("Janela.EsconderSoOMestre"), acao: () => salvar("ninguem") },
      jogadores.length && "-",
      ...jogadores.map((u) => {
        const dentro = lista.includes(u.id);
        const obs = e.testUserPermission(u, "OBSERVER");
        return {
          icone: dentro || (obs && st !== "ninguem") ? "fa-solid fa-square-check" : "fa-regular fa-square",
          rotulo: `${u.name}${obs ? T("Janela.JaEObservador") : ""}`,
          acao: () => {
            const nova = dentro ? lista.filter((id) => id !== u.id) : [...lista, u.id];
            return salvar(nova.length ? nova : null);
          }
        };
      })
    ]);
  }
  static _notaMestre() { editarNotaMestre(this._entry()); }

  static _abrirEspecial(ev, el) {
    const id = el.dataset.id;
    if (!this.abas.includes(id)) this.abas.push(id);
    this.ativa = id;
    this.editando = false;
    this.render();
  }
  static _sessaoIniciar() { Sessao.iniciar(); }
  static async _sessaoEncerrar() {
    const escolha = await Dialogo().wait({
      window: { title: `${T("Comum.Sessao")} ${Sessao.atual()?.n}`, icon: "fa-solid fa-book-bookmark" },
      content: `<p>${(Sessao.atual()?.registros ?? []).length} ${T("Janela.RegistroSAnotadoSAte")}</p>`,
      buttons: [
        { action: "encerrar", label: T("Janela.EncerrarEGerarDiario"), icon: "fa-solid fa-check", default: true },
        { action: "descartar", label: T("Janela.Descartar"), icon: "fa-solid fa-trash" },
        { action: "voltar", label: T("Janela.ContinuarASessao") }
      ],
      rejectClose: false
    }).catch(() => null);
    if (escolha === "encerrar") return Sessao.encerrar();
    if (escolha === "descartar") return Sessao.descartar();
  }

  /** Abre a Linha do tempo (num dia, se td vier) — usado também pelo Calendário e pela História. */
  abrirLinha(td = null, filtro = "tudo") {
    if (!this.abas.includes("__linha")) this.abas.push("__linha");
    this.ativa = "__linha";
    this.editando = false;
    this.filtroLinha = filtro;
    this._rolarLinha = Number.isFinite(Number(td)) && td !== null ? Math.trunc(Number(td)) : null;
    this.render({ force: true });
  }
  static _verOcultas() { this.verOcultas = !this.verOcultas; this.pastaAlvo = null; this.render(); }
  static _ocultarPasta(ev, el) { ev.stopPropagation(); alternarPastaOculta(game.folders.get(el.dataset.id)); }
  static _apagar() { apagarEntrada(this._entry()); }

  static async _bauCombate() {
    if (!game.combat) return ui.notifications.warn(T("Janela.NaoHaCombateAtivo"));
    await criarBauDoCombate(game.combat);
  }

  static _importar() { importarJson(this.pastaAlvo); }
  static async _importarMonks() {
    if (!ehGM()) return;
    const ok = await Dialogo().confirm({
      window: { title: T("Comum.ImportarDoMonkSEnhanced") },
      content: `<p>${T("Janela.ConverteAsPaginasQueEstao")}</p><p>${T("Janela.PaginasJaConvertidasNaoSao")}</p>`,
      yes: { label: T("Janela.Converter") }, no: { label: T("Janela.Cancelar") }, rejectClose: false
    }).catch(() => false);
    if (ok) await importarDoMonks();
  }

  static async _voltarDia() {
    const n = Math.max(1, diaAtual() - 1);
    if (n === diaAtual()) return ui.notifications.warn(T("Janela.JaEODia1"));
    await game.settings.set(MOD, "dia", n);
    ui.notifications.info(`${T("Janela.VoltouParaODia")} ${n}.`);
  }

  static async _novoDia() {
    const n = diaAtual() + 1;
    await game.settings.set(MOD, "dia", n);
    await chat(`<i class="fa-solid fa-sun"></i> ${T("Janela.AmanheceO")} <b>${T("Comum.Dia")} ${n}</b>. ${T("Janela.AsLojasTemNovasOfertas")}`);
  }

  static _rastreador() { game.settings.set(MOD, "rastreador", !game.settings.get(MOD, "rastreador")); }

  static _tema() {
    const chaves = Object.keys(TEMAS);
    const atual = chaves.indexOf(game.settings.get(MOD, "tema"));
    game.settings.set(MOD, "tema", chaves[(atual + 1) % chaves.length]);
  }
}

/** Onde o item arrastado vai cair: antes, depois ou dentro (só pastas). */
function posicaoSoltar(el, ev) {
  if (el.classList.contains("jm-lista")) return "dentro";
  const r = el.getBoundingClientRect();
  const y = (ev.clientY - r.top) / (r.height || 1);
  if (el.classList.contains("jm-pasta-linha")) return y < 0.28 ? "antes" : (y > 0.72 ? "depois" : "dentro");
  return y < 0.5 ? "antes" : "depois";
}

export { JournalApp, renovarEstoques };
