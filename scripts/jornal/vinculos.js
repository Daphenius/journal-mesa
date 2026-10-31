/* Jornal de Notícias — escolher documentos para ligar a uma matéria (só o mestre).
 * Janela própria com busca, grupos (NPCs, locais, organizações, missões, divindades, eventos do
 * calendário, outros diários, personagens, atores, itens), marcação de vários de uma vez e um campo
 * para colar um UUID. Devolve UUIDs: a matéria guarda só a referência, nunca uma cópia do documento. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { ehJornal, uuidValido, docDe } from "./dados.js";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const e = (s) => J.esc(s);

/** Grupos de documentos que podem ser citados. */
export function documentosCitaveis() {
  const grupos = new Map();
  const add = (chave, icone, doc) => { if (!grupos.has(chave)) grupos.set(chave, { icone, itens: [] }); grupos.get(chave).itens.push(doc); };
  for (const j of game.journal) {
    if (ehJornal(j)) continue;
    const a = J.analisar(j);
    if (j.flags?.[J.CAL]?.nota) add("evento", "fa-solid fa-calendar-day", j);
    else if (["person", "place", "organization", "quest", "deus", "shop"].includes(a.tipo)) add(a.tipo, J.TIPOS[a.tipo].icone, j);
    else add("diario", "fa-solid fa-book", j);
  }
  for (const a of game.actors ?? []) add(a.hasPlayerOwner ? "personagem" : "ator", a.hasPlayerOwner ? "fa-solid fa-user-shield" : "fa-solid fa-user", a);
  for (const i of game.items ?? []) add("item", "fa-solid fa-box", i);
  const ordem = ["person", "place", "organization", "quest", "deus", "shop", "evento", "diario", "personagem", "ator", "item"];
  return ordem.filter((k) => grupos.has(k)).map((k) => ({ chave: k, ...grupos.get(k), itens: grupos.get(k).itens.sort((a, b) => a.name.localeCompare(b.name)) }));
}
export const rotGrupo = (k) => t(`Jornal.Grupo.${k}`);

/** Nome amigável e ícone de um UUID (ou null se o documento não existe mais). */
export function descreverVinculo(uuid) {
  const doc = docDe(uuid);
  if (!doc) return null;
  const dono = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
  let icone = "fa-solid fa-link";
  if (dono.documentName === "JournalEntry") icone = dono.flags?.[J.CAL]?.nota ? "fa-solid fa-calendar-day" : (J.TIPOS[J.analisar(dono).tipo]?.icone ?? "fa-solid fa-book");
  else if (dono.documentName === "Actor") icone = dono.hasPlayerOwner ? "fa-solid fa-user-shield" : "fa-solid fa-user";
  else if (dono.documentName === "Item") icone = "fa-solid fa-box";
  return { doc, nome: doc === dono ? doc.name : `${dono.name} › ${doc.name}`, icone };
}

export class SeletorVinculo extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["jm-janela", "jmj-seletor"],
    tag: "div",
    window: { title: t("Jornal.VinculosTitulo"), icon: "fa-solid fa-link", resizable: true },
    position: { width: 480, height: 600 },
    actions: { confirmar: SeletorVinculo._confirmar }
  };

  /** Abre e devolve (Promise) a lista de UUIDs escolhidos, ou [] se fechar. */
  static escolher(jaLigados = []) {
    return new Promise((resolve) => {
      const s = new SeletorVinculo();
      s.jaLigados = new Set(jaLigados);
      s.resolver = resolve;
      s.render({ force: true });
    });
  }

  get title() { return t("Jornal.EscolherVinculos"); }

  async _renderHTML() {
    const grupos = documentosCitaveis();
    return `<div class="jmj-sel">
      <div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-sel-busca placeholder="${e(t("Jornal.BuscarDocumento"))}" autofocus></div>
      <div class="jmj-sel-lista">${grupos.map((g) => `<details class="jmj-sel-grupo" open data-sel-grupo><summary><i class="${g.icone}"></i> ${e(rotGrupo(g.chave))} <small>${g.itens.length}</small></summary>
        ${g.itens.map((d) => `<label class="jmj-sel-item ${this.jaLigados.has(d.uuid) ? "ja" : ""}" data-sel-nome="${e(d.name.toLowerCase())}">
          <input type="checkbox" value="${e(d.uuid)}" ${this.jaLigados.has(d.uuid) ? "checked disabled" : ""}> <span>${e(d.name)}</span>${this.jaLigados.has(d.uuid) ? ` <small>${e(t("Jornal.JaLigado"))}</small>` : ""}</label>`).join("")}</details>`).join("")
        || `<p class="jm-vazio">${e(t("Jornal.NadaParaLigar"))}</p>`}</div>
      <label class="jmj-sel-uuid">${e(t("Jornal.ColarUuid"))} <input type="text" data-sel-uuid placeholder="JournalEntry.abc123... / Actor.xyz..."></label>
      <footer class="jmj-rodape-form"><span class="jm-dica" data-sel-conta></span><button type="button" data-action="confirmar"><i class="fa-solid fa-link"></i> ${e(t("Jornal.Ligar"))}</button></footer>
    </div>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    try { this.element.dataset.tema = game.settings.get(J.MOD, "tema"); } catch { /* padrão */ }
    const busca = content.querySelector("[data-sel-busca]");
    const conta = content.querySelector("[data-sel-conta]");
    const atualizarConta = () => { const n = content.querySelectorAll(".jmj-sel-item input:checked:not(:disabled)").length; conta.textContent = n ? t("Jornal.Marcados", { n }) : ""; };
    busca?.addEventListener("input", () => {
      const q = busca.value.trim().toLowerCase();
      content.querySelectorAll("[data-sel-grupo]").forEach((g) => {
        let algum = false;
        g.querySelectorAll("[data-sel-nome]").forEach((i) => { i.hidden = !!q && !i.dataset.selNome.includes(q); if (!i.hidden) algum = true; });
        g.hidden = !algum;
      });
    });
    content.querySelectorAll(".jmj-sel-item input").forEach((c) => c.addEventListener("change", atualizarConta));
    content.querySelector("[data-sel-uuid]")?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); SeletorVinculo._confirmar.call(this); } });
    busca?.focus();
  }

  static _confirmar() {
    const marcados = [...this.element.querySelectorAll(".jmj-sel-item input:checked:not(:disabled)")].map((c) => c.value);
    const colado = String(this.element.querySelector("[data-sel-uuid]")?.value ?? "").trim().replace(/^@UUID\[([^\]]+)\].*$/, "$1");
    if (colado) {
      if (!uuidValido(colado) || !descreverVinculo(colado)) return ui.notifications.warn(t("Jornal.UuidInvalido"));
      marcados.push(colado);
    }
    const r = this.resolver; this.resolver = null;
    r?.(marcados);
    this.close();
  }

  async close(options) {
    this.resolver?.([]); this.resolver = null;
    return super.close(options);
  }
}
