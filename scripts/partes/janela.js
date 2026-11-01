/* Journal — janela principal do Journal (JournalApp).
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T } from "../idioma.js";
import * as Jornal from "../jornal/index.js";
import { tabelasDasLojas, tabelaDaLoja, nomeTabela } from "../lojas/tabelas.js";
import { CAL, CAL_AVISOS, CAL_CORES_ELEMENTO, CAL_FIM, CAL_ICONES, CAL_ICONES_GRUPOS, CAL_MODOS_MES, CAL_REPETIR, Tempo, calApi, calNota, deusDaFesta, doCalendarioAtual, festasDe, historicoCal, historicoCalVisivel, horaParaMin, horarioLoja, iconeSeguro, listaCal, minParaHora, textoHorarioLoja, textoPrazo } from "./calendario.js";
import { HIST_ICONES, acontecimento, calHoje, calNormalizar, calProxima, calProximas, calResumoRepeticao, calSalvar, calTextoDia, calTirar, campoData, criarHistoria, ehHistoria, historias, notaPadrao, ordenarAcontecimentos, paginasHistoria, registradosNaHistoria, registrarNaHistoria } from "./historia.js";
import { PERICIAS_VENDEDOR, RESULTADOS, atorDoDono, bonusPericia, gerarDiarioRegras, multVendaPadrao, negociacaoDeHoje, tabelaNegocio } from "./pechincha.js";
import { NEXUS_ICONES, Nexus, NexusClima, Sessao, souGMPrincipal } from "./sessao.js";
import { ABAS_DEUS, CAMPOS_DEUS, DETALHES, Dialogo, FP, ICONES_PAGINA, CHAVE_DADOS, LIMITES_REGRAS, LV, MOD, Menu, NOMES_MEJ, NOVOS, OFERTAS, REGRAS_CATS, REGRAS_STATUS, SECOES_DEUS, SIMBOLOS_DEUS, STATUS, STATUS_DEUS, TE, TEMAS, TIPOS, TIPOS_SAQUE, abrirFichaPadrao, abrirImagem, abrirPermissoes, alternarFixado, alternarPastaOculta, analisar, apagarChave, apagarEntrada, atorDoJogador, atualizarTudo, avatar, avisoUmaVez, baixarJson, bolinhasDono, caminhoDaPasta, camposMoedas, chat, chavesMoedas, comoLista, corDaPasta, criarBauDoCombate, criarTipo, diaAtual, dicaNota, editarNotaMestre, ehGM, entradaOculta, entradas, esc, estaVisivel, estadoSecao, exportarPasta, fichasDe, fixados, formatarMoedas, formatarPreco, garantirObjeto, gravarJunto, idsGM, importarJson, infoCon, itemLimpo, itemParaLoja, dadosGet, dadosPadrao, dadosSet, dadosUnset, mostrarAosJogadores, mostrarImagem, mostrarMoedas, nomeDoTipoDePagina, nomeTema, notaMestre, novoId, obterPasta, opcoes, ordemNova, pastaMarcadaOculta, pastaOculta, pedir, podeLer, podeVer, podeVerSecao, precoDoItem, precoEmPo, qtdDoItem, arredondarPo, importarDoMonks, regrasMesa, relatarErro, resultadoParaItem, revelarPara, rotuloEstadoSecao, substituirMapa, temModulo, textoParaHtml, tiposDePagina, visibilidade } from "../nucleo.js";

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
      editar: JournalApp._editar,
      visivel: JournalApp._visivel,
      mostrar: JournalApp._mostrar,
      fichaNativa: JournalApp._fichaNativa,
      traduzir: JournalApp._traduzir,
      imagem: JournalApp._imagem,
      novaPagina: JournalApp._novaPagina,
      editarPagina: JournalApp._editarPagina,
      apagarPagina: JournalApp._apagarPagina,
      abrirAtor: JournalApp._abrirAtor,
      limparAtor: JournalApp._limparAtor,
      adicionarLink: JournalApp._adicionarLink,
      removerLink: JournalApp._removerLink,
      abrirFicha: JournalApp._abrirFicha,
      ocultarFicha: JournalApp._ocultarFicha,
      removerFicha: JournalApp._removerFicha,
      ocultarLink: JournalApp._ocultarLink,
      subLoja: JournalApp._subLoja,
      rolarSemanal: JournalApp._rolarSemanal,
      limparSemanal: JournalApp._limparSemanal,
      removerItemLoja: JournalApp._removerItemLoja,
      ocultarItemLoja: JournalApp._ocultarItemLoja,
      comprarSemanal: JournalApp._comprarSemanal,
      comprarDiaria: JournalApp._comprarDiaria,
      rolarDiaria: JournalApp._rolarDiaria,
      limparOferta: JournalApp._limparOferta,
      pegar: JournalApp._pegar,
      dividirMoedas: JournalApp._dividirMoedas,
      itemPiles: JournalApp._itemPiles,
      exportarItens: JournalApp._exportarItens,
      bauCombate: JournalApp._bauCombate,
      importar: JournalApp._importar,
      importarMonks: JournalApp._importarMonks,
      novoDia: JournalApp._novoDia,
      rastreador: JournalApp._rastreador,
      tema: JournalApp._tema,
      novoObjetivo: JournalApp._novoObjetivo,
      alternarObjetivo: JournalApp._alternarObjetivo,
      ocultarObjetivo: JournalApp._ocultarObjetivo,
      removerObjetivo: JournalApp._removerObjetivo,
      subDeus: JournalApp._subDeus,
      revelarSecao: JournalApp._revelarSecao,
      notaMestre: JournalApp._notaMestre,
      calAdicionar: JournalApp._calAdicionar,
      abrirEspecial: JournalApp._abrirEspecial,
      sessaoIniciar: JournalApp._sessaoIniciar,
      sessaoEncerrar: JournalApp._sessaoEncerrar,
      linhaFiltro: JournalApp._linhaFiltro,
      nexusNovo: JournalApp._nexusNovo,
      nexusApagar: JournalApp._nexusApagar,
      nexusMudar: JournalApp._nexusMudar,
      nexusLimiarNovo: JournalApp._nexusLimiarNovo,
      nexusLimiarApagar: JournalApp._nexusLimiarApagar,
      nexusAnomalia: JournalApp._nexusAnomalia,
      novoDiaSagrado: JournalApp._novoDiaSagrado,
      calIcone: JournalApp._calIcone,
      ligarFesta: JournalApp._ligarFesta,
      conTipo: JournalApp._conTipo,
      desligarFesta: JournalApp._desligarFesta,
      prazoDefinir: JournalApp._prazoDefinir,
      prazoLimpar: JournalApp._prazoLimpar,
      calTirar: JournalApp._calTirar,
      calMover: JournalApp._calMover,
      calHoje: JournalApp._calHoje,
      calAbrir: JournalApp._calAbrir,
      voltarDia: JournalApp._voltarDia,
      verOcultas: JournalApp._verOcultas,
      ocultarPasta: JournalApp._ocultarPasta,
      apagar: JournalApp._apagar,
      imagemSimbolo: JournalApp._imagemSimbolo,
      removerReliquia: JournalApp._removerReliquia,
      negociarCompra: JournalApp._negociarCompra,
      negociarVenda: JournalApp._negociarVenda,
      vender: JournalApp._vender,
      novaRecompensa: JournalApp._novaRecompensa,
      recompensaVisivel: JournalApp._recompensaVisivel,
      apagarRecompensa: JournalApp._apagarRecompensa,
      removerPremio: JournalApp._removerPremio,
      entregarRecompensa: JournalApp._entregarRecompensa,
      pegarRecompensa: JournalApp._pegarRecompensa,
      histNovo: JournalApp._histNovo,
      histOrdem: JournalApp._histOrdem,
      histLinha: JournalApp._histLinha,
      histSemData: JournalApp._histSemData,
      histRegistrar: JournalApp._histRegistrar,
      histAbrir: JournalApp._histAbrir,
      jornal: JournalApp._jornal
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
    let sub = a.tipo === "outro" ? (NOMES_MEJ[a.tipoBase] ?? a.tipoBase) : t.rotulo;
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
    const img = a.tipo === "jornal" ? (Jornal.identidade(j).logo || null) : a.page?.src ?? (["diario", "historia"].includes(a.tipo) ? a.pages.find((p) => p.type === "image")?.src : null);
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

    const corpo = this.ativa === "__linha" ? await this._linhaDoTempo(visiveis)
      : this.ativa === "__nexus" ? this._painelNexus()
      : this.ativa === "__regras" ? this._painelRegras()
      : this.ativa === "__jornais" ? await Jornal.painelJornais(this)
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

  /** Linha do tempo: o que já aconteceu (eventos, missões, sessões, histórico do calendário) e os próximos dias. */
  async _linhaDoTempo(visiveis) {
    const gm = ehGM();
    if (!Tempo.ok()) return `<div class="jm-boas-vindas"><i class="fa-solid fa-timeline"></i><h2>${T("Janela.LinhaDoTempo")}</h2><p>${T("Janela.OCalendarioDoMundoNao")}</p></div>`;
    const hoje = Tempo.hoje();
    const itens = [];
    for (const j of visiveis) {
      const n = calNota(j) && doCalendarioAtual(j) ? calNormalizar(calNota(j)) : null;
      if (n && n.repetir === "nao" && n.td <= hoje) itens.push({ td: n.td, tipo: "evento", j, icone: n.icone, cor: n.cor, texto: "" });
      const a = analisar(j);
      if (a.tipo === "quest" && a.x.concluidaEm != null && podeLer(j)) itens.push({ td: Number(a.x.concluidaEm), tipo: "missao", j, icone: STATUS[a.m.status]?.icone ?? "fa-solid fa-scroll", texto: STATUS[a.m.status]?.rotulo ?? "" });
      const ses = j.flags?.[MOD]?.sessao;
      if (ses && Number.isFinite(Number(ses.tdFim))) itens.push({ td: Number(ses.tdFim), tipo: "sessao", j, icone: "fa-solid fa-book-bookmark", texto: `${T("Comum.Sessao")} ${ses.n}` });
    }
    const podeHist = gm || historicoCalVisivel();
    if (podeHist && calApi()) {
      for (const i of historicoCal()) if (i.td <= hoje) itens.push({ td: Number(i.td), tipo: "historico", texto: i.texto, icone: `fa-solid ${iconeSeguro(i.icone, "fa-circle")}` });
    }
    /* História: cada acontecimento com data entra aqui (os próximos vão para "Próximos 30 dias") */
    const futurosHist = [];
    for (const j of visiveis) {
      if (!ehHistoria(j)) continue;
      for (const p of paginasHistoria(j)) {
        const ac = acontecimento(p);
        if (ac.td == null) continue;
        const item = { td: ac.td, tipo: "historia", j, pagina: p.id, nome: p.name, icone: `fa-solid ${ac.icone}`, cor: ac.cor, texto: j.name };
        if (ac.td <= hoje) itens.push(item);
        else if (ac.td <= hoje + 30) futurosHist.push(item);
      }
    }
    /* Nexus: cada limiar cruzado (para baixo ou de volta para cima) fica no histórico do medidor */
    const nexusVisiveis = Nexus.ligado() ? Nexus.lista().filter((nx) => gm || (Nexus.jogadoresVeem() && nx.visivel)) : [];
    for (const nx of nexusVisiveis) {
      for (const h of nx.historico ?? []) {
        const td = Number(h.td);
        if (!Number.isFinite(td) || td > hoje) continue;
        const texto = h.subiu ? `${nx.nome} ${T("Comum.VoltouAcimaDe")} ${h.v}%` : `${nx.nome} ${T("Comum.CaiuAbaixoDe")} ${h.v}%`;
        itens.push({ td, tipo: "nexus", texto, extra: h.texto ?? "", origem: `nexus:${nx.id}:${h.id}`, icone: `fa-solid ${iconeSeguro(h.subiu ? "fa-arrow-trend-up" : nx.icone, "fa-gauge-high")}`, cor: nx.cor });
      }
    }
    /* Jornais: edições publicadas no dia delas (e as programadas, só para o mestre, nos próximos dias) */
    const doJornal = Jornal.naLinha() ? Jornal.itensLinha(hoje) : { passado: [], futuro: [] };
    itens.push(...doJornal.passado);
    const registrados = registradosNaHistoria();
    const temHistoria = historias().some((h) => podeVer(h));
    const filtros = [["tudo", T("Janela.Tudo")], ["historia", T("Comum.Historia")], ["evento", T("Comum.Eventos")], ["missao", T("Comum.Missoes")], ["sessao", T("Comum.Sessoes")], ...(doJornal.passado.length ? [["jornal", Jornal.t("Jornal.Jornais")]] : []), ...(nexusVisiveis.length ? [["nexus", T("Comum.Nexus")]] : []), ...(podeHist && calApi() ? [["historico", T("Comum.HistoricoDoCalendario2")]] : [])];
    const f = filtros.some(([k]) => k === this.filtroLinha) ? this.filtroLinha : "tudo";
    const lista = itens.filter((i) => f === "tudo" ? i.tipo !== "historico" || this.filtroLinha === "historico" : i.tipo === f);

    /* próximos 30 dias */
    const futuros = [];
    for (const j of visiveis) {
      if (!calNota(j) || !doCalendarioAtual(j)) continue;
      for (const td of calProximas(j, 3)) if (td >= hoje && td <= hoje + 30) futuros.push({ td, j, n: calNormalizar(calNota(j)) });
      const a = analisar(j);
      if (a.tipo === "quest" && a.x.prazo != null && !["completed", "failed"].includes(a.m.status) && podeLer(j)) {
        const td = Number(a.x.prazo);
        if (td >= hoje && td <= hoje + 30) futuros.push({ td, j, prazo: true });
      }
    }
    for (const i of futurosHist) futuros.push({ td: i.td, j: i.j, hist: i });
    for (const i of doJornal.futuro) futuros.push({ td: i.td, jornal: i });
    /* do Calendário: eventos das luas (eclipses, luas cheias juntas...) e contadores/prazos que terminam */
    for (const e of listaCal("proximosEventosLuas", 30)) {
      const td = Number(e.td);
      if (Number.isFinite(td) && td >= hoje && td <= hoje + 30) futuros.push({ td, ceu: { icone: iconeSeguro(e.icone, "fa-moon"), cor: /^#[0-9a-f]{3,8}$/i.test(e.cor ?? "") ? e.cor : "", texto: String(e.texto ?? "") } });
    }
    for (const c of listaCal("contadores")) {
      const td = Number(c.tdFim);
      if (!c.feito && Number.isFinite(td) && td >= hoje && td <= hoje + 30) futuros.push({ td, contador: String(c.nome ?? "") });
    }
    futuros.sort((a2, b2) => a2.td - b2.td);
    const ROT_ICONE = { missao: "fa-scroll", sessao: "fa-book-bookmark", evento: "fa-star", historico: "fa-landmark" };
    /* pena = registrar na História; marco = já está lá (abre o acontecimento) */
    const botaoHist = (i) => {
      if (i.tipo === "historia") return "";
      const origem = i.origem ?? (i.j ? i.j.uuid : `cal:${i.td}:${i.texto}`);
      const reg = registrados.get(origem);
      if (reg) return `<a class="jm-lt-hist feito" data-action="abrir" data-id="${reg.j}" data-pagina="${reg.p}" data-tooltip="${T("Janela.JaEstaNaHistoriaAbrir")}"><i class="fa-solid fa-landmark"></i></a>`;
      if (!gm) return "";
      return `<a class="jm-lt-hist" data-action="histRegistrar" data-td="${i.td}" data-origem="${esc(origem)}" data-tipo-item="${i.tipo}"
        data-nome="${esc(i.tipo === "jornal" ? i.nome : i.j ? i.j.name : i.texto)}" data-texto="${esc(i.tipo === "nexus" ? [i.texto, i.extra].filter(Boolean).join(": ") : i.texto ?? "")}" data-tooltip="${T("Comum.RegistrarNaHistoria")}"><i class="fa-solid fa-feather-pointed"></i></a>`;
    };
    const linhaItem = (i) => {
      if (i.tipo === "jornal") return `<li class="jm-lt-item jornal"><i class="${i.icone}" style="color:${esc(i.cor)}"></i><a data-action="jornal" data-op="ler" data-id="${i.j.id}" data-page="${i.pagina}"><b>${esc(i.nome)}</b></a> <small>${esc(i.texto)}</small>${botaoHist(i)}</li>`;
      if (i.tipo === "historia") return `<li class="jm-lt-item historia"><i class="${i.icone}" style="color:${esc(i.cor)}"></i><a data-action="abrir" data-id="${i.j.id}" data-pagina="${i.pagina}"><b>${esc(i.nome)}</b></a> <small><i class="fa-solid fa-landmark"></i> ${esc(i.texto)}</small></li>`;
      const nome = i.j ? `<a data-action="abrir" data-id="${i.j.id}"><b>${esc(i.j.name)}</b></a>` : esc(i.texto);
      return `<li class="jm-lt-item ${i.tipo}"><i class="${esc(i.icone?.startsWith("fa-solid") ? i.icone : `fa-solid ${i.icone ?? "fa-circle"}`)}" ${i.cor ? `style="color:${esc(i.cor)}"` : ""}></i>${nome}${i.j && i.texto ? ` <small>${esc(i.texto)}</small>` : ""}${i.extra ? ` <small>${esc(i.extra)}</small>` : ""}${botaoHist(i)}</li>`;
    };
    const porDia = new Map();
    for (const i of lista.sort((a2, b2) => b2.td - a2.td)) { if (!porDia.has(i.td)) porDia.set(i.td, []); porDia.get(i.td).push(i); }
    let anoLinha;
    const passado = [...porDia.entries()].map(([td, l]) => {
      const pt = Tempo.partes(td);
      const ano = pt.ano;
      const cab = ano !== anoLinha && (anoLinha !== undefined || ano !== Tempo.partes(hoje).ano) ? `<div class="jm-lt-ano">${T("Comum.Ano")} ${esc(pt.textoAno ?? ano)}${pt.era ? ` <small>${esc(pt.era)}</small>` : ""}</div>` : "";
      anoLinha = ano;
      return `${cab}<div class="jm-lt-dia" data-lt-td="${td}"><h4>${esc(Tempo.texto(td))} <small>${esc(Tempo.relativo(td))}</small>
        ${gm ? `<a class="jm-lt-hist" data-action="histRegistrar" data-td="${td}" data-tooltip="${T("Janela.RegistrarUmAcontecimentoNesteDia")}"><i class="fa-solid fa-plus"></i></a>` : ""}</h4>
        <ul>${l.map(linhaItem).join("")}</ul></div>`;
    }).join("");
    const proximos = futuros.map((x2) => `<li class="jm-lt-item" data-lt-td="${x2.td}"><span class="jm-lt-quando">${esc(Tempo.relativo(x2.td))}</span>
      ${x2.hist ? `<i class="${x2.hist.icone}" style="color:${esc(x2.hist.cor)}"></i> <a data-action="abrir" data-id="${x2.j.id}" data-pagina="${x2.hist.pagina}"><b>${esc(x2.hist.nome)}</b></a> <small><i class="fa-solid fa-landmark"></i> ${esc(x2.j.name)}</small>`
        : x2.prazo ? `<i class="fa-solid fa-hourglass-half"></i> <a data-action="abrir" data-id="${x2.j.id}"><b>${esc(x2.j.name)}</b></a> <small>${T("Janela.Prazo")}</small>`
        : x2.jornal ? `<i class="fa-solid fa-clock"></i> <a data-action="jornal" data-op="ver" data-id="${x2.jornal.j.id}" data-page="${x2.jornal.pagina}"><b>${esc(x2.jornal.nome)}</b></a> <small>${esc(x2.jornal.rotulo)}: ${esc(x2.jornal.texto)}</small>`
        : x2.ceu ? `<i class="fa-solid ${x2.ceu.icone}" ${x2.ceu.cor ? `style="color:${esc(x2.ceu.cor)}"` : ""}></i> <b>${esc(x2.ceu.texto)}</b> <small>${T("Janela.NoCeu")}</small>`
        : x2.contador != null ? `<i class="fa-solid fa-hourglass-end"></i> <b>${esc(x2.contador)}</b> <small>${T("Janela.ContadorDoCalendarioTermina")}</small>`
        : `<i class="fa-solid ${x2.n.icone}" style="color:${x2.n.cor}"></i> <a data-action="abrir" data-id="${x2.j.id}"><b>${esc(x2.j.name)}</b></a>`}
      <small>${esc(Tempo.texto(x2.td))}</small></li>`).join("");
    return `<article class="jm-pagina jm-linha-tempo">
      <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-timeline"></i> ${T("Janela.LinhaDoTempo")}</span>
        <h1 class="jm-titulo">${esc(Tempo.texto(hoje))}</h1></div>
        <div class="jm-cab-botoes">
          ${temHistoria || gm ? `<button type="button" data-action="histAbrir" data-tooltip="${temHistoria ? T("Janela.AbrirAHistoria") : T("Janela.CriarODiarioHistoria")}"><i class="fa-solid fa-landmark"></i></button>` : ""}
          ${gm ? `<button type="button" data-action="histRegistrar" data-tooltip="${T("Janela.RegistrarUmAcontecimentoNaHistoria")}"><i class="fa-solid fa-feather-pointed"></i></button>` : ""}
        </div></header>
      <section class="jm-secao"><h3><i class="fa-solid fa-forward"></i> ${T("Janela.Proximos30Dias")}</h3>${proximos ? `<ul class="jm-lt-lista">${proximos}</ul>` : `<p class="jm-vazio">${T("Janela.NadaMarcado")}</p>`}</section>
      <nav class="jm-subabas">${filtros.map(([k, r]) => `<button type="button" class="${f === k ? "ativo" : ""}" data-action="linhaFiltro" data-filtro="${k}">${r}</button>`).join("")}</nav>
      <section class="jm-secao"><h3><i class="fa-solid fa-clock-rotate-left"></i> ${T("Janela.OQueJaAconteceu")}</h3>${passado || `<p class="jm-vazio">${T("Janela.NadaPorAquiAinda")}</p>`}</section>
    </article>`;
  }

  /** Painel dos medidores de Nexus. */
  _painelNexus() {
    const gm = ehGM();
    const api = calApi();
    const zonas = (() => { try { return api?.zonas?.() ?? []; } catch (err) { avisoUmaVez(T("Janela.ZonasDoClima"), err); return []; } })();
    const anomalias = (() => { try { return api?.anomalias?.() ?? []; } catch (err) { avisoUmaVez(T("Janela.AnomaliasDoClima"), err); return []; } })();
    const lista = Nexus.lista().filter((n) => gm || n.visivel);
    const op = (pares, sel, vazio) => `<option value="">${esc(vazio)}</option>` + pares.map(([v, r]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(r)}</option>`).join("");
    const cards = lista.map((nx) => {
      const v = Math.max(0, Math.min(100, Number(nx.valor) || 0));
      const barra = `<div class="jm-nexus-barra"><div style="width:${v}%;background:${esc(nx.cor)}"></div>
        ${(nx.limiares ?? []).map((l) => `<span class="jm-nexus-marca ${l.disparado ? "disparado" : ""}" style="left:${Math.max(0, Math.min(100, Number(l.v) || 0))}%" data-tooltip="${esc(l.v)}%${l.texto ? `: ${esc(l.texto)}` : ""}"></span>`).join("")}</div>`;
      if (!gm) return `<div class="jm-nexus"><div class="jm-nexus-topo"><i class="fa-solid ${esc(nx.icone)}" style="color:${esc(nx.cor)}"></i><b>${esc(nx.nome)}</b><span class="jm-nexus-valor">${v}%</span></div>${barra}</div>`;
      return `<div class="jm-nexus" data-nexus="${nx.id}">
        <div class="jm-nexus-topo">
          <i class="fa-solid ${esc(nx.icone)}" style="color:${esc(nx.cor)}"></i>
          <input class="jm-nexus-nome" data-nexus-campo="nome" value="${esc(nx.nome)}">
          <a class="jm-mini-btn jm-olho ${nx.visivel ? "aberto" : "fechado"}" data-nexus-alternar="visivel" data-tooltip="${nx.visivel ? T("Janela.JogadoresVeemSeAOpcao") : T("Janela.SoOMestreVe")}"><i class="fa-solid ${nx.visivel ? "fa-eye" : "fa-eye-slash"}"></i></a>
          <a class="jm-mini-btn" data-action="nexusApagar" data-id="${nx.id}" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-trash"></i></a>
        </div>
        ${barra}
        <div class="jm-nexus-ctrl">
          ${[-10, -1].map((d) => `<button type="button" data-action="nexusMudar" data-id="${nx.id}" data-delta="${d}">${d}</button>`).join("")}
          <input type="number" min="0" max="100" data-nexus-campo="valor" value="${v}"><b>%</b>
          ${[1, 10].map((d) => `<button type="button" data-action="nexusMudar" data-id="${nx.id}" data-delta="${d}">+${d}</button>`).join("")}
          <select data-nexus-campo="icone">${Object.entries(NEXUS_ICONES).map(([k, r]) => `<option value="${k}" ${k === nx.icone ? "selected" : ""}>${r}</option>`).join("")}</select>
          <input type="color" data-nexus-campo="cor" value="${esc(nx.cor)}">
        </div>
        ${NexusClima.api() ? NexusClima.html(nx, zonas, anomalias, op) : ""}
        <div class="jm-nexus-limiares">
          ${(nx.limiares ?? []).map((l) => `<div class="jm-nexus-limiar ${l.disparado ? "disparado" : ""}" data-limiar="${l.id}">
            <span>${T("Janela.AbaixoDe")}</span><input type="number" min="0" max="100" data-limiar-campo="v" value="${Number(l.v) || 0}"><b>%</b>
            <input type="text" data-limiar-campo="texto" value="${esc(l.texto ?? "")}" placeholder="${T("Janela.OQueAconteceAvisoPara")}">
            ${NexusClima.api() ? `<label class="jm-check" data-tooltip="${T("Janela.LigaAAnomaliaDoClima")}"><input type="checkbox" data-limiar-campo="anomalia" ${l.anomalia ? "checked" : ""}> anomalia</label>` : ""}
            <a class="jm-mini-btn" data-action="nexusLimiarApagar" data-id="${nx.id}" data-limiar="${l.id}"><i class="fa-solid fa-xmark"></i></a>
          </div>`).join("")}
          <button type="button" class="jm-add" data-action="nexusLimiarNovo" data-id="${nx.id}"><i class="fa-solid fa-plus"></i> ${T("Janela.Limiar")}</button>
        </div>
      </div>`;
    }).join("");
    return `<article class="jm-pagina jm-painel-nexus">
      <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-gauge-high"></i> ${T("Comum.Nexus")}</span><h1 class="jm-titulo">${T("Janela.Medidores")}</h1></div></header>
      ${cards || `<p class="jm-vazio jm-centro">${gm ? T("Janela.NenhumMedidorAinda") : T("Janela.NadaParaMostrar")}</p>`}
      ${gm ? `<button type="button" class="jm-add" data-action="nexusNovo"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoMedidor")}</button>
        <p class="jm-dica">${T("Janela.QuandoOValorCaiAbaixo")}</p>` : ""}
    </article>`;
  }

  /** Regras da Mesa: combinados da sessão 0, propostos e discutidos por todos. */
  _painelRegras() {
    const gm = ehGM();
    const { itens, sessao0 } = regrasMesa();
    const eu = game.user.id;
    const nome = (uid) => (uid ? esc(game.users.get(uid)?.name ?? "?") : `<i>${T("Janela.Anonimo2")}</i>`);
    const quando = (t) => esc(new Date(t).toLocaleDateString(game.i18n.lang));
    const opCat = (sel) => Object.entries(REGRAS_CATS).map(([k, [r]]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(r)}</option>`).join("");
    const contagem = Object.fromEntries(Object.keys(REGRAS_STATUS).map((k) => [k, itens.filter((i) => i.status === k).length]));
    const filtro = REGRAS_STATUS[this.filtroRegras] ? this.filtroRegras : "";
    const card = (i) => {
      const [stRot, stIc] = REGRAS_STATUS[i.status] ?? REGRAS_STATUS.proposta;
      const votos = Object.entries(i.votos ?? {});
      const sim = votos.filter(([, v]) => v === "sim").map(([u]) => u), nao = votos.filter(([, v]) => v === "nao").map(([u]) => u);
      const meu = i.votos?.[eu];
      const pode = gm || (i.autor === eu && i.status === "proposta");
      const nomes = (l) => l.map((u) => esc(game.users.get(u)?.name ?? "?")).join(", ");
      return `<div class="jm-regra st-${esc(i.status)}" data-regra-id="${i.id}">
        <div class="jm-regra-topo">
          <span class="jm-regra-status st-${esc(i.status)}"><i class="${stIc}"></i> ${stRot}</span>
          <b class="jm-regra-titulo">${esc(i.titulo)}</b>
          <small>${T("Comum.Por")} ${nome(i.autor)} · ${quando(i.criado)}</small>
          <span class="jm-sec-ctrl">
            ${gm ? `<select data-regra-status>${Object.entries(REGRAS_STATUS).map(([k, [r]]) => `<option value="${k}" ${k === i.status ? "selected" : ""}>${r}</option>`).join("")}</select>` : ""}
            ${pode ? `<a class="jm-mini-btn" data-regra="editar" data-tooltip="${T("Janela.Editar")}"><i class="fa-solid fa-pen"></i></a>
              <a class="jm-mini-btn" data-regra="apagar" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-trash"></i></a>` : ""}
          </span>
        </div>
        ${i.texto ? `<div class="jm-regra-texto">${esc(i.texto).replace(/\n/g, "<br>")}</div>` : ""}
        <div class="jm-regra-votos">
          <button type="button" class="${meu === "sim" ? "ativo" : ""}" data-regra="votar" data-voto="${meu === "sim" ? "" : "sim"}" data-tooltip="${sim.length ? nomes(sim) : T("Janela.NinguemAinda")}"><i class="fa-solid fa-thumbs-up"></i> ${T("Janela.Concordo")} <b>${sim.length}</b></button>
          <button type="button" class="${meu === "nao" ? "ativo" : ""}" data-regra="votar" data-voto="${meu === "nao" ? "" : "nao"}" data-tooltip="${nao.length ? nomes(nao) : T("Janela.NinguemAinda")}"><i class="fa-solid fa-thumbs-down"></i> ${T("Janela.NaoConcordo")} <b>${nao.length}</b></button>
        </div>
        <details class="jm-regra-coments" ${this.regrasAbertas?.has(i.id) ? "open" : ""} data-regra-det="${i.id}">
          <summary><i class="fa-solid fa-comments"></i> ${(i.comentarios ?? []).length} ${T("Janela.ComentarioS")}</summary>
          ${(i.comentarios ?? []).map((c) => `<div class="jm-regra-coment"><b>${nome(c.autor)}</b> <small>${quando(c.t)}</small>
            ${gm || c.autor === eu ? `<a class="jm-mini-btn" data-regra="apagarComentario" data-cid="${c.id}" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-xmark"></i></a>` : ""}
            <div>${esc(c.texto).replace(/\n/g, "<br>")}</div></div>`).join("")}
          <div class="jm-regra-novo-coment">
            <textarea rows="2" data-regra-coment placeholder="${T("Janela.OQueVoceAcha")}"></textarea>
            <label class="jm-check"><input type="checkbox" data-regra-coment-anon> ${T("Janela.Anonimo")}</label>
            <button type="button" data-regra="comentar"><i class="fa-solid fa-paper-plane"></i> ${T("Janela.Comentar")}</button>
          </div>
        </details>
      </div>`;
    };
    const secoes = Object.entries(REGRAS_CATS).map(([k, [rot, ic]]) => {
      const l = itens.filter((i) => i.cat === k && (!filtro || i.status === filtro)).sort((a, b) => a.criado - b.criado);
      if (!l.length) return "";
      return `<section class="jm-secao jm-regras-cat"><h3><i class="${ic}"></i> ${esc(rot)} <small>(${l.length})</small></h3>${l.map(card).join("")}</section>`;
    }).join("");
    return `<article class="jm-pagina jm-painel-regras">
      <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-handshake"></i> ${T("Comum.RegrasDaMesa")}</span>
        <h1 class="jm-titulo">${T("Janela.Sessao0")}</h1>
        <div class="jm-sub-linha"><span class="jm-detalhe">${sessao0?.concluida ? `<i class="fa-solid fa-circle-check"></i> ${T("Janela.ConcluidaEm")} ${quando(sessao0.quando)}` : `<i class="fa-solid fa-comments"></i> ${T("Janela.EmConversa")}`}</span></div></div>
        ${gm ? `<div class="jm-cab-botoes">
          <button type="button" data-regra="modelos" data-tooltip="${T("Janela.AdicionarTopicosComunsDeSessao")}"><i class="fa-solid fa-list-check"></i></button>
          <button type="button" data-regra="diario" data-tooltip="${T("Janela.CriarAtualizarODiarioRegras")}"><i class="fa-solid fa-book"></i></button>
          <button type="button" data-regra="concluir" class="${sessao0?.concluida ? "ativo" : ""}" data-tooltip="${sessao0?.concluida ? T("Janela.ReabrirASessao0") : T("Janela.MarcarASessao0Como")}"><i class="fa-solid fa-flag-checkered"></i></button>
        </div>` : ""}
      </header>
      <p class="jm-dica">${T("Janela.TodosPodemProporTopicosComentar")} <b>${T("Janela.Combinado")}</b>. ${T("Janela.PropostasEComentariosAnonimosNao")}</p>
      <nav class="jm-subabas">
        <button type="button" class="${!filtro ? "ativo" : ""}" data-regra="filtro" data-filtro="">${T("Janela.Todos")} <small>${itens.length}</small></button>
        ${Object.entries(REGRAS_STATUS).map(([k, [r, ic]]) => `<button type="button" class="${filtro === k ? "ativo" : ""}" data-regra="filtro" data-filtro="${k}"><i class="${ic}"></i> ${r} <small>${contagem[k]}</small></button>`).join("")}
      </nav>
      ${secoes || `<p class="jm-vazio jm-centro">${itens.length ? T("Janela.NadaComEsseFiltro2") : (gm ? T("Janela.NenhumTopicoAindaUseO") : T("Janela.NenhumTopicoAindaProponhaO"))}</p>`}
      <section class="jm-secao jm-regras-nova"><h3><i class="fa-solid fa-plus"></i> ${T("Janela.NovaProposta")}</h3>
        <div class="jm-form-dialogo">
          <label>${T("Janela.Assunto")} <select data-regra-nova="cat">${opCat("casa")}</select></label>
          <label>${T("Comum.Titulo")} <input type="text" data-regra-nova="titulo" maxlength="${LIMITES_REGRAS.titulo}" placeholder="${T("Janela.ExSemPvPSemCombinar")}"></label>
          <label>${T("Janela.Detalhes")} <textarea rows="3" data-regra-nova="texto" placeholder="${T("Janela.ExpliqueAIdeiaExemplosExcecoes")}"></textarea></label>
          <label class="jm-check"><input type="checkbox" data-regra-nova="anonimo"> ${T("Janela.EnviarAnonimoBomParaLimites")}</label>
          <button type="button" class="primario" data-regra="propor"><i class="fa-solid fa-paper-plane"></i> ${T("Janela.Propor")}</button>
        </div>
      </section>
    </article>`;
  }

  /** Cliques e campos do painel Regras da Mesa. */
  _ouvintesRegras(root) {
    const painel = root.querySelector(".jm-painel-regras");
    if (!painel) return;
    painel.querySelectorAll("[data-regra-det]").forEach((d) => d.addEventListener("toggle", () => {
      this.regrasAbertas ??= new Set();
      if (d.open) this.regrasAbertas.add(d.dataset.regraDet); else this.regrasAbertas.delete(d.dataset.regraDet);
    }));
    painel.querySelectorAll("[data-regra-status]").forEach((sel) => sel.addEventListener("change", () => {
      pedir("regras", { userId: game.user.id, op: "status", id: sel.closest("[data-regra-id]").dataset.regraId, status: sel.value });
    }));
    painel.querySelectorAll("[data-regra]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const op = b.dataset.regra;
      const card = b.closest("[data-regra-id]");
      const id = card?.dataset.regraId;
      if (op === "filtro") { this.filtroRegras = b.dataset.filtro; return this.render(); }
      if (op === "diario") return gerarDiarioRegras();
      if (op === "propor") {
        const v = (k) => painel.querySelector(`[data-regra-nova="${k}"]`);
        const titulo = v("titulo").value.trim();
        if (!titulo) return ui.notifications.warn(T("Comum.EscrevaUmTituloParaA"));
        pedir("regras", { userId: game.user.id, op: "propor", cat: v("cat").value, titulo, texto: v("texto").value, anonimo: v("anonimo").checked });
        v("titulo").value = ""; v("texto").value = ""; v("anonimo").checked = false;
        return;
      }
      if (op === "votar") return pedir("regras", { userId: game.user.id, op, id, voto: b.dataset.voto || null });
      if (op === "comentar") {
        const ta = card.querySelector("[data-regra-coment]");
        if (!ta.value.trim()) return;
        (this.regrasAbertas ??= new Set()).add(id);
        pedir("regras", { userId: game.user.id, op, id, texto: ta.value, anonimo: card.querySelector("[data-regra-coment-anon]").checked });
        ta.value = "";
        return;
      }
      if (op === "apagarComentario") return pedir("regras", { userId: game.user.id, op, id, cid: b.dataset.cid });
      if (op === "apagar") {
        const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarTopico") }, content: `<p>${T("Janela.ApagarEsteTopicoEOs")}</p>` });
        if (ok) pedir("regras", { userId: game.user.id, op, id });
        return;
      }
      if (op === "editar") {
        const item = regrasMesa().itens.find((i) => i.id === id);
        if (!item) return;
        const dados = await Dialogo().prompt({
          window: { title: T("Janela.EditarTopico"), icon: "fa-solid fa-pen" },
          position: { width: 480 },
          content: `<div class="jm-form-dialogo">
            <label>${T("Janela.Assunto")} <select name="cat">${Object.entries(REGRAS_CATS).map(([k, [r]]) => `<option value="${k}" ${k === item.cat ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>${T("Comum.Titulo")} <input type="text" name="titulo" value="${esc(item.titulo)}" maxlength="${LIMITES_REGRAS.titulo}"></label>
            <label>${T("Janela.Detalhes")} <textarea name="texto" rows="5">${esc(item.texto)}</textarea></label></div>`,
          ok: { label: T("Comum.Salvar"), icon: "fa-solid fa-check", callback: (e2, bt) => ({ cat: bt.form.elements.cat.value, titulo: bt.form.elements.titulo.value, texto: bt.form.elements.texto.value }) }
        }).catch(() => null);
        if (dados) pedir("regras", { userId: game.user.id, op, id, ...dados });
        return;
      }
      if (["modelos", "concluir"].includes(op)) return pedir("regras", { userId: game.user.id, op });
    }));
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

  async _pagina(entry, visiveis) {
    const a = analisar(entry);
    const { page, m, x, tipo } = a;
    const t = TIPOS[tipo];
    const gm = ehGM();
    const ed = gm && this.editando && !["diario", "historia", "jornal"].includes(tipo);
    const enr = async (txt) => txt ? await TE().enrichHTML(textoParaHtml(txt), { secrets: gm, relativeTo: page ?? entry }) : "";
    const visivelIds = new Set(visiveis.map((j) => j.id));
    const chipPagina = (id, extra = "", oculto = false, trancado = false) => {
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
    const npcs = visiveis.filter((j) => analisar(j).tipo === "person").map((j) => [j.id, j.name]);
    let escondidas = 0;
    const secao = (titulo, icone, corpo, extra = "", attrs = "", controles = "", chave = null) => {
      if (chave && !podeVerSecao(entry, chave)) { escondidas++; return ""; }
      if (chave && gm) {
        const [cls, ic, dica] = rotuloEstadoSecao(entry, chave);
        controles = `<a class="jm-mini-btn jm-revela ${cls}" data-action="revelarSecao" data-chave="${esc(chave)}" data-tooltip="${esc(dica)} — ${T("Janela.CliqueParaMudar")}"><i class="fa-solid ${ic}"></i></a>` + controles;
      }
      return `<section class="jm-secao ${extra}" ${attrs}><h3><i class="${icone}"></i> <span class="jm-sec-titulo">${titulo}</span>${controles ? `<span class="jm-sec-ctrl">${controles}</span>` : ""}</h3>${corpo}</section>`;
    };
    const avisoEscondidas = () => (!gm && escondidas
      ? `<p class="jm-vazio jm-centro jm-escondidas"><i class="fa-solid fa-lock"></i> ${escondidas === 1 ? T("Janela.UmaInformacaoAindaNaoFoi") : `${escondidas} ${T("Janela.InformacoesAindaNaoForamReveladas")}`}</p>` : "");
    const traduzir = temModulo("translate-all");

    /* cabeçalho */
    const selo = tipo === "outro" ? (NOMES_MEJ[a.tipoBase] ?? a.tipoBase) : t.rotulo;
    let detalhes = "";
    const campos = tipo === "deus" ? CAMPOS_DEUS.map(([k, r]) => [`x:deus.${k}`, r, x.deus[k]])
      : (DETALHES[tipo] ?? []).map(([k, r]) => [`m:${k}`, r, m[k]]);
    const valorCampo = (k, v) => (k === "x:deus.status" ? (STATUS_DEUS[v] ?? v) : v);
    if (ed && campos.length) detalhes = `<div class="jm-sub-linha">${campos.map(([k, r, v]) => k === "x:deus.status"
      ? `<label class="jm-sub-campo">${r}<select data-campo="${k}">${Object.entries(STATUS_DEUS).map(([sk, sr]) => `<option value="${sk}" ${sk === (v ?? "") ? "selected" : ""}>${sr}</option>`).join("")}</select></label>`
      : `<label class="jm-sub-campo">${r}<input data-campo="${k}" value="${esc(v ?? "")}"></label>`).join("")}</div>`;
    else if (campos.some(([, , v]) => v)) detalhes = `<div class="jm-sub-linha">${campos.filter(([, , v]) => v)
      .map(([k, r, v]) => `<span class="jm-detalhe"><small>${r}</small>${esc(valorCampo(k, v))}</span>`).join("")}</div>`;

    if (tipo === "shop") {
      const hl = textoHorarioLoja(entry);
      if (hl) detalhes += `<div class="jm-sub-linha"><span class="jm-horario ${hl.aberta ? "aberta" : "fechada"}"><i class="fa-solid ${hl.aberta ? "fa-door-open" : "fa-door-closed"}"></i> ${esc(hl.texto)}</span></div>`;
    }
    if (tipo === "shop") detalhes += ed
      ? `<div class="jm-sub-linha"><label class="jm-sub-campo">${T("Janela.DonoVendedor")} <select data-campo="x:dono">${opcoes(npcs, x.dono)}</select></label></div>`
      : (chipPagina(x.dono) ? `<div class="jm-sub-linha">${chipPagina(x.dono, T("Janela.DonoVendedor"))}</div>` : "");

    if (tipo === "quest") {
      const s = STATUS[m.status] ?? STATUS.inprogress;
      detalhes += ed
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
    }

    /* dia sagrado: mostra de qual divindade */
    const deusFesta = deusDaFesta(entry);
    if (deusFesta) detalhes += `<div class="jm-sub-linha">${chipPagina(deusFesta.id, T("Janela.DiaSagradoDe"), false, true)}</div>`;

    const visivel = visibilidade(entry);
    const estaFixa = fixados().has(entry.id);
    let botoes = `<button type="button" data-action="fixar" data-id="${entry.id}" class="${estaFixa ? "ativo" : ""}" data-tooltip="${estaFixa ? T("Janela.Desafixar") : T("Janela.FixarFicaNoTopoDa")}"><i class="fa-solid fa-thumbtack"></i></button>`;
    if (traduzir && page && (gm || page.isOwner)) botoes += `<button type="button" data-action="traduzir" data-tooltip="${T("Janela.TraduzirComOTranslateAll")}"><i class="fa-solid fa-language"></i></button>`;
    if (gm) {
      if (!["diario", "historia", "jornal"].includes(tipo)) botoes += `<button type="button" data-action="editar" class="${ed ? "ativo" : ""}" data-tooltip="${ed ? T("Janela.ConcluirEdicao") : T("Janela.Editar")}"><i class="fa-solid ${ed ? "fa-check" : "fa-pen"}"></i></button>`;
      if (["diario", "historia", "jornal", "outro"].includes(tipo)) botoes += `<button type="button" data-action="fichaNativa" data-tooltip="${T("Janela.AbrirNaFichaPadraoDo")}"><i class="fa-solid fa-up-right-from-square"></i></button>`;
      botoes += `
        <button type="button" data-action="visivel" class="jm-vis ${visivel}" data-tooltip="${{ todos: T("Janela.TodosOsJogadoresVeem"), alguns: T("Janela.AlgunsJogadoresVeem"), ninguem: T("Janela.OcultoDosJogadores") }[visivel]} — ${T("Janela.CliqueParaEscolherQuemVe")}"><i class="fa-solid ${{ todos: "fa-eye", alguns: "fa-user-check", ninguem: "fa-eye-slash" }[visivel]}"></i></button>
        <button type="button" data-action="mostrar" data-tooltip="${T("Janela.AbrirNaTelaDosJogadores2")}"><i class="fa-solid fa-bullhorn"></i></button>
        ${calApi() && !calNota(entry) ? `<button type="button" data-action="calAdicionar" data-tooltip="${T("Janela.ColocarNoCalendario")}"><i class="fa-solid fa-calendar-plus"></i></button>` : ""}
        <button type="button" class="jm-lixeira" data-action="apagar" data-tooltip="${T("Janela.ApagarEstaPaginaPedeConfirmacao")}"><i class="fa-solid fa-trash"></i></button>`;
    }

    const blocos = [];
    const caminho = entry.folder ? `<span class="jm-caminho"><i class="fa-solid fa-folder"></i> ${esc(caminhoDaPasta(entry.folder).join(" / "))}</span>` : "";
    const imgCab = tipo === "jornal" ? (Jornal.identidade(entry).logo || null) : page?.src ?? (["diario", "historia"].includes(tipo) ? a.pages.find((p) => p.type === "image")?.src : null);
    blocos.push(`<header class="jm-cabecalho">
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
    </header>`);


    /* ---- Jornal de Notícias: identidade, edições e a folha (scripts/jornal) ---- */
    if (tipo === "jornal") {
      blocos.push(await Jornal.corpoJornal(this, entry, secao));
      return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
    }

    /* ---- data no calendário (qualquer tipo de página) ---- */
    blocos.push(await this._secaoCalendario(entry, secao));

    /* ---- História: acontecimentos em ordem cronológica, ligados à linha do tempo ---- */
    if (tipo === "historia") {
      const paginas = paginasHistoria(entry);
      escondidas += a.pages.length - paginas.length;
      const hoje = Tempo.ok() ? Tempo.hoje() : null;
      const comData = paginas.filter((p) => acontecimento(p).td != null).length;
      blocos.push(`<div class="jm-hist-barra">
        ${gm ? `<button type="button" data-action="histNovo"><i class="fa-solid fa-feather-pointed"></i> ${T("Janela.NovoAcontecimento")}</button>` : ""}
        <button type="button" class="sec" data-action="histOrdem" data-tooltip="${T("Janela.TrocarAOrdem")}"><i class="fa-solid ${this.histDesc ? "fa-arrow-up-wide-short" : "fa-arrow-down-short-wide"}"></i> ${this.histDesc ? T("Janela.MaisRecentesPrimeiro") : T("Janela.MaisAntigosPrimeiro")}</button>
        ${Tempo.ok() ? `<button type="button" class="sec" data-action="histLinha" data-tooltip="${T("Janela.AbrirALinhaDoTempo")}"><i class="fa-solid fa-timeline"></i> ${T("Janela.LinhaDoTempo")}</button>` : ""}
        <span class="jm-hist-conta">${paginas.length} ${T("Janela.AcontecimentoS")}${paginas.length !== comData ? ` · ${paginas.length - comData} ${T("Janela.SemData")}` : ""}</span>
      </div>`);
      let anoAtual;
      for (const p of ordenarAcontecimentos(paginas, this.histDesc)) {
        const ac = acontecimento(p);
        const ano = ac.td != null && Tempo.ok() ? Tempo.partes(ac.td).ano : null;
        if (ano !== anoAtual) { blocos.push(`<div class="jm-hist-ano"><span>${ano != null ? `${T("Comum.Ano")} ${esc(ano)}` : T("Janela.SemData2")}</span></div>`); anoAtual = ano; }
        let origem = "";
        if (ac.origem.startsWith("JournalEntry.")) {
          const doc = fromUuidSync(ac.origem);
          const id = doc?.documentName === "JournalEntry" ? doc.id : doc?.parent?.id;
          if (id) origem = chipPagina(id, "origem");
        }
        const naLinha = ac.td != null && hoje != null && ac.td <= hoje + 30;
        const quando = `<div class="jm-hist-quando">
          <i class="fa-solid ${ac.icone}" style="color:${ac.cor}"></i>
          <div><b>${ac.td != null ? esc(Tempo.ok() ? Tempo.texto(ac.td) : `${T("Comum.Dia")} ${ac.td}`) : T("Janela.SemData2")}</b>
            ${ac.td != null && Tempo.ok() ? `<small>${esc(Tempo.relativo(ac.td))}${ac.td > hoje ? T("Janela.AindaVaiAcontecer") : ""}</small>` : ""}</div>
          ${origem ? `<div class="jm-hist-origem">${origem}</div>` : ""}
        </div>`;
        const edicao = gm ? `<details class="jm-hist-ed" data-hist-ed="${p.id}" ${this.histAbertos.has(p.id) ? "open" : ""}>
            <summary><i class="fa-solid fa-sliders"></i> ${T("Janela.DataIconeECor")}</summary>
            <div class="jm-hist-ed-campos">
              ${Tempo.ok() ? `<label>${T("Comum.Data")} ${campoData("hist", ac.td ?? hoje, `data-page="${p.id}"`)}</label>
                ${ac.td != null ? `<button type="button" class="sec" data-action="histSemData" data-page="${p.id}" data-tooltip="${T("Janela.TirarADataSaiDa")}"><i class="fa-solid fa-calendar-xmark"></i></button>` : `<span class="jm-dica">${T("Janela.EscolhaUmaDataParaPor")}</span>`}` : ""}
              <label>${T("Comum.Icone")} <select data-hist-campo="icone" data-page="${p.id}">${Object.entries(HIST_ICONES).map(([k, r]) => `<option value="${k}" ${k === ac.icone ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
              <label>${T("Janela.Cor")} <input type="color" data-hist-campo="cor" data-page="${p.id}" value="${ac.cor}"></label>
            </div></details>` : "";
        const ctrl = `${naLinha ? `<a class="jm-mini-btn" data-action="histLinha" data-td="${ac.td}" data-tooltip="${T("Janela.VerEsteDiaNaLinha")}"><i class="fa-solid fa-timeline"></i></a>` : ""}${gm ? `
          ${traduzir && p.type === "text" ? `<a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${T("Janela.TraduzirAbreAPagina")}"><i class="fa-solid fa-language"></i></a>` : ""}
          <a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${T("Janela.EditarOTexto")}"><i class="fa-solid fa-pen"></i></a>
          <a class="jm-mini-btn" data-action="apagarPagina" data-page="${p.id}" data-tooltip="${T("Janela.ApagarAcontecimento")}"><i class="fa-solid fa-trash"></i></a>` : ""}`;
        blocos.push(secao(esc(p.name), ICONES_PAGINA[p.type] ?? "fa-solid fa-file", quando + edicao + await this._paginaNativa(p),
          "jm-hist-item", `data-page-id="${p.id}" style="--hist-cor:${ac.cor}"`, ctrl, gm ? `pg-${p.id}` : null));
      }
      blocos.push(avisoEscondidas());
      if (!paginas.length) blocos.push(`<p class="jm-vazio jm-centro">${gm ? `${T("Janela.NenhumAcontecimentoAindaCrieUm")} <i class="fa-solid fa-feather-pointed"></i> ${T("Janela.AoLadoDeCadaItem")}` : T("Janela.NadaRegistradoAinda")}</p>`);
      if (gm) blocos.push(`<div class="jm-add-paginas"><span>${T("Janela.AdicionarPagina")}</span>${tiposDePagina().map((tp) =>
        `<button type="button" data-action="novaPagina" data-tipo="${tp}"><i class="${ICONES_PAGINA[tp] ?? "fa-solid fa-file"}"></i> ${esc(nomeDoTipoDePagina(tp))}</button>`).join("")}</div>`);
      blocos.push(this._notas(paginas[0] ?? null, secao));
      return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
    }

    /* ---- Diário comum: todas as páginas nativas ---- */
    if (tipo === "diario") {
      const paginas = a.pages.filter((p) => gm || (podeVer(entry) && (p.testUserPermission(game.user, "OBSERVER") || podeVerSecao(entry, `pg-${p.id}`))));
      escondidas += a.pages.length - paginas.length;
      for (const p of paginas) {
        const ctrl = gm ? `
          ${traduzir && p.type === "text" ? `<a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${T("Janela.TraduzirAbreAPagina")}"><i class="fa-solid fa-language"></i></a>` : ""}
          <a class="jm-mini-btn" data-action="editarPagina" data-page="${p.id}" data-tooltip="${T("Janela.EditarPagina")}"><i class="fa-solid fa-pen"></i></a>
          <a class="jm-mini-btn" data-action="apagarPagina" data-page="${p.id}" data-tooltip="${T("Comum.ApagarPagina")}"><i class="fa-solid fa-trash"></i></a>` : "";
        blocos.push(secao(esc(p.name), ICONES_PAGINA[p.type] ?? "fa-solid fa-file", await this._paginaNativa(p), "", `data-page-id="${p.id}"`, ctrl, gm ? `pg-${p.id}` : null));
      }
      blocos.push(avisoEscondidas());
      if (!paginas.length && gm) blocos.push(secao(T("Janela.Conteudo"), "fa-solid fa-file-lines", `<p class="jm-vazio">${T("Janela.DiarioVazio")}</p>`));
      if (gm) blocos.push(`<div class="jm-add-paginas"><span>${T("Janela.AdicionarPagina")}</span>${tiposDePagina().map((tp) =>
        `<button type="button" data-action="novaPagina" data-tipo="${tp}"><i class="${ICONES_PAGINA[tp] ?? "fa-solid fa-file"}"></i> ${esc(nomeDoTipoDePagina(tp))}</button>`).join("")}</div>`);
      blocos.push(this._notas(paginas[0] ?? null, secao));
      return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
    }

    /* ---- divindade: abas e símbolos ---- */
    if (tipo === "deus") {
      const abas = ABAS_DEUS.filter(([k]) => gm || k === "geral" || this._deusTemConteudo(x, k, entry));
      if (!abas.some(([k]) => k === this.subDeus)) this.subDeus = "geral";
      if (abas.length > 1) blocos.push(`<nav class="jm-subabas jm-abas-deus">${abas.map(([k, r, i]) =>
        `<button type="button" class="${this.subDeus === k ? "ativo" : ""}" data-action="subDeus" data-sub="${k}"><i class="${i}"></i> ${r}</button>`).join("")}</nav>`);
      if (this.subDeus === "geral") blocos.push(this._simbolosDeus(x, ed, secao));
    }

    /* ---- descrição (text.content nativo) ---- */
    const tituloResumo = { shop: T("Janela.SobreALoja"), journalentry: T("Janela.Anotacao"), deus: T("Janela.MitosELendas"), loot: T("Janela.SobreOBau") }[tipo] ?? T("Janela.Descricao");
    const html = page.text?.content ?? "";
    if ((html || ed || tipo !== "loot") && (tipo !== "deus" || this.subDeus === "geral")) blocos.push(secao(tituloResumo, "fa-solid fa-align-left", ed
      ? `<div class="jm-editor-alvo" data-editor></div>`
      : `<div class="jm-texto">${html ? await TE().enrichHTML(html, { secrets: gm, relativeTo: page }) : `<em class="jm-vazio">${T("Janela.SemDescricao")}</em>`}</div>`,
      "", "", gm ? `<a class="jm-mini-btn" data-action="traduzir" data-tooltip="${T("Janela.AbrirNoEditorCompletoDo")}"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></a>` : "", "descricao"));

    if (tipo === "outro") blocos.push(secao(T("Janela.MonkSEnhancedJournal"), "fa-solid fa-puzzle-piece",
      `<p class="jm-dica">${T("Janela.EsteEUm")} "${esc(NOMES_MEJ[a.tipoBase] ?? a.tipoBase)}" ${T("Janela.DoMonkSAquiDa")} <i class="fa-solid fa-pen"></i>${T("Janela.ORestoDosDadosDele")} <i class="fa-solid fa-up-right-from-square"></i>.</p>`));

    /* ---- divindade: seções da aba ---- */
    if (tipo === "deus") {
      for (const [k, r, i, dica] of SECOES_DEUS[this.subDeus] ?? []) {
        if (!x.deus[k] && !ed) continue;
        blocos.push(secao(r, i, ed
          ? `<textarea data-campo="x:deus.${k}" rows="4" placeholder="${esc(dica)}">${esc(x.deus[k])}</textarea>`
          : `<div class="jm-texto">${await enr(x.deus[k])}</div>`, `jm-deus-${k}`, "", "", k));
      }
      if (this.subDeus === "fe") blocos.push(this._diasSagrados(entry, secao));
      if (this.subDeus === "poder") blocos.push(await this._reliquiasDeus(x, ed, secao));
      if (gm && !ed && this.subDeus !== "geral" && !this._deusTemConteudo(x, this.subDeus, null))
        blocos.push(`<p class="jm-vazio jm-centro">${T("Janela.NadaEscritoNestaAbaAinda")}</p>`);
    }

    /* ---- NPC: ficha do ator (formato Monk's: flags.actor) ---- */
    if (tipo === "person") {
      const link = m.actor;
      const ator = link ? (typeof link === "string" ? fromUuidSync(link) : (link.uuid ? fromUuidSync(link.uuid) : game.actors.get(link.id))) : null;
      const pode = ator && (gm || ator.testUserPermission(game.user, "LIMITED"));
      let corpo = "";
      if (pode) corpo = `<div class="jm-ator"><img src="${esc(ator.img)}"><b>${esc(ator.name)}</b>
        <button type="button" data-action="abrirAtor"><i class="fa-solid fa-id-card"></i> ${T("Janela.AbrirFicha")}</button>
        ${ed ? `<button type="button" class="sec" data-action="limparAtor"><i class="fa-solid fa-link-slash"></i></button>` : ""}</div>`;
      else if (ed) corpo = `<div class="jm-soltar"><i class="fa-solid fa-user-plus"></i> ${T("Janela.ArrasteUmAtorAquiPara")}</div>`;
      if (corpo) blocos.push(secao(T("Janela.Ficha"), "fa-solid fa-id-card", corpo, "", ed ? `data-drop="ator"` : ""));
    }

    if (tipo === "shop") blocos.push(await this._secaoLoja(entry, a, ed, secao));
    if (tipo === "loot") blocos.push(await this._secaoBau(entry, a, ed, secao));

    /* ---- missão ---- */
    if (tipo === "quest") {
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
      blocos.push(secao(T("Janela.Objetivos"), "fa-solid fa-list-check",
        (linhas.join("") || `<em class="jm-vazio">${T("Janela.NenhumObjetivoAinda")}</em>`) +
        (gm ? `<button type="button" class="jm-add" data-action="novoObjetivo"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoObjetivo")}</button>` : ""), "", "", "", "objetivos"));

      blocos.push(await this._secaoRecompensas(a, ed, secao, enr));
    }

    /* ---- conexões (relationships do Monk's) ---- */
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
    if (this.conFiltro?.tipo && !tiposCon.includes(this.conFiltro.tipo)) this.conFiltro.tipo = "";
    const filtroCon = total > 3 ? `<div class="jm-con-filtros">
        <div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-con-busca-campo placeholder="${T("Janela.FiltrarConexoesNomeOuRelacao")}" value="${esc(this.conFiltro?.texto ?? "")}"></div>
        <div class="jm-con-chips">
          <button type="button" class="jm-chip ${!this.conFiltro?.tipo ? "ativo" : ""}" data-action="conTipo" data-tipo="">${T("Janela.Todos")} <span>${total}</span></button>
          ${tiposCon.map((k) => `<button type="button" class="jm-chip ${this.conFiltro?.tipo === k ? "ativo" : ""}" data-action="conTipo" data-tipo="${k}"><i class="${infoCon(k).icone}"></i> ${esc(ROTULOS_CON[k] ?? (k === "ficha" ? T("Janela.Personagens") : TIPOS[k].plural))} <span>${contagem[k] ?? 0}</span></button>`).join("")}
        </div></div>` : "";
    if (meus || fichas || reversos.length || ed) blocos.push(secao(tipo === "deus" ? T("Janela.PanteaoIgrejasEFieis") : T("Janela.Conexoes"), "fa-solid fa-diagram-project",
      filtroCon + `<p class="jm-vazio jm-con-nada" hidden>${T("Janela.NenhumaConexaoComEsseFiltro")}</p>` +
      `<div class="jm-links">${fichas}${meus}</div>` +
      (reversos.length ? `<div class="jm-reversos"><span>${T("Janela.TambemLigadoA")}</span><div class="jm-links">${reversos.join("")}</div></div>` : "") +
      addLink, "jm-conexoes", ed ? `data-drop="link"` : ""));

    /* ---- segredos ---- */
    if (gm && (x.segredo || ed)) blocos.push(secao(T("Janela.SegredosDoMestre"), "fa-solid fa-user-secret", ed
      ? `<textarea data-campo="x:segredo" rows="4" placeholder="${T("Janela.SoOMestreVeIsto")}">${esc(x.segredo)}</textarea>`
      : `<div class="jm-texto">${await enr(x.segredo)}</div>`, "jm-segredo"));

    /* ---- matérias de jornal ligadas a esta página ---- */
    blocos.push(Jornal.secaoRelacionadas(entry, secao));

    blocos.push(avisoEscondidas());
    blocos.push(this._notas(page, secao));
    return `<article class="jm-pagina tipo-${tipo}">${blocos.join("")}</article>`;
  }

  /** Destino de cada seletor de data. */
  async _aoEscolherData(alvo, td, caixa) {
    const e = this._entry();
    if (!e) return;
    if (alvo === "cal") return calSalvar(e, { td });
    if (alvo === "calFim") { const n = calNormalizar(calNota(e)); return calSalvar(e, { fim: { ...n.fim, tipo: "data", td } }); }
    if (alvo === "prazo") {
      const { page } = analisar(e);
      await page.update({ [`flags.${MOD}.prazo`]: td, [`flags.${MOD}.prazoAvisado`]: false });
      return;
    }
    if (alvo === "hist") {
      const p = e.pages.get(caixa.dataset.page);
      if (p) await p.update({ [`flags.${MOD}.acontecimento.td`]: td });
      return;
    }
    if (alvo === "festa") {
      const festa = game.journal.get(caixa.dataset.festa);
      if (festa) return calSalvar(festa, { td });
    }
  }

  _diasSagrados(entry, secao) {
    const gm = ehGM();
    const festas = festasDe(entry).filter((j) => podeVer(j))
      .map((j) => ({ j, n: calNota(j) }))
      .sort((a, b) => (calProxima(a.j) ?? Infinity) - (calProxima(b.j) ?? Infinity));
    if (!festas.length && !gm) return "";
    const linhas = festas.map(({ j, n }) => {
      const prox = n ? calProxima(j) : null;
      const cor = /^#[0-9a-f]{6}$/i.test(n?.cor ?? "") ? n.cor : "#d6a92b";
      return `<div class="jm-festa" style="border-left-color:${cor}">
        <i class="fa-solid ${CAL_ICONES[n?.icone] ? n.icone : "fa-hands-praying"}" style="color:${cor}"></i>
        <div class="info"><a data-action="abrir" data-id="${j.id}"><b>${esc(j.name)}</b></a>
          <small>${n ? `${esc(calResumoRepeticao(j))}${prox != null ? ` · ${T("Janela.Proxima")}: ${esc(calTextoDia(prox))}` : ""}` : T("Janela.SemDataNoCalendario")}</small></div>
        ${gm && n && Tempo.ok() ? campoData("festa", Number(n.td), `data-festa="${j.id}"`) : ""}
        ${gm ? `<a class="jm-mini-btn" data-action="desligarFesta" data-id="${j.id}" data-tooltip="${T("Janela.DesligarDestaDivindadeAPagina")}"><i class="fa-solid fa-link-slash"></i></a>` : ""}
      </div>`;
    }).join("");
    /* eventos do calendário que ainda não são dias sagrados desta divindade */
    const livres = gm ? game.journal.filter((j) => j.id !== entry.id && calNota(j) && calNota(j).divindade !== entry.uuid && analisar(j).tipo !== "deus")
      .sort((a, b) => a.name.localeCompare(b.name)) : [];
    const ligar = gm ? `<div class="jm-festa-ligar">
        <select data-festa-livre><option value="">— ${T("Janela.LigarUmEventoQueJa")} —</option>${livres.map((j) => {
          const outro = deusDaFesta(j);
          return `<option value="${j.id}">${esc(j.name)}${outro ? ` (${T("Janela.HojeDe")} ${esc(outro.name)})` : ""}</option>`;
        }).join("")}</select>
        <button type="button" data-action="ligarFesta"><i class="fa-solid fa-link"></i> ${T("Janela.Ligar")}</button>
      </div>
      <div class="jm-soltar jm-festa-drop"><i class="fa-solid fa-calendar-plus"></i> ${T("Janela.ArrasteAquiUmEventoOu")}</div>` : "";
    return secao(T("Janela.DiasSagradosNoCalendario"), "fa-solid fa-calendar-days",
      (linhas || `<p class="jm-vazio">${T("Janela.NenhumDiaSagradoMarcado")}</p>`) +
      (gm ? `<button type="button" class="jm-add" data-action="novoDiaSagrado"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoDiaSagrado")}</button>` : "") + ligar,
      "jm-dias-sagrados", gm ? `data-drop="festa"` : "", "", "diasSagrados");
  }

  async _secaoCalendario(entry, secao) {
    const bruta = calNota(entry);
    if (!bruta) return "";
    const n = calNormalizar(bruta);
    const gm = ehGM();
    const api = calApi();
    const prox = calProximas(entry, 3);
    const quando = `<div class="jm-cal-quando">
      <i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>
      <div><b>${esc(calTextoDia(n.td))}${n.hora ? ` · ${esc(n.hora)}` : ""}</b>
        <small>${esc(calResumoRepeticao(entry))}${!api ? T("Janela.CalendarioDaMesaDesativado") : ""}</small>
        ${n.repetir !== "nao" && prox.length ? `<small>${T("Janela.Proximas")}: ${prox.map((td) => esc(Tempo.texto(td))).join(" · ")}</small>` : ""}</div>
    </div>`;
    const historia = String(entry.getFlag(MOD, "historia") ?? "");
    const historiaHtml = historia ? await TE().enrichHTML(textoParaHtml(historia), { secrets: gm, relativeTo: entry }) : "";
    const blocoHistoria = gm
      ? `<label class="jm-cal-historia"><span><i class="fa-solid fa-book-open"></i> ${T("Comum.Historia")}</span>
          <textarea data-historia rows="3" placeholder="${T("Janela.AOrigemDestaDataO")}">${esc(historia)}</textarea></label>`
      : (historiaHtml ? `<div class="jm-cal-historia"><span><i class="fa-solid fa-book-open"></i> ${T("Comum.Historia")}</span><div class="jm-texto">${historiaHtml}</div></div>` : "");
    if (!gm) return secao(T("Janela.Calendario"), "fa-solid fa-calendar-days", quando + blocoHistoria, "jm-cal", "", "", "calendario");

    const op = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
    const semana = Tempo.semana();
    const unidade = { dias: T("Comum.DiaS"), semanas: T("Janela.SemanaS"), meses: T("Janela.MesEs"), anos: T("Janela.AnoS") }[n.repetir];
    const repeticao = `<div class="jm-cal-campos">
        <label>${T("Janela.Repetir")} <select data-cal-campo="repetir">${op(CAL_REPETIR, n.repetir)}</select></label>
        ${n.repetir !== "nao" ? `<label class="curto">${T("Comum.ACada")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="cada" value="${n.cada}"> ${unidade}</span></label>` : ""}
        ${["meses", "anos"].includes(n.repetir) ? `<label>${T("Janela.QualDia")} <select data-cal-campo="modoMes">${op(CAL_MODOS_MES, n.modoMes)}</select></label>` : ""}
        <label class="curto">${T("Janela.Dura")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="duracao" value="${n.duracao}"> ${T("Comum.DiaS")}</span></label>
      </div>
      ${n.repetir === "semanas" && semana.length ? `<div class="jm-cal-semana">${semana.map((nome, i) =>
        `<label class="jm-dia-sem ${n.diasSemana.includes(i) ? "marcado" : ""}"><input type="checkbox" data-cal-semana="${i}" ${n.diasSemana.includes(i) ? "checked" : ""}>${esc(nome)}</label>`).join("")}</div>` : ""}
      ${n.repetir !== "nao" ? `<div class="jm-cal-campos">
        <label>${T("Janela.Termina")} <select data-cal-campo="fim.tipo">${op(CAL_FIM, n.fim.tipo)}</select></label>
        ${n.fim.tipo === "data" ? `<label>${T("Janela.Em")} ${campoData("calFim", n.fim.td)}</label>` : ""}
        ${n.fim.tipo === "vezes" ? `<label class="curto">${T("Janela.DepoisDe")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="fim.vezes" value="${n.fim.vezes}"> ${T("Janela.VezEs")}</span></label>` : ""}
      </div>` : ""}`;
    const corpo = `${quando}
      ${Tempo.ok() ? `<div class="jm-cal-data"><span>${T("Janela.ComecaEm")}:</span>${campoData("cal", n.td)}</div>` : ""}
      <div class="jm-cal-mover">
        <span>${T("Janela.Mover")}:</span>
        ${[[-7, "−7"], [-1, "−1"], [1, "+1"], [7, "+7"]].map(([d, r]) => `<button type="button" data-action="calMover" data-dias="${d}" data-tooltip="${d > 0 ? T("Janela.Adiar") : T("Janela.Antecipar")} ${Math.abs(d)} ${T("Comum.DiaS")}">${r}</button>`).join("")}
        <button type="button" data-action="calHoje" data-tooltip="${T("Janela.MarcarParaHoje")}"><i class="fa-solid fa-calendar-check"></i> ${T("Comum.Hoje2")}</button>
        ${api ? `<button type="button" data-action="calAbrir" data-tooltip="${T("Janela.AbrirOCalendario")}"><i class="fa-solid fa-calendar-days"></i></button>` : ""}
      </div>
      ${repeticao}
      <div class="jm-cal-campos">
        <label>${T("Janela.Hora")} <input type="text" data-cal-campo="hora" value="${esc(n.hora)}" placeholder="HH:MM"></label>
        <label class="curto">${T("Janela.Cor")} <input type="color" data-cal-campo="cor" value="${n.cor}"></label>
        <label>${T("Janela.Aviso")} <select data-cal-campo="aviso">${op(CAL_AVISOS, n.aviso)}</select></label>
      </div>
      <details class="jm-cal-icones" ${this.iconesAbertos ? "open" : ""}>
        <summary><i class="fa-solid ${n.icone}" style="color:${n.cor}"></i> ${T("Comum.Icone")}: <b>${esc(CAL_ICONES[n.icone])}</b> <small>${T("Janela.CliqueParaTrocar")}</small></summary>
        ${CAL_ICONES_GRUPOS.map(([g, lista]) => `<div class="jm-cal-icones-grupo"><small>${esc(g)}</small><div class="jm-cal-icones-grade">${lista.map(([k, r]) =>
          `<button type="button" class="${k === n.icone ? "ativo" : ""}" data-action="calIcone" data-icone="${k}" data-tooltip="${esc(r)}"><i class="fa-solid ${k}" ${CAL_CORES_ELEMENTO[k] ? `style="color:${CAL_CORES_ELEMENTO[k]}"` : ""}></i></button>`).join("")}</div></div>`).join("")}
      </details>
      ${blocoHistoria}`;
    return secao(T("Janela.Calendario"), "fa-solid fa-calendar-days", corpo, "jm-cal", "", `<a class="jm-mini-btn" data-action="calTirar" data-tooltip="${T("Janela.TirarDoCalendarioAPagina")}"><i class="fa-solid fa-calendar-xmark"></i></a>`, "calendario");
  }

  _deusTemConteudo(x, aba, entry = null) {
    if (aba === "geral") return true;
    const ve = (k) => !entry || podeVerSecao(entry, k);
    if ((SECOES_DEUS[aba] ?? []).some(([k]) => x.deus[k] && ve(k))) return true;
    return aba === "poder" && (x.deus.reliquias ?? []).length > 0 && ve("reliquias");
  }

  _simbolosDeus(x, ed, secao) {
    const d = x.deus;
    const tem = d.simboloImg || SIMBOLOS_DEUS.some(([k]) => d[k]);
    if (!tem && !ed) return "";
    const img = d.simboloImg
      ? `<img class="jm-simbolo-img" src="${esc(d.simboloImg)}" alt="">`
      : `<div class="jm-simbolo-img vazio"><i class="fa-solid fa-sun"></i></div>`;
    const campos = SIMBOLOS_DEUS.map(([k, r]) => ed
      ? `<label class="jm-sub-campo">${r}<input data-campo="x:deus.${k}" value="${esc(d[k] ?? "")}"></label>`
      : (d[k] ? `<div class="jm-simbolo-campo"><small>${r}</small><span>${esc(d[k])}</span></div>` : "")).join("");
    return secao(T("Janela.SimbolosSagrados"), "fa-solid fa-ankh",
      `<div class="jm-simbolos">${ed ? `<a class="jm-simbolo-troca" data-action="imagemSimbolo" data-tooltip="${T("Janela.EscolherImagemDoSimbolo")}">${img}</a>` : img}
        <div class="jm-simbolos-campos">${campos}</div></div>`, "jm-deus-simbolos", "", "", "simbolos");
  }

  async _reliquiasDeus(x, ed, secao) {
    const gm = ehGM();
    const lista = [];
    for (const uuid of x.deus.reliquias ?? []) {
      const doc = fromUuidSync(uuid);
      if (!doc) continue;
      lista.push(`<div class="jm-premio-card"><img src="${esc(doc.img)}" alt="">
        <div class="nome">${await TE().enrichHTML(`@UUID[${uuid}]{${String(doc.name).replace(/[{}]/g, "")}}`)}</div>
        ${gm && ed ? `<a class="jm-mini-btn" data-action="removerReliquia" data-uuid="${esc(uuid)}"><i class="fa-solid fa-trash"></i></a>` : ""}</div>`);
    }
    if (!lista.length && !(gm && ed)) return "";
    return secao(T("Janela.ReliquiasEArtefatosSagrados"), "fa-solid fa-gem",
      `<div class="jm-premio-itens">${lista.join("")}</div>${gm && ed ? `<div class="jm-soltar jm-premio-drop"><i class="fa-solid fa-hand-holding-heart"></i> ${T("Janela.ArrasteItensAquiReliquiasArmas")}</div>` : ""}`,
      "", gm && ed ? `data-drop="reliquia"` : "", "", "reliquias");
  }

  /** Mostra uma página nativa do Foundry (núcleo e dnd5e). */
  async _paginaNativa(p) {
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

  /** Recompensas no formato do Monk's: grupos com XP, moedas e itens (itens, talentos ou magias). */
  async _secaoRecompensas(a, ed, secao, enr) {
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

  _notas(page, secao) {
    if (!page) return "";
    const nota = page.flags?.[MOD]?.[CHAVE_DADOS]?.notas?.[game.user.id] ?? "";
    return secao(`${T("Janela.MinhasNotas")} <small>${T("Janela.Pessoais")}</small>`, "fa-solid fa-feather",
      `<textarea data-nota rows="4" placeholder="${T("Janela.SuasSuspeitasNomesPistas")}">${esc(String(nota).replace(/<\/?p>/g, ""))}</textarea>`, "jm-notas");
  }

  /** Lista de itens de estoque usada pela loja e pelo baú. */
  async _listaItens(m, ed, modo, x = null) {
    const gm = ehGM();
    const linhas = [];
    for (const [id, it] of comoLista(m.items)) {
      if (!gm && it.hidden) continue;
      const f = it.flags?.[MOD] ?? {};
      const qtd = qtdDoItem(it);
      const preco = precoDoItem(it);
      const esgotado = modo === "loja" && (qtd === 0 || it.lock);
      const origem = it.flags?.[MOD]?.origem;
      const nome = origem ? await TE().enrichHTML(`@UUID[${origem}]{${String(it.name).replace(/[{}]/g, "")}}`) : esc(it.name);
      const de = f.de ? `<small class="jm-de">${esc(f.de)}</small>` : "";
      let colPreco, colQtd, acao;
      if (modo === "loja") {
        const neg = x ? negociacaoDeHoje(x, game.user.id, `c_${id}`) : null;
        const mult = neg?.mult;
        const precoFinal = mult != null ? Math.round(preco * mult * 100) / 100 : preco;
        const etiqueta = mult != null && mult !== 1
          ? `<small class="jm-ajuste ${mult < 1 ? "bom" : "ruim"}">${mult < 1 ? "−" : "+"}${Math.round(Math.abs(1 - mult) * 100)}%</small>` : "";
        colPreco = ed ? `<input type="number" step="0.01" min="0" data-item-campo="preco" data-id="${id}" value="${Math.round(preco * 100) / 100}" data-tooltip="${T("Janela.PrecoEmPo")}">`
          : (mult != null && mult !== 1 ? `<s>${formatarPreco(preco)}</s> ${formatarPreco(precoFinal)}${etiqueta}` : formatarPreco(preco));
        colQtd = gm ? `<input type="number" min="0" class="jm-estoque" data-item-campo="quantidade" data-id="${id}" value="${qtd ?? ""}" placeholder="∞" data-tooltip="${T("Janela.EstoqueDaLojaVazioIlimitado")}">`
          : (qtd === 0 ? T("Janela.Esgotado") : (qtd == null ? T("Janela.AVontade") : `${qtd} ${T("Janela.Un")}`));
        const pendente = neg && mult == null;
        const botaoNeg = esgotado || neg ? (pendente ? `<span class="jm-neg-pendente" data-tooltip="${T("Janela.PechinchaEmAndamentoNoChat")}"><i class="fa-solid fa-hourglass-half"></i></span>` : "")
          : `<button type="button" class="sec" data-action="negociarCompra" data-id="${id}" data-nome="${esc(it.name)}" data-tooltip="${T("Janela.PechincharPersuasaoContraOVendedor")}"><i class="fa-solid fa-handshake"></i></button>`;
        acao = botaoNeg + (esgotado || ed ? "" : `<input type="number" class="jm-qtd" min="1" ${typeof qtd === "number" ? `max="${qtd}"` : ""} value="1" data-tooltip="${T("Janela.Quantidade")}">`) +
          `<button type="button" class="primario" data-action="comprarSemanal" data-id="${id}" ${esgotado ? "disabled" : ""}><i class="fa-solid fa-coins"></i> ${T("Janela.Comprar")}</button>`;
      } else {
        colPreco = `<span class="jm-valor">${formatarPreco(preco)}</span>`;
        colQtd = `${Number(it.system?.quantity) || 1}×`;
        acao = `<button type="button" class="primario" data-action="pegar" data-id="${id}"><i class="fa-solid fa-hand"></i> ${T("Janela.Pegar")}</button>`;
      }
      linhas.push(`<div class="jm-produto ${esgotado ? "esgotado" : ""} ${it.hidden ? "oculto" : ""}">
        <img src="${esc(it.img)}" alt="">
        <div class="nome">${nome}${de}</div>
        <div class="preco">${colPreco}</div>
        <div class="qtd">${colQtd}</div>
        <div class="acoes">${acao}
          ${gm ? `<a class="jm-mini-btn" data-action="ocultarItemLoja" data-id="${id}" data-tooltip="${it.hidden ? T("Janela.OcultoDosJogadores") : T("Janela.VisivelAosJogadores")}"><i class="fa-solid ${it.hidden ? "fa-eye-slash" : "fa-eye"}"></i></a>` : ""}
          ${gm ? `<a class="jm-mini-btn" data-action="removerItemLoja" data-id="${id}" data-tooltip="${T("Janela.Remover")}"><i class="fa-solid fa-trash"></i></a>` : ""}
        </div></div>`);
    }
    return linhas;
  }

  async _secaoLoja(entry, a, ed, secao) {
    const { m, x } = a;
    const gm = ehGM();
    const fechada = textoHorarioLoja(entry);
    if (fechada && !fechada.aberta && !gm) {
      const h = horarioLoja(entry);
      return secao(T("Janela.Balcao"), "fa-solid fa-store", `<div class="jm-loja-fechada"><i class="fa-solid fa-door-closed"></i>
        <b>${fechada.texto === T("Comum.FolgaHoje") ? T("Janela.ALojaEstaDeFolga") : T("Janela.ALojaEstaFechada")}</b>
        <span>${h.abre !== h.fecha ? `${T("Janela.FuncionaDas")} ${minParaHora(h.abre)} ${T("Janela.As")} ${minParaHora(h.fecha)}` : ""}${h.folga.length ? ` · ${T("Janela.Folga")}: ${h.folga.map((i) => Tempo.semana()[i] ?? "?").join(", ")}` : ""}</span></div>`, "jm-loja");
    }
    const sub = this.subLoja;
    const tabs = [["semanal", T("Comum.EstoqueDaSemana"), "fa-solid fa-calendar-week"], ["diaria", T("Janela.OfertaDoDia"), "fa-solid fa-sun"], ["vender", T("Janela.Vender"), "fa-solid fa-hand-holding-dollar"]];
    if (gm) tabs.push(["config", T("Janela.Configurar"), "fa-solid fa-sliders"]);
    const nav = `<div class="jm-subabas">${tabs.map(([k, r, i]) => `<button type="button" class="${sub === k ? "ativo" : ""}" data-action="subLoja" data-sub="${k}"><i class="${i}"></i> ${r}</button>`).join("")}</div>`
      + (gm && fechada && !fechada.aberta ? `<div class="jm-aviso-loja"><i class="fa-solid fa-door-closed"></i> ${esc(fechada.texto)}: ${T("Janela.OsJogadoresNaoConseguemComprar")}</div>` : "");
    const tabelas = tabelasDasLojas([x.semanal.tabela, x.diaria.tabela]);
    /* sem tabela própria: a padrão das configurações do módulo (Tabelas de itens das lojas) */
    const vazioTabela = (tipo) => { const p = tabelaDaLoja("", tipo); return p ? `— ${T("Comum.Padrao")}: ${nomeTabela(p) || "?"} —` : T("Janela.EscolhaUmaTabela"); };
    const linkItem = async (uuid, nome) => uuid ? await TE().enrichHTML(`@UUID[${uuid}]{${String(nome).replace(/[{}]/g, "")}}`) : esc(nome);
    let corpo = "";

    if (sub === "semanal") {
      const barra = gm ? `<div class="jm-barra">
          <label>${T("Janela.Tabela")} <select data-campo="x:semanal.tabela">${opcoes(tabelas, x.semanal.tabela, vazioTabela("semanal"))}</select></label>
          <label class="curto">${T("Janela.Itens")} <input type="number" min="1" max="40" data-campo="x:semanal.qtd" data-num value="${x.semanal.qtd}"></label>
          <button type="button" class="primario" data-action="rolarSemanal"><i class="fa-solid fa-dice"></i> ${T("Janela.RenovarEstoque")}</button>
          <button type="button" class="sec" data-action="exportarItens" data-tooltip="${T("Janela.CopiarOsItensParaA")}"><i class="fa-solid fa-file-export"></i></button>
          <button type="button" class="sec" data-action="limparSemanal" data-tooltip="${T("Janela.EsvaziarEstoque")}"><i class="fa-solid fa-broom"></i></button>
        </div>` : "";
      const linhas = await this._listaItens(m, ed, "loja", x);
      const vazio = `<p class="jm-vazio">${gm ? T("Janela.EstoqueVazioRenovePelaTabela") : T("Janela.AsPrateleirasEstaoVaziasEsta")}</p>`;
      corpo = barra + `<div class="jm-produtos" ${gm ? `data-drop="itemLoja"` : ""}>${linhas.join("") || vazio}
        ${gm && linhas.length ? `<p class="jm-dica">${T("Janela.ArrasteItensParaCaPara")}</p>` : ""}</div>`;
    }

    if (sub === "diaria") {
      const dia = diaAtual();
      const minha = x.diaria.ofertas[game.user.id];
      let topo;
      if (minha && minha.dia === dia) topo = await this._cartaOferta(minha, false, linkItem);
      else if (tabelaDaLoja(x.diaria.tabela, "diaria")) topo = `<div class="jm-rolar">
          <p>${T("Janela.OBalcaoMudaTodoDia")} <b>${T("Janela.Achado")}</b>, ${T("Janela.Uma")} <b>${T("Janela.Raridade")}</b>... ${T("Janela.OuUm")} <b>${T("Janela.Escambo")}</b> ${T("Janela.BaratoDemaisParaSerVerdade")}</p>
          <button type="button" class="primario grande" data-action="rolarDiaria"><i class="fa-solid fa-dice-d20"></i> ${T("Janela.RolarOfertaDoDia")}</button>
        </div>`;
      else topo = `<p class="jm-vazio">${gm ? T("Janela.DefinaATabelaDasOfertas") : T("Janela.HojeNaoHaOfertasEspeciais")}</p>`;
      let outras = "";
      if (gm) {
        const lista = Object.entries(x.diaria.ofertas).filter(([u, o]) => u !== game.user.id && o?.dia === dia);
        const cartas = [];
        for (const [u, o] of lista) cartas.push(`<div class="jm-oferta-de"><span><i class="fa-solid fa-user"></i> ${esc(game.users.get(u)?.name ?? "?")}</span>${await this._cartaOferta(o, true, linkItem, u)}</div>`);
        outras = `<h4 class="jm-h4">${T("Janela.OfertasDosJogadoresHoje")}</h4>${cartas.join("") || `<p class="jm-vazio">${T("Janela.NinguemRolouAindaHoje")}</p>`}`;
      }
      corpo = `<div class="jm-dia-info"><i class="fa-solid fa-sun"></i> ${T("Comum.Dia2")} ${dia}</div>${topo}${outras}`;
    }

    if (sub === "vender") {
      const ator = atorDoJogador();
      if (!ator) corpo = `<p class="jm-vazio">${T("Janela.SelecioneSeuTokenOuDefina2")}</p>`;
      else {
        const vendiveis = ator.items.filter((i) => TIPOS_SAQUE.includes(i.type) && precoEmPo(i) > 0)
          .sort((a2, b2) => a2.name.localeCompare(b2.name, game.i18n.lang));
        const padrao = multVendaPadrao(x);
        const linhas = vendiveis.map((it) => {
          const base = precoEmPo(it);
          const neg = negociacaoDeHoje(x, game.user.id, `v_${it.id}`);
          const mult = neg?.mult ?? padrao;
          const oferta = Math.round(base * mult * 100) / 100;
          const qtd = Number(it.system?.quantity) || 1;
          const pendente = neg && neg.mult == null;
          return `<div class="jm-produto venda">
            <img src="${esc(it.img)}" alt="">
            <div class="nome">${esc(it.name)}<small class="jm-de">${T("Janela.Vale")} ${formatarPreco(base)} ${T("Janela.Cada")}${qtd > 1 ? ` · ${T("Janela.VoceTem")} ${qtd}` : ""}</small></div>
            <div class="preco">${formatarPreco(oferta)}<small class="jm-ajuste ${neg?.mult != null ? (mult >= padrao ? "bom" : "ruim") : ""}">${Math.round(mult * 100)}%</small></div>
            <div class="qtd">${neg?.mult != null ? `<i class="fa-solid fa-handshake" data-tooltip="${T("Janela.JaNegociadoHoje")}"></i>` : ""}</div>
            <div class="acoes">
              ${pendente ? `<span class="jm-neg-pendente" data-tooltip="${T("Janela.PechinchaEmAndamentoNoChat")}"><i class="fa-solid fa-hourglass-half"></i></span>`
                : (neg ? "" : `<button type="button" class="sec" data-action="negociarVenda" data-id="${it.id}" data-nome="${esc(it.name)}" data-tooltip="${T("Janela.PechincharPersuasaoContraOVendedor")}"><i class="fa-solid fa-handshake"></i></button>`)}
              ${qtd > 1 ? `<input type="number" class="jm-qtd" min="1" max="${qtd}" value="1" data-tooltip="${T("Janela.QuantosVender")}">` : ""}
              <button type="button" class="primario" data-action="vender" data-id="${it.id}"><i class="fa-solid fa-hand-holding-dollar"></i> ${T("Janela.Vender")}</button>
            </div></div>`;
        });
        const t = tabelaNegocio(x, "venda");
        corpo = `<div class="jm-dica jm-venda-dica"><i class="fa-solid fa-circle-info"></i> ${T("Janela.ALojaPaga")} <b>${t.empate}%</b> ${T("Janela.DoValorPechinchandoSeVoce")}, ${t.venceJ}${T("Janela.Critico")}: ${t.critJ}${T("Janela.SeOVendedorVencer")}, ${t.venceN}${T("Janela.CriticoDele")}: ${t.critN}${T("Janela.UmaTentativaPorItemPor")}</div>
          <div class="jm-produtos">${linhas.join("") || `<p class="jm-vazio">${esc(ator.name)} ${T("Janela.NaoTemNadaQueEsta")}</p>`}</div>`;
      }
    }

    if (sub === "config" && gm) {
      const ch = x.diaria.chances;
      const npc = await atorDoDono(x.dono);
      const h = horarioLoja(entry);
      const semana = Tempo.semana();
      corpo = `<div class="jm-config">
        <div class="jm-config-horario">
          <h4><i class="fa-solid fa-clock"></i> ${T("Janela.Horario")}</h4>
          <label class="jm-check"><input type="checkbox" data-campo="x:horario.ativo" ${h?.ativo ? "checked" : ""}> ${T("Janela.RespeitarHorarioEFolgasFechada")}</label>
          <div class="jm-sub-linha ${h?.ativo ? "" : "desligado"}">
            <label class="jm-sub-campo">${T("Janela.Abre")} <input type="text" data-horario="opening" value="${minParaHora(h?.abre ?? 480)}" placeholder="08:00"></label>
            <label class="jm-sub-campo">${T("Janela.Fecha")} <input type="text" data-horario="closing" value="${minParaHora(h?.fecha ?? 1020)}" placeholder="17:00"></label>
            <span class="jm-dica">${T("Janela.FecharAntesDeAbrirVira")}</span>
          </div>
          ${semana.length ? `<div class="jm-cal-semana jm-folgas ${h?.ativo ? "" : "inativo"}"><span>${T("Janela.Folga2")}:</span>${semana.map((nome, i) =>
            `<label class="jm-dia-sem ${h?.folga.includes(i) ? "marcado" : ""}"><input type="checkbox" data-folga="${i}" ${h?.folga.includes(i) ? "checked" : ""}>${esc(nome)}</label>`).join("")}</div>` : ""}
        </div>
        <div class="jm-config-negocio">
          <label>${T("Janela.PericiaDoVendedorNasPechinchas")} <select data-campo="x:vendedorPericia">${Object.entries(PERICIAS_VENDEDOR).map(([k, r]) => `<option value="${k}" ${k === x.vendedorPericia ? "selected" : ""}>${r}</option>`).join("")}</select></label>
          ${npc ? `<p class="jm-dica">${T("Janela.UsaAFichaDe")} <b>${esc(npc.name)}</b> (${bonusPericia(npc, x.vendedorPericia) >= 0 ? "+" : ""}${bonusPericia(npc, x.vendedorPericia)}).</p>`
            : `<label class="curto">${T("Janela.BonusDoVendedor")} <input type="number" data-campo="x:vendedorBonus" data-num value="${Number(x.vendedorBonus) || 0}"></label>
               <p class="jm-dica">${T("Janela.ODonoDaLojaNao")}</p>`}
        </div>
        ${["compra", "venda"].map((modo) => {
          const t = tabelaNegocio(x, modo);
          return `<div class="jm-tabela-negocio">
            <h4><i class="fa-solid ${modo === "compra" ? "fa-coins" : "fa-hand-holding-dollar"}"></i> ${T("Janela.PechinchaNa")} ${modo === "compra" ? T("Janela.Compra") : T("Janela.Venda")}
              <small>${modo === "compra" ? T("Janela.SomadoAoPrecoNegativoDesconto") : T("Janela.DoValorQueALoja")}</small></h4>
            <div class="jm-chances cinco">
              ${RESULTADOS.map(([k, r, cor]) => `<label><span class="jm-tag ${cor}">${r}</span>
                <span class="jm-pct"><input type="number" step="1" data-campo="x:negocio.${modo}.${k}" data-num value="${t[k]}"><b>%</b></span></label>`).join("")}
            </div></div>`;
        }).join("")}
        <label>${T("Janela.TabelaDasOfertasDiarias")} <select data-campo="x:diaria.tabela">${opcoes(tabelas, x.diaria.tabela, vazioTabela("diaria"))}</select></label>
        <div class="jm-chances">
          ${Object.entries(OFERTAS).map(([k, o]) => `<label><span class="jm-tag ${k}">${o.rotulo}</span><small>${o.desc}</small>
            <input type="number" min="0" data-campo="x:diaria.chances.${k}" data-num value="${ch[k]}"> ${T("Janela.Peso")}</label>`).join("")}
        </div>
        <label>${T("Janela.CustosOcultosDoEscambo")} <small>(${T("Janela.UmPorLinhaSorteadoE")})</small>
          <textarea data-campo="x:diaria.custos" rows="6">${esc(x.diaria.custos)}</textarea></label>
        <p class="jm-dica">${T("Janela.OPrecoBaseVemDo")} <i class="fa-solid fa-forward"></i> ${T("Janela.NaLateral")}</p>
      </div>`;
    }

    return secao(T("Janela.Balcao"), "fa-solid fa-store", nav + corpo, "jm-loja");
  }

  async _secaoBau(entry, a, ed, secao) {
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
    const linhas = await this._listaItens(m, ed, "bau");
    const vazio = `<p class="jm-vazio">${gm ? T("Janela.BauVazioArrasteItensPara") : T("Janela.OBauEstaVazio")}</p>`;
    return secao(T("Janela.ConteudoDoBau"), "fa-solid fa-box-open",
      campoMoedas + barra + `<div class="jm-produtos" ${gm ? `data-drop="itemLoja"` : ""}>${linhas.join("") || vazio}</div>`, "jm-bau");
  }

  async _cartaOferta(o, visaoGM, linkItem, userId = "") {
    const cfg = OFERTAS[o.tipo] ?? OFERTAS.achado;
    let extra = "";
    if (o.tipo === "escambo") extra = visaoGM
      ? `<div class="jm-custo"><i class="fa-solid fa-skull"></i> ${T("Janela.CustoOculto")}: ${esc(o.custoOculto)}</div>`
      : (o.comprado
        ? `<div class="jm-custo misterio"><i class="fa-solid fa-handshake"></i> ${T("Janela.AcordoFechadoOQueEle")}</div>`
        : `<div class="jm-custo misterio"><i class="fa-solid fa-question"></i> ${T("Janela.OVendedorSorriUmPouco")}</div>`);
    const riscado = o.tipo !== "luxo" && o.precoBase > o.preco ? `<s>${formatarPreco(o.precoBase)}</s>` : "";
    let acao;
    if (o.comprado) acao = `<span class="jm-comprado"><i class="fa-solid fa-check"></i> ${T("Janela.Comprado")}</span>`;
    else if (visaoGM) acao = `<button type="button" class="sec" data-action="limparOferta" data-user="${userId}" data-tooltip="${T("Janela.PermitirQueRoleDeNovo")}"><i class="fa-solid fa-rotate"></i></button>`;
    else acao = `<button type="button" class="primario" data-action="comprarDiaria"><i class="fa-solid fa-coins"></i> ${T("Janela.Comprar")}</button>`;
    return `<div class="jm-oferta ${o.tipo} ${o.comprado ? "comprada" : ""}">
      <img src="${esc(o.img)}" alt="">
      <div class="info">
        <span class="jm-tag ${o.tipo}">${cfg.rotulo}</span>
        <div class="nome">${await linkItem(o.uuid, o.nome)}</div>
        <small>${cfg.desc}</small>
        <div class="preco">${riscado} <b>${formatarPreco(o.preco)}</b></div>
        ${extra}
      </div>
      <div class="acao">${acao}</div>
    </div>`;
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

  /* Editor da descrição. O texto é gravado 400 ms depois da última tecla; se a janela for redesenhada nesse
   * meio-tempo, o texto pendente é gravado na hora e o editor novo já nasce com ele (nada digitado se perde). */
  _montarEditor(alvo) {
    const { page } = analisar(this._entry());
    if (!page) return;
    const pend = this._editorPendente;
    const html = pend?.pageId === page.id ? pend.valor : (page.text?.content ?? "");
    let timer = null;
    const gravar = async (valor) => {
      try { await page.update({ "text.content": valor }); }
      catch (err) { relatarErro(T("Janela.SalvarADescricao"), err); }
      finally { if (this._editorPendente?.valor === valor) this._editorPendente = null; }
    };
    const salvar = (valor) => {
      this._editorPendente = { pageId: page.id, valor };
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; gravar(valor); }, 400);
    };
    this._descarregarEditor = () => {
      if (!timer) return;
      clearTimeout(timer); timer = null;
      if (this._editorPendente?.pageId === page.id) gravar(this._editorPendente.valor);
    };
    this.editorAtivo = true;
    try {
      if (game.settings.get(MOD, "editor") === "simples") throw new Error(T("Janela.ModoSimples"));
      const PM = foundry.applications?.elements?.HTMLProseMirrorElement;
      if (!PM?.create) throw new Error(T("Janela.SemProseMirror"));
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
    this._ouvintesRegras(root);
    Jornal.ouvintes(this, root);
    root.querySelectorAll("[data-campo]").forEach((el) => el.addEventListener("change", () => this._salvarCampo(el)));

    const editor = root.querySelector("[data-editor]");
    if (editor) this._montarEditor(editor);
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

    /* seletores de data: dia/mês/ano → td, entregue para quem usa (calendário, prazo, dia sagrado) */
    root.querySelectorAll("[data-data]").forEach((caixa) => caixa.querySelectorAll("[data-parte]").forEach((el) => el.addEventListener("change", () => {
      const val = (k) => Number(caixa.querySelector(`[data-parte="${k}"]`)?.value);
      const td = Tempo.tdDe(val("ano"), val("mes"), val("dia"));
      if (td == null) return ui.notifications.warn(T("Comum.EssaDataNaoExisteNeste"));
      this._aoEscolherData(caixa.dataset.data, td, caixa);
    })));

    root.querySelector("[data-historia]")?.addEventListener("change", (ev) => {
      const e = this._entry(); if (!e) return;
      e.update({ [`flags.${MOD}.historia`]: ev.target.value });
    });
    root.querySelector(".jm-cal-icones")?.addEventListener("toggle", (ev) => { this.iconesAbertos = ev.target.open; });
    root.querySelectorAll("[data-hist-ed]").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) this.histAbertos.add(d.dataset.histEd); else this.histAbertos.delete(d.dataset.histEd);
    }));
    root.querySelectorAll("[data-hist-campo]").forEach((el) => el.addEventListener("change", () => {
      const p = this._entry()?.pages.get(el.dataset.page);
      if (p) p.update({ [`flags.${MOD}.acontecimento.${el.dataset.histCampo}`]: el.value });
    }));
    const conexoes = root.querySelector(".jm-conexoes");
    if (conexoes) {
      conexoes.querySelector("[data-con-busca-campo]")?.addEventListener("input", (ev) => {
        this.conFiltro = { tipo: this.conFiltro?.tipo ?? "", texto: ev.target.value };
        this._filtrarConexoes(conexoes);
      });
      this._filtrarConexoes(conexoes);
      const ligar = conexoes.querySelector("[data-ligar-filtro]");
      if (ligar) {
        ligar.querySelector("[data-link-busca]").addEventListener("input", () => this._filtrarLigar(conexoes));
        ligar.querySelector("[data-link-tipo]").addEventListener("change", () => this._filtrarLigar(conexoes));
        ligar.querySelector("[data-link-busca]").addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter") return;
          ev.preventDefault();
          conexoes.querySelector("[data-novo-rotulo]")?.focus();
        });
      }
    }

    root.querySelectorAll("[data-cal-campo]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.calCampo;
      let v = el.value;
      if (k === "hora" && v && !/^\d{1,2}:\d{2}$/.test(v.trim())) return ui.notifications.warn(T("Janela.UseOFormatoHHMM2"));
      if (["cada", "duracao", "fim.vezes"].includes(k)) v = Math.max(1, Math.trunc(Number(v) || 1));
      const e = this._entry();
      const n = calNormalizar(calNota(e));
      if (k.startsWith("fim.")) return calSalvar(e, { fim: { ...n.fim, [k.split(".")[1]]: v } });
      calSalvar(e, { [k]: typeof v === "string" ? v.trim() : v });
    }));
    root.querySelectorAll("[data-nexus] [data-nexus-campo]").forEach((el) => el.addEventListener("change", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const k = el.dataset.nexusCampo;
      if (k === "valor") return Nexus.definir(id, el.value);
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === id);
      if (!nx) return;
      nx[k] = el.value;
      await Nexus.salvar(l);
    }));
    root.querySelectorAll("[data-nexus] [data-nexus-alternar]").forEach((el) => el.addEventListener("click", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === id);
      if (!nx) return;
      nx[el.dataset.nexusAlternar] = !nx[el.dataset.nexusAlternar];
      await Nexus.salvar(l);
    }));
    root.querySelectorAll("[data-limiar] [data-limiar-campo]").forEach((el) => el.addEventListener("change", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const lid = el.closest("[data-limiar]").dataset.limiar;
      const l = Nexus.lista();
      const lim = l.find((n) => n.id === id)?.limiares?.find((x2) => x2.id === lid);
      if (!lim) return;
      const k = el.dataset.limiarCampo;
      lim[k] = el.type === "checkbox" ? el.checked : (k === "v" ? Math.max(0, Math.min(100, Number(el.value) || 0)) : el.value);
      if (k === "v") lim.disparado = (Number(l.find((n) => n.id === id).valor) || 0) < lim.v;
      await Nexus.salvar(l);
    }));

    root.querySelectorAll("[data-horario]").forEach((el) => el.addEventListener("change", async () => {
      const min = horaParaMin(el.value);
      if (min == null) return ui.notifications.warn(T("Janela.UseOFormatoHHMM"));
      await dadosSet(analisar(this._entry()).page, el.dataset.horario, min);
    }));
    /* dias de folga: sempre clicáveis (antes ficavam travados com o horário desligado, sem nenhum aviso).
     * Marcar uma folga com o horário desligado liga "Respeitar horário e folgas", senão a folga não valeria. */
    root.querySelectorAll("[data-folga]").forEach((el) => el.addEventListener("change", async () => {
      const dias = [...root.querySelectorAll("[data-folga]:checked")].map((x2) => Number(x2.dataset.folga));
      const page = analisar(this._entry()).page;
      const ligar = dias.length && !page.flags?.[MOD]?.horario?.ativo;
      await page.update({ [`flags.${MOD}.horario.folga`]: dias, ...(ligar ? { [`flags.${MOD}.horario.ativo`]: true } : {}) });
      if (ligar) ui.notifications.info(T("Janela.HorarioEFolgasLigadosNesta"));
    }));

    root.querySelectorAll("[data-cal-semana]").forEach((el) => el.addEventListener("change", () => {
      const e = this._entry();
      const dias = [...root.querySelectorAll("[data-cal-semana]:checked")].map((x) => Number(x.dataset.calSemana));
      if (!dias.length) { el.checked = true; return ui.notifications.warn(T("Janela.EscolhaPeloMenosUmDia")); }
      calSalvar(e, { diasSemana: dias });
    }));

    root.querySelectorAll("[data-obj-texto]").forEach((el) => el.addEventListener("change", async () => {
      const { page } = analisar(this._entry());
      await garantirObjeto(page, "objectives");
      await dadosSet(page, `objectives.${el.dataset.id}.content`, el.value);
    }));

    root.querySelectorAll("[data-item-campo]").forEach((el) => el.addEventListener("change", async () => {
      const { page } = analisar(this._entry());
      await garantirObjeto(page, "items");
      const base = `items.${el.dataset.id}.flags.${MOD}`;
      if (el.dataset.itemCampo === "preco") await dadosSet(page, `${base}.preco`, arredondarPo(el.value));
      else if (el.value === "") await dadosUnset(page, `${base}.qtd`);
      else await dadosSet(page, `${base}.qtd`, Math.max(0, Number(el.value) || 0));
    }));

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

    /* busca dentro do PDF (usa o leitor de PDF do próprio Foundry) */
    root.querySelectorAll("[data-pdf]").forEach((barra) => {
      const iframe = barra.nextElementSibling;
      const campo = barra.querySelector("[data-pdf-busca]");
      const contagem = barra.querySelector("[data-pdf-contagem]");
      let ligado = false;
      const app = () => { try { return iframe.contentWindow?.PDFViewerApplication ?? null; } catch { return null; } };
      const buscar = async (tipo = "", anterior = false) => {
        const pdf = app();
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
    try {
      const f = await Folder.implementation.createDialog({ type: "JournalEntry", folder: pai ?? null });
      if (f) { this.pastaAlvo = f.id; if (pai) { const ab = this.abertas; ab.add(pai); this._setAbertas(ab); } }
    } catch (err) {
      avisoUmaVez(T("Janela.JanelaDeNovaPasta"), err);
      const f = await Folder.create({ name: T("Janela.NovaPasta"), type: "JournalEntry", folder: pai ?? null });
      f?.sheet.render(true);
    }
  }

  async _salvarCampo(el) {
    const e = this._entry(); if (!e) return;
    const { page } = analisar(e);
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
    if (escopo === "m") {
      const raiz = chave.split(".")[0];
      if (["rewards", "items", "objectives", "relationships"].includes(raiz)) await garantirObjeto(page, raiz);
      if (chave === "status") {
        const fim = ["completed", "failed"].includes(v);
        await page.update({ [`flags.${MOD}.concluidaEm`]: fim ? Tempo.hoje() : null });
        if (fim) Sessao.registrar("missao", `${T("Janela.Missao")} <b>${esc(e.name)}</b>: ${esc(STATUS[v]?.rotulo ?? v)}.`);
      }
      return dadosSet(page, chave, v);
    }
    await page.setFlag(MOD, chave, v);
    if (chave === "doador") await dadosSet(page, "source", game.journal.get(v)?.name ?? "");
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

    if (tipo === "festa") {
      const alvo = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
      if (alvo?.documentName !== "JournalEntry" || alvo.id === e.id) return ui.notifications.warn(T("Janela.ArrasteUmEventoPaginaDo"));
      return this._tornarDiaSagrado(e, alvo);
    }
    if (tipo === "link") {
      if (doc.documentName === "Actor") return this._ligarFicha(page, doc, "");
      if (doc.documentName !== "JournalEntry" || doc.id === e.id) return ui.notifications.warn(T("Janela.ArrasteUmaPaginaDoJournal"));
      return this._ligar(e, page, doc, "");
    }
    if (tipo === "ator") {
      if (doc.documentName !== "Actor") return ui.notifications.warn(T("Janela.ArrasteUmAtor"));
      await dadosSet(page, "actor", doc.uuid);
      if (!page.src) await page.update({ src: doc.img });
      return;
    }
    if (tipo === "reliquia") {
      if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItem"));
      const atuais = analisar(e).x.deus.reliquias ?? [];
      if (!atuais.includes(doc.uuid)) await page.setFlag(MOD, "deus.reliquias", [...atuais, doc.uuid]);
      return;
    }
    if (tipo === "recompensa") {
      if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItemTalentoOu"));
      await garantirObjeto(page, "rewards");
      await garantirObjeto(page, "items");
      const gid = el.dataset.grupo;
      const data2 = itemParaLoja(doc, {}, 1);
      await dadosSet(page, `items.${data2._id}`, data2);
      const ids = dadosGet(page, `rewards.${gid}.itemIds`) ?? [];
      await dadosSet(page, `rewards.${gid}.itemIds`, [...ids, data2._id]);
      return;
    }
    if (tipo === "itemLoja") {
      if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItem"));
      await garantirObjeto(page, "items");
      const data2 = itemParaLoja(doc, {}, analisar(e).tipo === "loot" ? null : 1);
      await dadosSet(page, `items.${data2._id}`, data2);
    }
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

  async _ligar(entry, page, outro, rotulo) {
    await garantirObjeto(page, "relationships");
    await dadosSet(page, `relationships.${outro.id}`, { id: outro.id, uuid: outro.uuid, hidden: false, relationship: rotulo });
    const outroPage = analisar(outro).page;
    if (outroPage && !comoLista(dadosGet(outroPage, "relationships")).some(([id, r]) => (r.id ?? id) === entry.id)) {
      await garantirObjeto(outroPage, "relationships");
      await dadosSet(outroPage, `relationships.${entry.id}`, { id: entry.id, uuid: entry.uuid, hidden: false });
    }
  }

  /** Liga uma ficha de personagem (ator) à página. */
  async _ligarFicha(page, ator, rotulo) {
    if (!page) return;
    if (fichasDe(page).some(([id]) => id === ator.id)) return ui.notifications.info(`"${ator.name}" ${T("Janela.JaEstaLigadoAqui")}`);
    await page.update({ [`flags.${MOD}.fichas.${ator.id}`]: { uuid: ator.uuid, relacao: rotulo, hidden: false } });
  }

  _precisaAtor() {
    const ator = atorDoJogador();
    if (!ator) ui.notifications.warn(T("Janela.SelecioneSeuTokenOuDefina"));
    return ator;
  }

  /* ---------- ações (this = janela) ---------- */

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

  static async _novaPagina(ev, el) {
    const e = this._entry();
    const tipo = el.dataset.tipo;
    const [p] = await e.createEmbeddedDocuments("JournalEntryPage", [{
      name: nomeDoTipoDePagina(tipo), type: tipo,
      sort: (e.pages.contents.reduce((mx, pg) => Math.max(mx, pg.sort), 0) || 0) + 100000
    }]);
    p?.sheet.render(true);
  }

  static _editarPagina(ev, el) { this._entry()?.pages.get(el.dataset.page)?.sheet.render(true); }
  static async _apagarPagina(ev, el) { await this._entry()?.pages.get(el.dataset.page)?.deleteDialog(); }

  static async _abrirAtor() {
    const link = analisar(this._entry()).m.actor;
    const ator = typeof link === "string" ? await fromUuid(link) : (link?.uuid ? await fromUuid(link.uuid) : game.actors.get(link?.id));
    ator?.sheet.render(true);
  }

  static async _abrirFicha(ev, el) {
    const ator = await fromUuid(el.dataset.uuid);
    if (!ator) return ui.notifications.warn(T("Janela.EssaFichaNaoExisteMais"));
    if (!ehGM() && !ator.testUserPermission(game.user, "LIMITED")) return ui.notifications.warn(T("Janela.VoceNaoTemAcessoA"));
    ator.sheet.render(true);
  }
  static async _ocultarFicha(ev, el) {
    const { page } = analisar(this._entry());
    const atual = !!page.flags?.[MOD]?.fichas?.[el.dataset.id]?.hidden;
    await page.update({ [`flags.${MOD}.fichas.${el.dataset.id}.hidden`]: !atual });
  }
  static async _removerFicha(ev, el) {
    const { page } = analisar(this._entry());
    await apagarChave(page, `flags.${MOD}.fichas`, el.dataset.id);
  }

  static async _limparAtor() { await dadosUnset(analisar(this._entry()).page, "actor"); }

  static async _adicionarLink(ev, el) {
    const raiz = el.closest(".jm-add-link");
    const id = raiz.querySelector("[data-novo-link]").value;
    const rotulo = raiz.querySelector("[data-novo-rotulo]").value.trim();
    if (!id) return ui.notifications.warn(T("Janela.EscolhaUmaPaginaOuFicha2"));
    const e = this._entry();
    if (id.startsWith("ficha:")) {
      const ator = await fromUuid(id.slice(6));
      return ator ? this._ligarFicha(analisar(e).page, ator, rotulo) : ui.notifications.warn(T("Janela.EssaFichaNaoExisteMais"));
    }
    await this._ligar(e, analisar(e).page, game.journal.get(id), rotulo);
  }

  static async _removerLink(ev, el) {
    const e = this._entry(); const { page } = analisar(e);
    const id = el.dataset.id;
    await garantirObjeto(page, "relationships");
    await dadosUnset(page, `relationships.${id}`);
    const outroPage = game.journal.get(id) ? analisar(game.journal.get(id)).page : null;
    if (dadosGet(outroPage, `relationships.${e.id}`)) await dadosUnset(outroPage, `relationships.${e.id}`);
  }

  static async _ocultarLink(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "relationships");
    const atual = !!dadosGet(page, `relationships.${el.dataset.id}.hidden`);
    await dadosSet(page, `relationships.${el.dataset.id}.hidden`, !atual);
  }

  static _subLoja(ev, el) { this.subLoja = el.dataset.sub; this.render(); }
  static _subDeus(ev, el) { this.subDeus = el.dataset.sub; this.render(); }

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
  static _calAdicionar() { calSalvar(this._entry(), {}); }

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
  /** Botões do Jornal de Notícias (data-op diz qual). */
  static _jornal(ev, el) { return Jornal.acao(this, el.dataset.op, el, ev); }
  static _linhaFiltro(ev, el) { this.filtroLinha = el.dataset.filtro; this.render(); }

  /* ---- História ---- */
  static async _histNovo() {
    const r = await registrarNaHistoria({ historiaId: this.ativa });
    if (!r) return;
    if (r.entry.id !== this.ativa) return this.abrirPagina(r.entry.id, { pagina: r.page.id });
    this._rolarPara = { pagina: r.page.id };
    this.render();
  }
  static _histOrdem() { this.histDesc = !this.histDesc; this.render(); }
  static _histLinha(ev, el) {
    const td = el.dataset.td != null ? Number(el.dataset.td) : null;
    this.abrirLinha(td, td != null ? "tudo" : "historia");
  }
  /** Abre a Linha do tempo (num dia, se td vier) — usado também pelo Calendário. */
  abrirLinha(td = null, filtro = "tudo") {
    if (!this.abas.includes("__linha")) this.abas.push("__linha");
    this.ativa = "__linha";
    this.editando = false;
    this.filtroLinha = filtro;
    this._rolarLinha = Number.isFinite(Number(td)) && td !== null ? Math.trunc(Number(td)) : null;
    this.render({ force: true });
  }
  static async _histSemData(ev, el) {
    await this._entry()?.pages.get(el.dataset.page)?.update({ [`flags.${MOD}.acontecimento.td`]: null });
  }
  static async _histRegistrar(ev, el) {
    const d = el.dataset;
    const td = d.td != null ? Number(d.td) : null;
    const origem = d.origem ?? "";
    let texto = d.texto ?? "";
    if (origem.startsWith("JournalEntry.")) {
      const nome = d.nome ?? "";
      const extra = { missao: texto ? `${T("Janela.Missao")}: ${texto}.` : T("Janela.Missao2"), sessao: `${texto}.`, evento: T("Janela.EventoDoCalendario"), jornal: `${T("Janela.Manchete")}: ${texto}.` }[d.tipoItem] ?? "";
      texto = `@UUID[${origem}]{${nome}} — ${extra}\n`;
    } else if (origem.startsWith("cal:") || origem.startsWith("nexus:")) texto = `${texto}\n`;
    await registrarNaHistoria({ td, nome: d.nome ?? "", texto, origem, icone: { missao: "fa-scroll", sessao: "fa-book-bookmark", evento: "fa-star", nexus: "fa-triangle-exclamation", jornal: "fa-scroll" }[d.tipoItem] ?? "fa-landmark" });
  }
  static async _histAbrir() {
    const lista = historias().filter((h) => podeVer(h));
    if (lista.length) return this.abrirPagina(lista[0].id);
    if (!ehGM()) return;
    const h = await criarHistoria(this.pastaDestino);
    this.abrirPagina(h.id);
  }
  static _nexusNovo() { Nexus.novo(); }
  static async _nexusApagar(ev, el) {
    const l = Nexus.lista();
    const nx = l.find((n) => n.id === el.dataset.id);
    const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarNexus") }, content: `<p>${T("Janela.ApagarOMedidor")} <b>${esc(nx?.name ?? nx?.nome)}</b>?</p>` });
    if (ok) await Nexus.salvar(l.filter((n) => n.id !== el.dataset.id));
  }
  static _nexusMudar(ev, el) {
    const nx = Nexus.lista().find((n) => n.id === el.dataset.id);
    if (nx) Nexus.definir(nx.id, (Number(nx.valor) || 0) + Number(el.dataset.delta));
  }
  static async _nexusLimiarNovo(ev, el) {
    const l = Nexus.lista();
    const nx = l.find((n) => n.id === el.dataset.id);
    if (!nx) return;
    (nx.limiares ??= []).push({ id: novoId(), v: 50, texto: "", anomalia: false, disparado: (Number(nx.valor) || 0) < 50 });
    await Nexus.salvar(l);
  }
  /** Liga ou desliga na hora a anomalia ligada ao Nexus (sem mexer no valor). */
  static async _nexusAnomalia(ev, el) {
    const nx = Nexus.lista().find((n) => n.id === el.dataset.id);
    if (!nx || !NexusClima.pronto(nx)) return ui.notifications.warn(T("Janela.EscolhaAAnomaliaEA"));
    const ok = el.dataset.ligar === "1" ? await NexusClima.ligar(nx, "") : await NexusClima.desligar(nx, [], { forcar: true });
    if (!ok) ui.notifications.warn(T("Janela.OCalendarioNaoAceitouConfira"));
    atualizarTudo();
  }
  static async _nexusLimiarApagar(ev, el) {
    const l = Nexus.lista();
    const nx = l.find((n) => n.id === el.dataset.id);
    if (!nx) return;
    nx.limiares = (nx.limiares ?? []).filter((x2) => x2.id !== el.dataset.limiar);
    await Nexus.salvar(l);
  }

  static async _prazoDefinir() {
    const { page } = analisar(this._entry());
    await page.update({ [`flags.${MOD}.prazo`]: Tempo.hoje() + 7, [`flags.${MOD}.prazoAvisado`]: false });
  }
  static async _prazoLimpar() {
    const { page } = analisar(this._entry());
    await page.update({ [`flags.${MOD}.prazo`]: null, [`flags.${MOD}.prazoAvisado`]: false });
  }

  static async _desligarFesta(ev, el) {
    const j = game.journal.get(el.dataset.id);
    const n = calNota(j);
    if (n) await j.update({ [`flags.${CAL}.nota.divindade`]: null });
  }

  /** Liga um evento que já existe à divindade (vira dia sagrado dela). */
  async _tornarDiaSagrado(deus, evento) {
    if (analisar(evento).tipo === "deus") return ui.notifications.warn(T("Janela.UmaDivindadeNaoPodeSer"));
    const n = calNota(evento);
    if (n?.divindade === deus.uuid) return ui.notifications.info(`"${evento.name}" ${T("Janela.JaEDiaSagradoDe")} ${deus.name}.`);
    const outro = deusDaFesta(evento);
    if (outro) {
      const ok = await Dialogo().confirm({ window: { title: T("Janela.TrocarADivindade") },
        content: `<p><b>${esc(evento.name)}</b> ${T("Janela.HojeEDiaSagradoDe")} <b>${esc(outro.name)}</b>. ${T("Janela.PassarPara")} <b>${esc(deus.name)}</b>?</p>` });
      if (!ok) return;
    }
    if (!n) {
      if (!Tempo.ok()) return ui.notifications.warn(T("Janela.OCalendarioDoMundoNao"));
      const ok = await Dialogo().confirm({ window: { title: T("Janela.SemDataNoCalendario2") },
        content: `<p><b>${esc(evento.name)}</b> ${T("Janela.AindaNaoEstaNoCalendario")}</p>` });
      if (!ok) return;
      await calSalvar(evento, { repetir: "anos", cada: 1, icone: "fa-hands-praying", cor: "#d6a92b", divindade: deus.uuid });
    } else await calSalvar(evento, { divindade: deus.uuid });
    ui.notifications.info(`"${evento.name}" ${T("Janela.AgoraEDiaSagradoDe")} ${deus.name}.`);
  }

  static _conTipo(ev, el) {
    this.conFiltro = { texto: this.conFiltro?.texto ?? "", tipo: el.dataset.tipo || "" };
    const raiz = el.closest(".jm-conexoes");
    raiz?.querySelectorAll("[data-action=conTipo]").forEach((b) => b.classList.toggle("ativo", b === el));
    if (raiz) this._filtrarConexoes(raiz);
  }

  /** Esconde as conexões (e as opções de "ligar") que não batem com o filtro. */
  _filtrarConexoes(raiz) {
    const texto = (this.conFiltro?.texto ?? "").trim().toLowerCase();
    const tipo = this.conFiltro?.tipo ?? "";
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
  _filtrarLigar(raiz) {
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

  static async _ligarFesta(ev, el) {
    const id = el.closest(".jm-festa-ligar")?.querySelector("[data-festa-livre]")?.value;
    if (!id) return ui.notifications.warn(T("Janela.EscolhaUmEventoParaLigar"));
    const evento = game.journal.get(id);
    if (evento) await this._tornarDiaSagrado(this._entry(), evento);
  }

  /** Cria um dia sagrado (evento que se repete todo ano) ligado à divindade aberta. */
  static async _novoDiaSagrado() {
    const deus = this._entry();
    if (!Tempo.ok()) return ui.notifications.warn(T("Janela.OCalendarioDoMundoNao"));
    const p = Tempo.partes(Tempo.hoje());
    const op = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
    const dados = await Dialogo().prompt({
      window: { title: `${T("Janela.NovoDiaSagrado")}: ${deus.name}`, icon: "fa-solid fa-hands-praying" },
      position: { width: 460 },
      content: `<div class="jm-form-dialogo">
        <label>${T("Janela.Nome")} <input type="text" name="nome" required autofocus></label>
        <label>${T("Janela.ComecaEm")} <span class="jm-data">
          <input type="number" name="dia" min="1" value="${p.dia}">
          <select name="mes">${Tempo.meses(p.ano).map((m) => `<option value="${m.i}" ${m.i === p.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
          <input type="number" name="ano" value="${p.ano}"></span></label>
        <label>${T("Janela.RepeteACada")} <span class="jm-linha-curta"><input type="number" name="cada" min="1" value="1"> ${T("Janela.AnoS")}</span></label>
        <label>${T("Janela.DuraQuantosDias")} <input type="number" name="duracao" min="1" value="1"></label>
        <label>${T("Janela.QuandoChegar")} <select name="aviso">${op(CAL_AVISOS, "nenhum")}</select></label>
        <label>${T("Janela.Descricao")} <textarea name="texto" rows="3"></textarea></label>
      </div>`,
      ok: {
        label: T("Comum.Criar"), icon: "fa-solid fa-check",
        callback: (ev, botao) => Object.fromEntries(["nome", "dia", "mes", "ano", "cada", "duracao", "aviso", "texto"].map((k) => [k, botao.form.elements[k]?.value]))
      }
    }).catch(() => null);
    if (!dados?.nome?.trim()) return;
    const td = Tempo.tdDe(Number(dados.ano), Number(dados.mes), Number(dados.dia));
    if (td == null) return ui.notifications.warn(T("Comum.EssaDataNaoExisteNeste"));
    const pasta = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag?.(CAL, "pasta"))?.id ?? deus.folder?.id ?? null;
    const nome = dados.nome.trim();
    await JournalEntry.create({
      name: nome, folder: pasta, sort: ordemNova(pasta), ownership: { default: LV().NONE },
      flags: { [CAL]: { nota: notaPadrao(td, {
        repetir: "anos", cada: Math.max(1, Math.trunc(Number(dados.cada) || 1)), duracao: Math.max(1, Math.trunc(Number(dados.duracao) || 1)),
        icone: "fa-hands-praying", cor: "#d6a92b", aviso: CAL_AVISOS[dados.aviso] ? dados.aviso : "nenhum", divindade: deus.uuid
      }) } },
      pages: [{ name: nome, type: "text", text: { content: textoParaHtml(dados.texto ?? "") }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao("journalentry") } } }]
    });
    ui.notifications.info(`"${nome}" ${T("Janela.CriadoNoCalendario")}`);
  }

  static async _calTirar() {
    const e = this._entry();
    const ok = await Dialogo().confirm({ window: { title: T("Janela.TirarDoCalendario") }, content: `<p>${T("Janela.Tirar")} <b>${esc(e.name)}</b> ${T("Janela.DoCalendarioAPaginaContinua")}</p>` });
    if (ok) calTirar(e);
  }
  static _calMover(ev, el) { const n = calNota(this._entry()); if (n) calSalvar(this._entry(), { td: Number(n.td) + Number(el.dataset.dias) }); }
  static async _calIcone(ev, el) {
    const e = this._entry(); const n = calNota(e); if (!n) return;
    const icone = el.dataset.icone;
    const mud = { icone };
    const corAtual = String(n.cor ?? "").toLowerCase();
    const corDeElemento = Object.values(CAL_CORES_ELEMENTO).includes(corAtual);
    if (CAL_CORES_ELEMENTO[icone] && (!corAtual || corAtual === "#c9a227" || corAtual === "#d6a92b" || corDeElemento)) mud.cor = CAL_CORES_ELEMENTO[icone];
    this.iconesAbertos = false;
    await calSalvar(e, mud);
  }
  static _calHoje() { calSalvar(this._entry(), { td: calHoje() }); }
  static _calAbrir() { calApi()?.abrir?.(); }
  static _verOcultas() { this.verOcultas = !this.verOcultas; this.pastaAlvo = null; this.render(); }
  static _ocultarPasta(ev, el) { ev.stopPropagation(); alternarPastaOculta(game.folders.get(el.dataset.id)); }
  static _apagar() { apagarEntrada(this._entry()); }

  static _imagemSimbolo() {
    const { page, x } = analisar(this._entry());
    new (FP())({ type: "image", current: x.deus.simboloImg, callback: (path) => page.setFlag(MOD, "deus.simboloImg", path) }).render(true);
  }

  static async _removerReliquia(ev, el) {
    const { page, x } = analisar(this._entry());
    await page.setFlag(MOD, "deus.reliquias", (x.deus.reliquias ?? []).filter((u) => u !== el.dataset.uuid));
  }

  static async _rolarSemanal() {
    const e = this._entry();
    const r = await renovarEstoqueDaLoja(e);
    if (r === null) ui.notifications.warn(T("Janela.EscolhaUmaTabelaDeRolagem"));
  }

  static async _limparSemanal() {
    const { page } = analisar(this._entry());
    await substituirMapa(page, `flags.${MOD}.${CHAVE_DADOS}.items`, {});
  }

  static async _removerItemLoja(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "items");
    await dadosUnset(page, `items.${el.dataset.id}`);
  }

  static async _ocultarItemLoja(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "items");
    const atual = !!dadosGet(page, `items.${el.dataset.id}.hidden`);
    await dadosSet(page, `items.${el.dataset.id}.hidden`, !atual);
  }

  static _comprarSemanal(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    const quantidade = Number(el.closest(".jm-produto")?.querySelector(".jm-qtd")?.value) || 1;
    pedir("comprar", { entryId: this.ativa, origem: "semanal", itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id, quantidade });
  }

  static _comprarDiaria() {
    const ator = this._precisaAtor(); if (!ator) return;
    pedir("comprar", { entryId: this.ativa, origem: "diaria", actorUuid: ator.uuid, userId: game.user.id });
  }

  static _rolarDiaria() { pedir("rolarDiaria", { entryId: this.ativa, userId: game.user.id }); }

  static async _limparOferta(ev, el) {
    await analisar(this._entry()).page.setFlag(MOD, `diaria.ofertas.${el.dataset.user}.dia`, 0);
  }

  static _pegar(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    pedir("pegar", { entryId: this.ativa, itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id });
  }

  static async _dividirMoedas() {
    const e = this._entry(); const { page, m } = analisar(e);
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
  }

  static async _itemPiles() {
    const api = game.itempiles?.API;
    if (!api?.createItemPile) return ui.notifications.warn(T("Janela.OItemPilesNaoEsta"));
    if (!canvas?.scene) return ui.notifications.warn(T("Janela.AbraUmaCenaParaColocar"));
    const e = this._entry(); const { page, m } = analisar(e);
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

  static async _exportarItens() {
    const e = this._entry(); const { m } = analisar(e);
    const itens = comoLista(m.items).map(([, it]) => itemLimpo(it));
    if (!itens.length) return ui.notifications.warn(T("Janela.NaoHaItensParaExportar"));
    const raiz = await obterPasta("Item", T("Comum.Journal"), "itens");
    const pasta = await Folder.create({ name: e.name, type: "Item", folder: raiz?.id ?? null });
    await Item.createDocuments(itens.map((d) => ({ ...d, folder: pasta.id })));
    ui.notifications.info(`${itens.length} ${T("Janela.ItemNsCopiadoSPara")} ${e.name}".`);
  }

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

  static async _novoObjetivo() {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "objectives");
    const id = novoId();
    this.editando = true;
    await dadosSet(page, `objectives.${id}`, { id, content: T("Janela.NovoObjetivo"), done: 0, required: "", available: true });
  }

  static async _alternarObjetivo(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "objectives");
    const o = dadosGet(page, `objectives.${el.dataset.id}`); if (!o) return;
    const req = Number(o.required) || 0;
    const feito = req ? (Number(o.done) || 0) >= req : !!Number(o.done) || o.done === true;
    await dadosSet(page, `objectives.${el.dataset.id}.done`, feito ? 0 : (req || 1));
  }

  static async _ocultarObjetivo(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "objectives");
    const o = dadosGet(page, `objectives.${el.dataset.id}`); if (!o) return;
    await dadosSet(page, `objectives.${el.dataset.id}.available`, o.available === false);
  }

  /* ---------- negociação e venda ---------- */

  static _negociarCompra(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    pedir("negociar", { entryId: this.ativa, userId: game.user.id, actorUuid: ator.uuid, modo: "compra", alvoId: el.dataset.id, nome: el.dataset.nome });
  }

  static _negociarVenda(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    pedir("negociar", { entryId: this.ativa, userId: game.user.id, actorUuid: ator.uuid, modo: "venda", alvoId: el.dataset.id, nome: el.dataset.nome });
  }

  static async _vender(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    const item = ator.items.get(el.dataset.id);
    const quantidade = Number(el.closest(".jm-produto")?.querySelector(".jm-qtd")?.value) || 1;
    const ok = await Dialogo().confirm({
      window: { title: T("Janela.Vender") },
      content: `<p>${T("Janela.Vender")} ${quantidade > 1 ? `<b>${quantidade}×</b> ` : ""}<b>${esc(item?.name)}</b> ${T("Janela.Para")} <b>${esc(this._entry().name)}</b>?</p>`
    });
    if (ok) pedir("vender", { entryId: this.ativa, userId: game.user.id, actorUuid: ator.uuid, itemId: el.dataset.id, quantidade });
  }

  /* ---------- recompensas ---------- */

  static async _novaRecompensa() {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "rewards");
    const id = novoId();
    await dadosSet(page, `rewards.${id}`, {
      id, name: T("Comum.Recompensas"), active: true, visible: true, awarded: false,
      itemIds: [], xp: 0, additional: "", currency: {}
    });
  }

  static async _recompensaVisivel(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "rewards");
    const atual = !!dadosGet(page, `rewards.${el.dataset.grupo}.visible`);
    await dadosSet(page, `rewards.${el.dataset.grupo}.visible`, !atual);
  }

  static async _apagarRecompensa(ev, el) {
    const { page, m } = analisar(this._entry());
    const r = Object.fromEntries(comoLista(m.rewards))[el.dataset.grupo];
    const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarRecompensa") }, content: `<p>${T("Janela.ApagarOGrupo")} <b>${esc(r?.name ?? T("Comum.Recompensas"))}</b> ${T("Janela.EOsItensDele")}</p>` });
    if (!ok) return;
    await garantirObjeto(page, "rewards");
    await garantirObjeto(page, "items");
    // o grupo e os itens dele saem numa gravação só
    const apagar = (r?.itemIds ?? []).filter((iid) => dadosGet(page, `items.${iid}`)).map((iid) => `flags.${MOD}.${CHAVE_DADOS}.items.${iid}`);
    await gravarJunto(page, {}, [...apagar, `flags.${MOD}.${CHAVE_DADOS}.rewards.${el.dataset.grupo}`]);
  }

  static async _removerPremio(ev, el) {
    const { page, m } = analisar(this._entry());
    await garantirObjeto(page, "rewards");
    const r = Object.fromEntries(comoLista(m.rewards))[el.dataset.grupo];
    await dadosSet(page, `rewards.${el.dataset.grupo}.itemIds`, (r?.itemIds ?? []).filter((i) => i !== el.dataset.id));
    if (dadosGet(page, `items.${el.dataset.id}`)) await dadosUnset(page, `items.${el.dataset.id}`);
  }

  static async _entregarRecompensa(ev, el) {
    const e = this._entry(); const { page, m } = analisar(e);
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
    const criados = await Promise.allSettled([...porFicha].map(([alvo, itens]) => alvo.createEmbeddedDocuments("Item", itens)));
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
  }

  static _pegarRecompensa(ev, el) {
    const ator = this._precisaAtor(); if (!ator) return;
    pedir("pegarRecompensa", { entryId: this.ativa, grupo: el.dataset.grupo, itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id });
  }

  static async _removerObjetivo(ev, el) {
    const { page } = analisar(this._entry());
    await garantirObjeto(page, "objectives");
    await dadosUnset(page, `objectives.${el.dataset.id}`);
  }
}

/** Renova o estoque semanal de uma loja pela tabela dela. Devolve o nº de itens, ou null sem tabela.
 *  A tabela é rolada uma vez por item, em sequência (tabelas "sem reposição" dependem da ordem). */
async function renovarEstoqueDaLoja(e, { avisarChat = true } = {}) {
  const { page, x, tipo } = analisar(e);
  if (!page || tipo !== "shop") return null;
  const uuidSemanal = tabelaDaLoja(x.semanal.tabela, "semanal");
  const tabela = uuidSemanal ? await fromUuid(uuidSemanal) : null;
  if (!tabela) return null;
  const novos = {};
  const porChave = {};
  for (let i = 0; i < Math.max(1, x.semanal.qtd); i++) {
    const { results } = await tabela.roll();
    for (const r of results ?? []) {
      const { doc, ...info } = await resultadoParaItem(r);
      const chave = info.uuid || info.nome;
      if (porChave[chave]) {
        const f = novos[porChave[chave]].flags[MOD];
        f.qtd = (f.qtd ?? 1) + 1;
        continue;
      }
      const data = itemParaLoja(doc, info);
      novos[data._id] = data;
      porChave[chave] = data._id;
    }
  }
  // troca o estoque numa gravação só (antes: apagar tudo e depois gravar; uma falha no meio esvaziava a loja)
  await substituirMapa(page, `flags.${MOD}.${CHAVE_DADOS}.items`, novos);
  if (avisarChat) await chat(`<i class="fa-solid fa-store"></i> <b>${esc(e.name)}</b> ${T("Janela.RenovouOEstoqueDaSemana")}`, estaVisivel(e) ? {} : { whisper: idsGM() });
  return Object.keys(novos).length;
}

/** Para o Calendário da Mesa: na virada da semana, renova todas as lojas que têm tabela — só se a opção
 *  estiver ligada. Devolve true quando renovou (o Calendário então não manda o lembrete). */
async function renovarEstoques() {
  if (!souGMPrincipal() || !game.settings.get(MOD, "renovarAuto")) return false;
  const lojas = game.journal.filter((e) => analisar(e).tipo === "shop" && tabelaDaLoja(analisar(e).x.semanal.tabela, "semanal"));
  const feitas = [];
  for (const e of lojas) {
    try { if ((await renovarEstoqueDaLoja(e, { avisarChat: false })) != null) feitas.push(e.name); }
    catch (err) { console.error(`${T("Janela.JournalDaMesaNaoRenovei")} "${e.name}"`, err); }
  }
  if (feitas.length) await chat(`<i class="fa-solid fa-store"></i> ${T("Janela.NovaSemanaEstoqueRenovadoEm")} ${feitas.map((n) => `<b>${esc(n)}</b>`).join(", ")}.`, { whisper: idsGM() });
  return true;
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
