/* Jornal de Notícias — janela de leitura (a edição como um jornal de verdade).
 * Sem formulário: só as folhas, roláveis com o mouse, e uma barra discreta para trocar de página
 * e de edição. Mostra só o que o leitor pode ler; nunca mostra a veracidade (nem para o mestre). */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { ehEdicao, podeLerEdicao, lerEdicao, edicoes, publicaEstado, identidade } from "./dados.js";
import { paginasEdicao, ouvirVinculos } from "./leitura.js";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const ABERTOS = new Map();
const e = (s) => J.esc(s);

export class LeitorJornal extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["jl-leitor"],
    tag: "div",
    window: { title: "Jornal", icon: "fa-solid fa-newspaper", resizable: true },
    position: { width: 980, height: 860 },
    actions: {
      pagina: LeitorJornal._pagina,
      edicao: LeitorJornal._edicao,
      noJournal: LeitorJornal._noJournal
    }
  };

  /** Abre a leitura de uma edição (ou traz a janela aberta do mesmo jornal para essa edição). */
  static abrir(entryId, pageId) {
    const p = game.journal.get(entryId)?.pages.get(pageId);
    if (!ehEdicao(p) || !podeLerEdicao(p)) { ui.notifications.warn(t("Jornal.SemAcesso")); return null; }
    let l = ABERTOS.get(entryId);
    if (!l?.rendered) { l = new LeitorJornal({ id: `jl-leitor-${entryId}` }); ABERTOS.set(entryId, l); }
    l.entryId = entryId; l.pageId = pageId; l.pagina = 1;
    // já aberta: troca a edição e vem para a frente. Nova: só desenha (bringToFront antes de a janela
    // existir dava "can't access property 'style', this[#element] is undefined").
    const jaAberta = l.rendered;
    const r = l.render({ force: true });
    if (jaAberta) { try { l.bringToFront(); } catch { /* a janela ainda está redesenhando */ } }
    r?.catch?.((err) => J.relatarErro(t("Jornal.Ler"), err));
    return l;
  }

  get entry() { return game.journal.get(this.entryId) ?? null; }
  get page() { return this.entry?.pages.get(this.pageId) ?? null; }
  get title() {
    const ed = lerEdicao(this.page);
    return ed ? `${this.entry.name} — ${t("Jornal.EdicaoN", { n: ed.numero })}` : t("Jornal.Titulo");
  }

  /** Edições que este leitor pode abrir pela barra (jogador: só publicadas; mestre: todas). */
  _lista() {
    return edicoes(this.entry).filter(({ ed }) => game.user.isGM || publicaEstado(ed.estado));
  }

  async _renderHTML() {
    const p = this.page;
    if (!ehEdicao(p) || !podeLerEdicao(p)) return `<p class="jl-vazio">${e(t("Jornal.SemAcesso"))}</p>`;
    const paginas = await paginasEdicao(this.entry, p, { mestre: false });
    this.total = paginas.length;
    this.pagina = Math.min(Math.max(1, this.pagina ?? 1), this.total);
    const lista = this._lista();
    const i = lista.findIndex((x) => x.p.id === p.id);
    const ant = lista[i + 1], prox = lista[i - 1];   // a lista vem da mais nova para a mais antiga
    const est = identidade(this.entry).estilo;
    return `<div class="jl-mesa estilo-${est}">
      <div class="jl-paginas">${paginas.join("")}</div>
      <nav class="jl-barra">
        <button type="button" data-action="edicao" data-page="${ant?.p.id ?? ""}" ${ant ? "" : "disabled"} data-tooltip="${e(t("Jornal.EdicaoAnterior"))}"><i class="fa-solid fa-backward-step"></i></button>
        ${this.total > 1 ? `<button type="button" data-action="pagina" data-d="-1" ${this.pagina <= 1 ? "disabled" : ""} data-tooltip="${e(t("Jornal.PaginaAnterior"))}"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="jl-barra-pag">${e(t("Jornal.PaginaDe", { n: this.pagina, total: this.total }))}</span>
        <button type="button" data-action="pagina" data-d="1" ${this.pagina >= this.total ? "disabled" : ""} data-tooltip="${e(t("Jornal.ProximaPagina"))}"><i class="fa-solid fa-chevron-right"></i></button>` : `<span class="jl-barra-pag">${e(t("Jornal.RoleParaLer"))}</span>`}
        <button type="button" data-action="edicao" data-page="${prox?.p.id ?? ""}" ${prox ? "" : "disabled"} data-tooltip="${e(t("Jornal.ProximaEdicao"))}"><i class="fa-solid fa-forward-step"></i></button>
        <button type="button" data-action="noJournal" data-tooltip="${e(t("Jornal.AbrirNoJournal"))}"><i class="fa-solid fa-book-open"></i></button>
      </nav>
    </div>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    ouvirVinculos(content);
    const rolagem = content.querySelector(".jl-paginas");
    // a página da barra acompanha a rolagem
    rolagem?.addEventListener("scroll", () => {
      const topo = rolagem.getBoundingClientRect().top;
      let atual = 1;
      for (const f of rolagem.querySelectorAll("[data-jl-pagina]")) if (f.getBoundingClientRect().top - topo < rolagem.clientHeight / 3) atual = Number(f.dataset.jlPagina);
      if (atual !== this.pagina) {
        this.pagina = atual;
        const span = content.querySelector(".jl-barra-pag");
        if (span && this.total > 1) span.textContent = t("Jornal.PaginaDe", { n: atual, total: this.total });
        content.querySelector('[data-action="pagina"][data-d="-1"]')?.toggleAttribute("disabled", atual <= 1);
        content.querySelector('[data-action="pagina"][data-d="1"]')?.toggleAttribute("disabled", atual >= this.total);
      }
    }, { passive: true });
  }

  static _pagina(ev, el) {
    const alvo = Math.min(Math.max(1, (this.pagina ?? 1) + Number(el.dataset.d)), this.total ?? 1);
    this.element.querySelector(`[data-jl-pagina="${alvo}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  static _edicao(ev, el) { if (el.dataset.page) { this.pageId = el.dataset.page; this.pagina = 1; this.render(); } }
  static _noJournal() { J.abrirEdicaoNoJournal(this.entryId, this.pageId); }
}

/** Uma edição mudou ou foi despublicada: atualiza (ou fecha) a leitura aberta. */
export function atualizarLeitores(entryId = null) {
  for (const [id, l] of ABERTOS) {
    if (!l.rendered) { ABERTOS.delete(id); continue; }
    if (entryId && id !== entryId) continue;
    if (!ehEdicao(l.page) || !podeLerEdicao(l.page)) l.close();
    else l.render();
  }
}
