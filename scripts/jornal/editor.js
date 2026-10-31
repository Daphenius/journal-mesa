/* Jornal de Notícias — editor (janela própria, só o mestre). Modo de EDIÇÃO; a leitura é leitor.js.
 * Dois modos: "jornal" (identidade da publicação) e "edicao" (dados da edição e matérias).
 * Trabalha numa cópia: nada é gravado até "Salvar". O texto rico usa a caixa de texto nativa do
 * Foundry (ProseMirror); sem ela (ou com o editor "simples" do Journal), uma caixa de texto comum.
 *
 * Correções da 4.7.1:
 *  - rolagem: a janela usava a classe da janela principal (".jm-janela .window-content { overflow: hidden }",
 *    feita para a janela que rola por dentro dos painéis). O editor não tem painel: o que passava da
 *    altura ficava inalcançável — inclusive a área de vínculos, no fim de cada matéria. Agora o conteúdo
 *    da janela do editor rola (jornal.css), com o rodapé de salvar sempre visível.
 *  - Enter num campo de texto enviava o <form> (o navegador recarregava a página e a edição se perdia).
 *  - vínculos: botão "Vincular" com janela de busca (vinculos.js), arrastar e soltar, e colar UUID;
 *    cada vínculo mostra nome e tipo, abre o documento e sai com o X. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import {
  ESTILOS, SECOES, VERACIDADE, CATEGORIAS, identidade, normalizarIdentidade, lerEdicao, ehEdicao, ehJornal,
  normalizarEdicao, materiaPadrao, gravarEdicao, uuidValido, rotEstilo, rotSecao, rotSecaoUm, rotVerdade, rotCategoria
} from "./dados.js";
import { segredosDe, gravarSegredos } from "./redacao.js";
import { SeletorVinculo, descreverVinculo } from "./vinculos.js";
import { abrirVinculo, imagemDe, fotoAutomatica, paginasEdicao, ouvirVinculos } from "./leitura.js";
import { exportarEdicao, dialogoImportar, lerJson, converterEdicao, mostrarRelatorio, edicaoParaJson, baixarJson } from "./json.js";

const e = (s) => J.esc(s);
const ApplicationV2 = foundry.applications.api.ApplicationV2;
const ABERTOS = new Map();

export class EditorJornal extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["jm-janela", "jmj-editor"],
    tag: "div",
    window: { title: "Jornal", icon: "fa-solid fa-newspaper", resizable: true },
    position: { width: 960, height: 820 },
    actions: {
      salvar: EditorJornal._salvar,
      salvarFechar: EditorJornal._salvarFechar,
      addMateria: EditorJornal._addMateria,
      tirarMateria: EditorJornal._tirarMateria,
      moverMateria: EditorJornal._moverMateria,
      escolherImagem: EditorJornal._escolherImagem,
      vincular: EditorJornal._vincular,
      tirarVinculo: EditorJornal._tirarVinculo,
      fotoVinculo: EditorJornal._fotoVinculo,
      etapa: EditorJornal._etapa,
      abrirMateria: EditorJornal._abrirMateria,
      importarAqui: EditorJornal._importarAqui,
      exportar: EditorJornal._exportar,
      abrirVinculo: EditorJornal._abrirVinculo,
      ler: EditorJornal._ler
    }
  };

  /** Abre (ou traz para a frente) o editor de uma publicação ou de uma edição. */
  static abrir(entryId, pageId = null) {
    if (!game.user.isGM) return null;
    const chave = `${entryId}:${pageId ?? ""}`;
    const aberto = ABERTOS.get(chave);
    if (aberto?.rendered) { aberto.bringToFront?.(); return aberto; }
    const ed = new EditorJornal({ id: `jmj-editor-${entryId}-${pageId ?? "id"}` });
    ed.entryId = entryId; ed.pageId = pageId; ed.modo = pageId ? "edicao" : "jornal";
    if (!ed._carregar()) return null;
    ABERTOS.set(chave, ed);
    ed.render({ force: true });
    return ed;
  }

  get entry() { return game.journal.get(this.entryId) ?? null; }
  get page() { return this.pageId ? this.entry?.pages.get(this.pageId) ?? null : null; }
  get title() {
    const en = this.entry;
    if (this.modo === "jornal") return t("Jornal.TituloIdentidade", { nome: en?.name ?? "" });
    return t("Jornal.TituloEditor", { n: this.dados?.numero ?? "?", nome: en?.name ?? "" });
  }

  _carregar() {
    const en = this.entry;
    if (!ehJornal(en)) return false;
    this.sujo = false;
    if (this.modo === "jornal") { this.dados = { nome: en.name, ...identidade(en) }; return true; }
    const p = this.page;
    if (!ehEdicao(p)) return false;
    this.dados = lerEdicao(p);
    this.seg = segredosDe(p.id);
    return true;
  }

  async _renderHTML() { return this.modo === "jornal" ? this._htmlJornal() : this._htmlEdicao(); }

  _replaceHTML(html, content) {
    const rolagem = content.scrollTop;
    this._textos = [];
    content.innerHTML = html;
    content.scrollTop = rolagem;
    try { this.element.dataset.tema = game.settings.get(J.MOD, "tema"); } catch { /* tema padrão */ }
    this._ouvintes(content);
  }

  /* ---------- identidade ---------- */
  _htmlJornal() {
    const d = this.dados;
    const orgs = game.journal.filter((j) => J.analisar(j).tipo === "organization");
    return `<form class="jmj-form" autocomplete="off">
      <label>${e(t("Jornal.Campo.nome"))} <input type="text" data-c="nome" value="${e(d.nome)}" placeholder="${e(t("Jornal.Exemplo.nome"))}"></label>
      <label>${e(t("Jornal.Campo.subtitulo"))} <input type="text" data-c="subtitulo" value="${e(d.subtitulo)}" placeholder="${e(t("Jornal.Exemplo.subtitulo"))}"></label>
      <label>${e(t("Jornal.Campo.lema"))} <input type="text" data-c="lema" value="${e(d.lema)}"></label>
      <div class="jmj-linha2">
        <label>${e(t("Jornal.EstiloVisual"))} <select data-c="estilo">${Object.keys(ESTILOS).map((k) => `<option value="${k}" ${k === d.estilo ? "selected" : ""}>${e(rotEstilo(k))}</option>`).join("")}</select></label>
        <label>${e(t("Jornal.Campo.cor"))} <input type="color" data-c="cor" value="${e(d.cor)}"></label>
      </div>
      <label>${e(t("Jornal.Campo.logo"))} <span class="jmj-arquivo"><input type="text" data-c="logo" value="${e(d.logo)}"><button type="button" data-action="escolherImagem" data-alvo="logo" data-tooltip="${e(t("Jornal.EscolherImagem"))}"><i class="fa-solid fa-file-image"></i></button></span></label>
      <div class="jmj-linha2">
        <label>${e(t("Jornal.Campo.regiao"))} <input type="text" data-c="regiao" value="${e(d.regiao)}"></label>
        <label>${e(t("Jornal.Responsavel"))} <select data-c="organizacao"><option value="">${e(t("Jornal.TextoLivre"))}</option>${orgs.map((o) => `<option value="${o.uuid}" ${o.uuid === d.organizacao ? "selected" : ""}>${e(o.name)}</option>`).join("")}</select></label>
      </div>
      ${d.organizacao ? "" : `<label>${e(t("Jornal.Campo.orgTexto"))} <input type="text" data-c="orgTexto" value="${e(d.orgTexto)}"></label>`}
      <label>${e(t("Jornal.Campo.descricao"))} <textarea data-c="descricao" rows="5">${e(d.descricao)}</textarea></label>
      <p class="jm-dica"><i class="fa-solid fa-eye"></i> ${e(t("Jornal.QuemLeDica"))}</p>
      <footer class="jmj-rodape-form"><button type="button" data-action="salvarFechar"><i class="fa-solid fa-check"></i> ${e(t("Jornal.Salvar"))}</button></footer>
    </form>`;
  }

  /* ---------- edição ---------- */
  _campoData(td) {
    if (!J.Tempo.ok()) return "";
    const p = J.Tempo.partes(Number.isFinite(td) ? td : J.Tempo.hoje());
    const meses = J.Tempo.meses(p.ano);
    return `<span class="jm-data" data-data-edicao>
      <input type="number" min="1" value="${p.dia}" data-parte="dia" data-tooltip="${e(t("Jornal.Dia"))}">
      <select data-parte="mes">${meses.map((m) => `<option value="${m.i}" ${m.i === p.mes ? "selected" : ""} ${m.existe === false ? "disabled" : ""}>${e(m.nome)}</option>`).join("")}</select>
      <input type="number" value="${p.ano}" data-parte="ano" data-tooltip="${e(t("Jornal.Ano"))}"></span>`;
  }

  _htmlVinculos(m) {
    const chips = m.vinculos.map((u) => {
      const d = descreverVinculo(u);
      const img = d ? imagemDe(d.doc) : "";
      const comFoto = !!img && (m.fotos ?? []).includes(u);
      return `<span class="jmj-vinc ${d ? "" : "perdido"} ${comFoto ? "com-foto" : ""}">
        ${img ? `<img class="jmj-vinc-img" src="${e(img)}" alt="">` : ""}
        ${d ? `<a data-action="abrirVinculo" data-u="${e(u)}" data-tooltip="${e(t("Jornal.AbrirVinculo"))}"><i class="${d.icone}"></i> ${e(d.nome)}</a>` : `<i class="fa-solid fa-link-slash"></i> ${e(t("Jornal.VinculoSumiu"))}`}
        ${img ? `<a data-action="fotoVinculo" data-m="${m.id}" data-u="${e(u)}" class="jmj-foto ${comFoto ? "ativo" : ""}" data-tooltip="${e(t(comFoto ? "Jornal.TirarFoto" : "Jornal.MostrarFoto"))}"><i class="fa-solid fa-camera"></i></a>` : ""}
        <a data-action="tirarVinculo" data-m="${m.id}" data-u="${e(u)}" data-tooltip="${e(t("Jornal.TirarVinculo"))}"><i class="fa-solid fa-xmark"></i></a></span>`;
    }).join("");
    return `<div class="jmj-ed-vinc" data-drop-vinculo="${m.id}">
      <span class="jmj-ed-vinc-titulo"><i class="fa-solid fa-link"></i> ${e(t("Jornal.QuemAparece"))}</span>
      ${chips || `<span class="jm-dica">${e(t("Jornal.SemVinculos"))}</span>`}
      <button type="button" class="sec" data-action="vincular" data-m="${m.id}"><i class="fa-solid fa-plus"></i> ${e(t("Jornal.VincularLongo"))}</button>
    </div>`;
  }

  /* Editor em etapas: um menu à esquerda (Capa, Manchete, Notícias, Rumores, Avisos, Classificados,
   * Final, Prévia), uma etapa por vez à direita, com uma explicação curta em cada uma. Nas seções de
   * matérias, só uma matéria fica aberta por vez; o resto aparece como um cartão com título e começo do texto. */
  static ETAPAS = [
    ["capa", "fa-solid fa-newspaper"], ["manchete", "fa-solid fa-heading"],
    ["noticia", "fa-solid fa-newspaper"], ["rumor", "fa-solid fa-ear-listen"], ["aviso", "fa-solid fa-bullhorn"], ["classificado", "fa-solid fa-tags"],
    ["final", "fa-solid fa-flag-checkered"], ["previa", "fa-solid fa-eye"]
  ];

  _nomeEtapa(k) { return SECOES[k] ? rotSecao(k) : t(`Jornal.Etapa.${k}`); }

  _htmlMateria(m, i, total) {
    const s = this.seg.materias[m.id] ?? {};
    const aberta = this.materiaAberta === m.id;
    const resumo = String(m.texto ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 110);
    if (!aberta) return `<div class="jmj-card-materia" data-m="${m.id}">
      <a class="jmj-card-materia-abrir" data-action="abrirMateria" data-m="${m.id}">
        <b>${e(m.titulo || t("Jornal.SemTitulo"))}</b>
        <small>${resumo ? e(resumo) + (resumo.length >= 110 ? "…" : "") : `<i>${e(t("Jornal.SemTexto"))}</i>`}</small>
        <span class="jmj-card-materia-info">${m.vinculos.length ? `<i class="fa-solid fa-link"></i> ${m.vinculos.length}` : ""}${m.imagem ? ` <i class="fa-solid fa-image"></i>` : ""}${s.verdade ? ` <i class="fa-solid fa-user-secret"></i>` : ""}</span>
      </a>
      <span class="jmj-ed-ctrl">
        <a class="jm-mini-btn" data-action="moverMateria" data-m="${m.id}" data-d="-1" data-tooltip="${e(t("Jornal.Subir"))}" ${i === 0 ? "hidden" : ""}><i class="fa-solid fa-arrow-up"></i></a>
        <a class="jm-mini-btn" data-action="moverMateria" data-m="${m.id}" data-d="1" data-tooltip="${e(t("Jornal.Descer"))}" ${i === total - 1 ? "hidden" : ""}><i class="fa-solid fa-arrow-down"></i></a>
        <a class="jm-mini-btn" data-action="tirarMateria" data-m="${m.id}" data-tooltip="${e(t("Jornal.RemoverMateria"))}"><i class="fa-solid fa-trash"></i></a></span>
    </div>`;
    return `<div class="jmj-materia-aberta" data-m="${m.id}">
      <div class="jmj-materia-topo"><span class="jmj-passo">${i + 1}</span>
        <input type="text" class="jmj-materia-titulo" data-mc="titulo" value="${e(m.titulo)}" placeholder="${e(t("Jornal.Campo.titulo"))}">
        <a class="jm-mini-btn" data-action="abrirMateria" data-m="" data-tooltip="${e(t("Jornal.Recolher"))}"><i class="fa-solid fa-chevron-up"></i></a>
        <a class="jm-mini-btn" data-action="tirarMateria" data-m="${m.id}" data-tooltip="${e(t("Jornal.RemoverMateria"))}"><i class="fa-solid fa-trash"></i></a></div>
      <div data-pm-materia="${m.id}"></div>
      ${this._htmlVinculos(m)}
      <details class="jmj-mais" ${m.categoria || m.autor || m.imagem || m.secao !== this.etapa ? "open" : ""}><summary><i class="fa-solid fa-sliders"></i> ${e(t("Jornal.MaisOpcoes"))}</summary>
        <div class="jmj-linha2">
          <label>${e(t("Jornal.Campo.categoria"))} <input type="text" data-mc="categoria" value="${e(m.categoria)}" list="jmj-categorias"></label>
          <label>${e(t("Jornal.Campo.autor"))} <input type="text" data-mc="autor" value="${e(m.autor)}"></label>
        </div>
        <div class="jmj-linha2">
          <label>${e(t("Jornal.Campo.imagem"))} <span class="jmj-arquivo"><input type="text" data-mc="imagem" value="${e(m.imagem)}"><button type="button" data-action="escolherImagem" data-alvo="materia" data-m="${m.id}" data-tooltip="${e(t("Jornal.EscolherImagem"))}"><i class="fa-solid fa-file-image"></i></button></span></label>
          <label>${e(t("Jornal.MoverPara"))} <select data-mc="secao">${Object.keys(SECOES).map((k) => `<option value="${k}" ${k === m.secao ? "selected" : ""}>${e(rotSecaoUm(k))}</option>`).join("")}</select></label>
        </div>
      </details>
      <details class="jmj-mais jmj-segredo" ${s.verdade || s.nota ? "open" : ""}><summary><i class="fa-solid fa-user-secret"></i> ${e(t("Jornal.SoOMestreVe"))} <small>${e(t("Jornal.SegredoDica"))}</small></summary>
        <div class="jmj-linha2">
          <label>${e(t("Jornal.Campo.veracidade"))} <select data-sc="verdade">${Object.keys(VERACIDADE).map((k) => `<option value="${k}" ${k === (s.verdade ?? "") ? "selected" : ""}>${e(rotVerdade(k))}</option>`).join("")}</select></label>
          <label>${e(t("Jornal.Campo.nota"))} <input type="text" data-sc="nota" value="${e(s.nota ?? "")}" placeholder="${e(t("Jornal.Exemplo.nota"))}"></label>
        </div>
      </details>
    </div>`;
  }

  _htmlEtapa() {
    const d = this.dados;
    const k = this.etapa;
    if (k === "capa") return `<div class="jmj-linha2">
        <label>${e(t("Jornal.Campo.numero"))} <input type="number" min="0" data-c="numero" value="${d.numero}"></label>
        ${J.Tempo.ok() ? `<label>${e(t("Jornal.Campo.data"))} ${this._campoData(d.td)}</label>` : `<label>${e(t("Jornal.Campo.dataTexto"))} <input type="text" data-c="dataTexto" value="${e(d.dataTexto)}"></label>`}
      </div>
      <label>${e(t("Jornal.Campo.editor"))} <input type="text" data-c="editor" value="${e(d.editor)}"></label>
      <p class="jm-dica"><i class="fa-solid fa-palette"></i> ${e(t("Jornal.CapaIdentidade"))}</p>`;
    if (k === "manchete") return `
      <label>${e(t("Jornal.Campo.tituloPrincipal"))} <input type="text" class="jmj-materia-titulo" data-c="titulo" value="${e(d.titulo)}" placeholder="${e(t("Jornal.Exemplo.manchete"))}"></label>
      <label>${e(t("Jornal.Campo.subtituloManchete"))} <input type="text" data-c="subtitulo" value="${e(d.subtitulo)}"></label>
      <label>${e(t("Jornal.Campo.imagemPrincipal"))} <span class="jmj-arquivo"><input type="text" data-c="imagem" value="${e(d.imagem)}"><button type="button" data-action="escolherImagem" data-alvo="imagem" data-tooltip="${e(t("Jornal.EscolherImagem"))}"><i class="fa-solid fa-file-image"></i></button></span></label>
      <label>${e(t("Jornal.Campo.textoManchete"))}</label><div data-pm-edicao="texto"></div>`;
    if (SECOES[k]) {
      const l = d.materias.filter((m) => m.secao === k);
      return `${l.length ? l.map((m, i) => this._htmlMateria(m, i, l.length)).join("") : `<div class="jmj-vazio-etapa"><i class="${SECOES[k].icone}"></i><p>${e(t(`Jornal.Vazio.${k}`))}</p></div>`}
        <button type="button" class="jmj-add-grande" data-action="addMateria" data-secao="${k}"><i class="fa-solid fa-plus"></i> ${e(t("Jornal.Adicionar", { o: rotSecaoUm(k) }))}</button>`;
    }
    if (k === "final") return `
      <label>${e(t("Jornal.Campo.rodape"))} <input type="text" data-c="rodape" value="${e(d.rodape)}" placeholder="${e(t("Jornal.Exemplo.rodape"))}"></label>
      <fieldset class="jmj-segredo"><legend><i class="fa-solid fa-user-secret"></i> ${e(t("Jornal.NotaEdicao"))}</legend>
        <textarea data-seg-nota rows="3">${e(this.seg.nota)}</textarea></fieldset>
      <div class="jmj-resumo-final">${this._resumo()}</div>`;
    if (k === "previa") return `<div class="jmj-previa" data-previa><p class="jm-dica">${e(t("Jornal.Carregando"))}</p></div>`;
    return "";
  }

  /** Lista do que já está pronto (etapa Final). */
  _resumo() {
    const d = this.dados;
    const conta = (k) => d.materias.filter((m) => m.secao === k).length;
    const ok = (b) => `<i class="fa-solid ${b ? "fa-circle-check jmj-ok" : "fa-circle jmj-falta"}"></i>`;
    return `<h4>${e(t("Jornal.Conferir"))}</h4><ul>
      <li>${ok(!!d.titulo)} ${e(t("Jornal.Etapa.manchete"))}: ${e(d.titulo || "—")}</li>
      ${Object.keys(SECOES).map((k) => `<li>${ok(conta(k) > 0)} ${e(rotSecao(k))}: ${conta(k)}</li>`).join("")}
    </ul><p class="jm-dica">${e(t("Jornal.ConferirDica"))}</p>`;
  }

  _htmlEdicao() {
    const d = this.dados;
    this.etapa ??= "manchete";
    const lista = EditorJornal.ETAPAS;
    const i = lista.findIndex(([k]) => k === this.etapa);
    const conta = (k) => (SECOES[k] ? d.materias.filter((m) => m.secao === k).length : null);
    const ant = lista[i - 1], prox = lista[i + 1];
    return `<div class="jmj-ed2">
      <nav class="jmj-ed2-menu">
        ${lista.map(([k, ic], n) => `<a class="jmj-ed2-item ${k === this.etapa ? "ativo" : ""} ${k === "previa" ? "previa" : ""}" data-action="etapa" data-etapa="${k}">
          <span class="jmj-passo">${k === "previa" ? `<i class="${ic}"></i>` : n + 1}</span><span>${e(this._nomeEtapa(k))}</span>${conta(k) != null ? `<small>${conta(k)}</small>` : ""}</a>`).join("")}
        <div class="jmj-ed2-json">
          <button type="button" class="sec" data-action="importarAqui" data-tooltip="${e(t("Jornal.Json.ImportarAquiTitulo"))}"><i class="fa-solid fa-file-import"></i> ${e(t("Jornal.Json.Importar"))}</button>
          <button type="button" class="sec" data-action="exportar" data-tooltip="${e(t("Jornal.Json.ExportarDica"))}"><i class="fa-solid fa-file-export"></i> ${e(t("Jornal.Json.Exportar"))}</button>
        </div>
      </nav>
      <form class="jmj-form jmj-ed2-corpo" autocomplete="off">
        <datalist id="jmj-categorias">${CATEGORIAS.map((c) => `<option value="${e(rotCategoria(c))}">`).join("")}</datalist>
        <header class="jmj-ed2-cab"><h2><i class="${lista[i][1]}"></i> ${e(this._nomeEtapa(this.etapa))}</h2>
          <p class="jm-dica">${e(t(`Jornal.Ajuda.${this.etapa}`))}</p></header>
        ${this._htmlEtapa()}
        <footer class="jmj-rodape-form">
          <span class="jm-dica ${this.sujo ? "pendente" : ""}" data-estado-salvo>${e(t(this.sujo ? "Jornal.NaoSalvo" : "Jornal.SalvarNaoPublica"))}</span>
          ${ant ? `<button type="button" class="sec" data-action="etapa" data-etapa="${ant[0]}"><i class="fa-solid fa-arrow-left"></i> ${e(this._nomeEtapa(ant[0]))}</button>` : ""}
          ${prox ? `<button type="button" class="sec" data-action="etapa" data-etapa="${prox[0]}">${e(this._nomeEtapa(prox[0]))} <i class="fa-solid fa-arrow-right"></i></button>` : ""}
          <button type="button" class="sec" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> ${e(t("Jornal.Salvar"))}</button>
          <button type="button" data-action="salvarFechar"><i class="fa-solid fa-check"></i> ${e(t("Jornal.SalvarFechar"))}</button>
        </footer>
      </form>
    </div>`;
  }

  /** Prévia com a cópia do editor (inclui o que ainda não foi salvo). */
  async _montarPrevia(root) {
    const alvo = root.querySelector("[data-previa]");
    if (!alvo || !this.page) return;
    try {
      const pags = await paginasEdicao(this.entry, this.page, { mestre: false, dados: this.dados });
      alvo.innerHTML = `<div class="jl-no-journal">${pags.join("")}</div>`;
      ouvirVinculos(alvo);
    } catch (err) { alvo.innerHTML = `<p class="jm-vazio">${e(String(err?.message ?? err))}</p>`; }
  }

  /** Recolhe somente campos alterados, sem apagar o texto se o ProseMirror falhar. */
  _coletar() {
    if (this._coletando) return;
    this._coletando = true;
    try {
      for (const tx of this._textos ?? []) {
        if (!tx.tocado || !tx.el.isConnected) continue;
        const atual = tx.ler();
        if (typeof atual !== "string" || atual === tx.ultimo) continue;
        tx.ultimo = atual;
        tx.set(atual);
        this._marcar();
      }
    } finally { this._coletando = false; }
  }

  _marcar() {
    this.sujo = true;
    const aviso = this.element?.querySelector("[data-estado-salvo]");
    if (aviso) { aviso.textContent = t("Jornal.NaoSalvo"); aviso.classList.add("pendente"); }
  }

  render(...args) { try { this._coletar(); } catch { /* primeira vez */ } return super.render(...args); }

  /** Editor exclusivo das matérias e da manchete do Jornal de Notícias. */
  _montarTexto(alvo, valor, aoMudar, campoId = "manchete") {
    const original = String(valor ?? "");
    const reg = (el, ler) => {
      const tx = { el, ler, set: aoMudar, ultimo: original, tocado: false };
      // O leitor é associado à instância atual: não confundir áreas de edições diferentes.
      for (const ev of ["keydown", "input", "change", "paste", "drop", "pointerdown"])
        el.addEventListener(ev, () => { tx.tocado = true; }, { capture: true });
      (this._textos ??= []).push(tx);
      return tx;
    };

    // Fallback: um campo HTML editável conserva a formatação já salva. Um textarea
    // exibiria tags HTML ao mestre e poderia sobrescrever uma notícia formatada.
    const alternativo = (onde, conteudo = original) => {
      const area = document.createElement("div");
      area.className = "jm-editor jmj-editor-fallback";
      area.contentEditable = "true";
      area.setAttribute("role", "textbox");
      area.setAttribute("aria-multiline", "true");
      area.setAttribute("aria-label", t("Jornal.Campo.textoManchete"));
      area.innerHTML = conteudo;
      onde.replaceWith(area);
      const tx = reg(area, () => area.innerHTML);
      // A leitura imediata garante que salvar não dependa de perder o foco.
      area.addEventListener("input", () => this._coletar());
      return tx;
    };

    try {
      if (game.settings.get(J.MOD, "editor") === "simples") return alternativo(alvo);
      const PM = foundry.applications?.elements?.HTMLProseMirrorElement;
      if (!PM?.create) throw new Error("Editor ProseMirror indisponível");
      // Usar a mesma API e o mesmo contexto de documento do editor de
      // descrições que já funciona em partes/janela.js. O valor continua
      // numa cópia local: nenhuma edição é gravada até clicar em Salvar.
      const el = PM.create({
        name: `jmj.${campoId}.texto`,
        value: original,
        toggled: false,
        documentUUID: this.page.uuid,
        collaborate: false,
        readonly: false,
        height: 220
      });
      el.classList.add("jm-editor");
      alvo.replaceWith(el);
      const lerPM = () => {
        // Somente ao salvar/trocar de etapa, não a cada digitação:
        // chamar save() dentro de input pode atrapalhar o cursor do PM.
        if (el.isDirty?.()) el.save();
        return typeof el.value === "string" ? el.value : null;
      };
      const tx = reg(el, lerPM);
      // O editor de descrições também encaminha cliques sobre a área
      // vazia para a superfície de edição propriamente dita.
      el.addEventListener("pointerdown", (ev) => {
        const campo = el.querySelector('.ProseMirror[contenteditable="true"], [contenteditable="true"]');
        if (campo && !campo.contains(ev.target) && !ev.target.closest("menu, button, .editor-menu, .jmj-editor-alternar")) {
          ev.preventDefault();
          campo.focus();
        }
      });
      // Marcar alterações sem forçar serialização a cada tecla.
      el.addEventListener("input", () => this._marcar());
      el.addEventListener("change", () => this._marcar());
      // O botão alternativo é uma saída explícita caso o campo rico
      // apareça mas não receba digitação (caso relatado no Foundry 14).
      const alternar = document.createElement("button");
      alternar.type = "button";
      alternar.className = "jmj-editor-alternar sec";
      alternar.textContent = "✎ " + t("Jornal.EdicaoDireta");
      alternar.title = t("Jornal.EdicaoDiretaDica");
      el.insertAdjacentElement("afterend", alternar);
      alternar.addEventListener("click", () => {
        let conteudo = original;
        try {
          if (tx.tocado) {
            const atual = lerPM();
            if (typeof atual === "string") conteudo = atual;
          }
        } catch (err) { console.warn("Journal da Mesa | coleta do editor de jornal", err); }
        this._textos = (this._textos ?? []).filter((item) => item !== tx);
        alternar.remove();
        const campo = alternativo(el, conteudo);
        campo.el.focus();
      });
      this._conferirEditor(el, original, (onde, conteudo) => {
        alternar.remove();
        return alternativo(onde, conteudo);
      }, tx);
      return tx;
    } catch (err) {
      J.avisoUmaVez(t("Jornal.EditorSimples"), err);
      return alternativo(alvo);
    }
  }

  /** Detecta editor carregado sem uma área onde realmente se possa escrever. */
  _conferirEditor(el, original, alternativo, tx) {
    const textoVisivel = (h) => String(h ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const pronto = () => {
      const campo = el.querySelector('.ProseMirror[contenteditable="true"], [contenteditable="true"]');
      if (!campo || el.editable === false) return false;
      const rect = campo.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      if (textoVisivel(original) && !textoVisivel(campo.innerHTML)) return false;
      return true;
    };
    let verificado = false;
    const verificar = () => {
      if (verificado || !el.isConnected) return;
      if (pronto()) { verificado = true; return; }
      verificado = true;
      // Se houve alguma edição antes do diagnóstico, conserva o valor disponível.
      let conteudo = original;
      try {
        const salvo = typeof el.value === "string" ? el.value : null;
        if (tx.tocado && salvo != null && salvo !== original) conteudo = salvo;
      } catch { /* ainda inicializando */ }
      this._textos = (this._textos ?? []).filter((item) => item !== tx);
      alternativo(el, conteudo);
      J.avisoUmaVez(t("Jornal.EditorSimples"), new Error("ProseMirror não disponibilizou área editável para o Jornal de Notícias."));
    };
    // Dá tempo para o custom element conectar e terminar a criação interna.
    el.addEventListener("open", () => queueMicrotask(verificar), { once: true });
    setTimeout(verificar, 1500);
  }

  _materia(id) { return this.dados.materias.find((m) => m.id === id); }

  _ouvintes(root) {
    const form = root.querySelector("form");
    // nunca enviar o formulário (o navegador recarregaria a página do Foundry)
    form?.addEventListener("submit", (ev) => ev.preventDefault());
    form?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && ev.target.matches?.("input:not([type=checkbox]), select")) ev.preventDefault();
    });
    root.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.c;
      this.dados[k] = k === "numero" ? Math.max(0, Math.trunc(Number(el.value) || 0)) : el.value;
      this._marcar();
      if (this.modo === "jornal" && k === "organizacao") this.render();
    }));
    if (this.modo !== "edicao") return;
    if (this.etapa === "previa") this._montarPrevia(root);
    root.querySelector("[data-data-edicao]")?.querySelectorAll("[data-parte]").forEach((el) => el.addEventListener("change", () => {
      const caixa = el.closest("[data-data-edicao]");
      const v = (k) => Number(caixa.querySelector(`[data-parte="${k}"]`)?.value);
      const td = J.Tempo.tdDe(v("ano"), v("mes"), v("dia"));
      if (td == null) return ui.notifications.warn(t("Jornal.DataNaoExiste"));
      this.dados.td = td; this._marcar();
    }));
    const pmEd = root.querySelector("[data-pm-edicao]");
    if (pmEd) this._montarTexto(pmEd, this.dados.texto, (v) => { this.dados.texto = v; }, "manchete");
    root.querySelectorAll("[data-pm-materia]").forEach((alvo) => {
      const m = this._materia(alvo.dataset.pmMateria);
      if (m) this._montarTexto(alvo, m.texto, (v) => { m.texto = v; }, m.id);
    });
    root.querySelectorAll("[data-m] [data-mc]").forEach((el) => el.addEventListener("change", () => {
      const m = this._materia(el.closest("[data-m]").dataset.m);
      if (!m) return;
      m[el.dataset.mc] = el.value; this._marcar();
      if (el.dataset.mc === "secao") { this.materiaAberta = null; this.render(); }
    }));
    root.querySelectorAll("[data-m] [data-sc]").forEach((el) => el.addEventListener("change", () => {
      const id = el.closest("[data-m]").dataset.m;
      this.seg.materias[id] = { ...(this.seg.materias[id] ?? {}), [el.dataset.sc]: el.value }; this._marcar();
    }));
    root.querySelector("[data-seg-nota]")?.addEventListener("change", (ev) => { this.seg.nota = ev.target.value; this._marcar(); });
    // arrastar um Diário, página, ator ou item (barra lateral do Foundry ou lista do Journal) para a matéria
    root.querySelectorAll("[data-drop-vinculo]").forEach((zona) => {
      zona.addEventListener("dragover", (ev) => { ev.preventDefault(); zona.classList.add("sobre"); });
      zona.addEventListener("dragleave", () => zona.classList.remove("sobre"));
      zona.addEventListener("drop", (ev) => {
        ev.preventDefault(); ev.stopPropagation(); zona.classList.remove("sobre");
        let d = null;
        try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { d = null; }
        if (!d?.uuid) { try { d = J.TE().getDragEventData(ev); } catch { d = null; } }
        if (d?.uuid) this._ligar(zona.dataset.dropVinculo, [d.uuid]);
        else ui.notifications.warn(t("Jornal.UuidInvalido"));
      });
    });

  }

  _ligar(mid, uuids) {
    const m = this._materia(mid);
    if (!m) return;
    let novos = 0;
    for (const u of uuids) {
      if (!uuidValido(u) || !descreverVinculo(u)) { ui.notifications.warn(t("Jornal.UuidInvalido")); continue; }
      if (!m.vinculos.includes(u)) {
        m.vinculos.push(u); novos++;
        // NPC, local, organização, divindade, loja ou ator com imagem: já entra com a foto na matéria
        if (fotoAutomatica(u)) (m.fotos ??= []).includes(u) || m.fotos.push(u);
      }
    }
    if (!novos) return;
    this._marcar();
    this.materiaAberta = mid;
    this.render();
  }

  async _gravar() {
    this._coletar();
    const en = this.entry;
    if (!ehJornal(en)) { ui.notifications.error(t("Jornal.JornalApagado")); return false; }
    try {
      if (this.modo === "jornal") {
        const ident = normalizarIdentidade(this.dados);
        if (ident.organizacao) ident.orgTexto = "";
        await en.update({ name: String(this.dados.nome ?? "").trim().slice(0, 200) || en.name, [`flags.${J.MOD}.jornal`]: ident });
      } else {
        const p = this.page;
        if (!ehEdicao(p)) { ui.notifications.error(t("Jornal.EdicaoApagada")); return false; }
        const ed = normalizarEdicao(this.dados);
        await gravarEdicao(p, ed);
        await gravarSegredos(p.id, this.seg, ed.materias.map((m) => m.id));
        this.dados = lerEdicao(p);
      }
      this.sujo = false;
      ui.notifications.info(t("Jornal.Salvo"));
      return true;
    } catch (err) { J.relatarErro(t("Jornal.ErroSalvar"), err); return false; }
  }

  async close(options = {}) {
    try { this._coletar(); } catch { /* janela já sem conteúdo */ }
    if (this.sujo && !options.semPerguntar) {
      const escolha = await J.Dialogo().wait({
        window: { title: t("Jornal.NaoSalvoTitulo") }, content: `<p>${e(t("Jornal.SalvarAntes"))}</p>`,
        buttons: [{ action: "salvar", label: t("Jornal.Salvar"), icon: "fa-solid fa-floppy-disk", default: true }, { action: "descartar", label: t("Jornal.Descartar") }, { action: "voltar", label: t("Jornal.ContinuarEditando") }],
        rejectClose: false
      }).catch(() => "voltar");
      if (escolha === "voltar" || escolha == null) return this;
      if (escolha === "salvar" && !(await this._gravar())) return this;
    }
    ABERTOS.delete(`${this.entryId}:${this.pageId ?? ""}`);
    return super.close(options);
  }

  static async _salvar() { if (await this._gravar()) this.render(); }
  static async _salvarFechar() { if (await this._gravar()) this.close({ semPerguntar: true }); }
  static _addMateria(ev, el) {
    const m = materiaPadrao(el.dataset.secao);
    this.dados.materias.push(m);
    this.materiaAberta = m.id;
    this._marcar(); this.render();
  }
  static async _tirarMateria(ev, el) {
    ev.preventDefault?.();
    const m = this._materia(el.dataset.m);
    if (!m) return;
    const ok = await J.Dialogo().confirm({ window: { title: t("Jornal.RemoverMateria") }, content: `<p>${e(t("Jornal.RemoverMateriaPergunta", { titulo: m.titulo || t("Jornal.SemTitulo") }))}</p>` });
    if (!ok) return;
    this.dados.materias = this.dados.materias.filter((x) => x.id !== m.id);
    delete this.seg.materias[m.id];
    this._marcar(); this.render();
  }
  static _moverMateria(ev, el) {
    ev.preventDefault?.();
    const l = this.dados.materias;
    const m = this._materia(el.dataset.m);
    if (!m) return;
    const mesmas = l.filter((x) => x.secao === m.secao);
    const alvo = mesmas[mesmas.indexOf(m) + Number(el.dataset.d)];
    if (!alvo) return;
    const a = l.indexOf(m), b = l.indexOf(alvo);
    [l[a], l[b]] = [l[b], l[a]];
    this._marcar(); this.render();
  }
  static _escolherImagem(ev, el) {
    const alvo = el.dataset.alvo;
    const m = alvo === "materia" ? this._materia(el.dataset.m) : null;
    const atual = m ? m.imagem : this.dados[alvo];
    new (J.FP())({ type: "image", current: atual || "", callback: (caminho) => {
      if (m) m.imagem = caminho; else this.dados[alvo] = caminho;
      this._marcar(); this.render();
    } }).render(true);
  }
  static async _vincular(ev, el) {
    const m = this._materia(el.dataset.m);
    if (!m) return;
    const escolhidos = await SeletorVinculo.escolher(m.vinculos);
    if (escolhidos.length) this._ligar(m.id, escolhidos);
  }
  static _fotoVinculo(ev, el) {
    ev.preventDefault?.();
    const m = this._materia(el.dataset.m);
    if (!m) return;
    m.fotos ??= [];
    m.fotos = m.fotos.includes(el.dataset.u) ? m.fotos.filter((u) => u !== el.dataset.u) : [...m.fotos, el.dataset.u];
    this._marcar(); this.render();
  }
  static _tirarVinculo(ev, el) {
    ev.preventDefault?.();
    const m = this._materia(el.dataset.m);
    if (!m) return;
    m.fotos = (m.fotos ?? []).filter((u) => u !== el.dataset.u);
    m.vinculos = m.vinculos.filter((u) => u !== el.dataset.u);
    this._marcar(); this.render();
  }
  static _etapa(ev, el) { this.etapa = el.dataset.etapa; this.render(); this.element?.querySelector(".jmj-ed2-corpo")?.scrollTo?.(0, 0); }
  static _abrirMateria(ev, el) { this.materiaAberta = el.dataset.m || null; this.render(); }
  static async _importarAqui() {
    const texto = await dialogoImportar(this.entry, { destino: "edicao" });
    if (!texto) return;
    try {
      const lista = lerJson(texto);
      const bruto = lista[0];
      const { ed, seg, relatorio } = converterEdicao(bruto, this.entry, this.dados.numero);
      if (lista.length > 1) relatorio.unshift(t("Jornal.Json.SoPrimeira", { n: lista.length }));
      // importar aqui troca o conteúdo da edição aberta; número e data ficam se o JSON não trouxer
      if (bruto.numero == null) ed.numero = this.dados.numero;
      if (bruto.data == null) { ed.td = this.dados.td; ed.dataTexto = this.dados.dataTexto; }
      this.dados = { ...this.dados, ...ed, estado: this.dados.estado };
      this.seg = seg;
      this.materiaAberta = null;
      this._marcar(); this.render();
      mostrarRelatorio(relatorio);
      ui.notifications.info(t("Jornal.Json.ImportadoAqui"));
    } catch (err) { console.warn("Journal da Mesa | importar na edição aberta", err); ui.notifications.error(String(err?.message ?? err)); }
  }
  static _exportar() {
    if (this.sujo) ui.notifications.info(t("Jornal.Json.ExportaSalvo"));
    exportarEdicao(this.page);
  }
  static _abrirVinculo(ev, el) { ev.preventDefault?.(); abrirVinculo(el.dataset.u); }
  static _ler() {
    if (this.sujo) ui.notifications.info(t("Jornal.LerSalvoAviso"));
    J.lerEdicao(this.entryId, this.pageId);
  }
}

/** Se a edição ou o jornal for apagado enquanto o editor está aberto, ele fecha sem perguntar. */
export function fecharEditoresDe(entryId, pageId = null) {
  for (const [k, ed] of ABERTOS) {
    if (ed.entryId === entryId && (pageId == null || ed.pageId === pageId)) ed.close({ semPerguntar: true });
    if (!ed.rendered) ABERTOS.delete(k);
  }
}
