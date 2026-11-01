/* Journal — barra lateral nativa: dono das páginas, menus de botão direito, botões do Journal.
 * Parte do journal.js; depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T } from "../idioma.js";
import { abreNoJournal } from "./tempo.js";
import { MOD, abrirJournal, bolinhasDono, dicaNota, ehGM, esc, escolherTipoECriar, notaMestre, pastaMarcadaOculta, revelarPara } from "../nucleo.js";

/* ---------- visualizador de permissões nas barras nativas ---------- */
function marcarDonos(app, html) {
  if (!ehGM() || !game.settings.get(MOD, "donos")) return;
  const root = html instanceof HTMLElement ? html : null;
  const colecao = app?.collection ?? app?.documents;
  if (!root || !colecao?.get) return;
  root.querySelectorAll("li[data-entry-id], li[data-document-id]").forEach((li) => {
    if (li.querySelector(":scope > .jm-donos")) return;
    const doc = colecao.get(li.dataset.entryId ?? li.dataset.documentId);
    const html2 = doc ? bolinhasDono(doc) : "";
    if (!html2) return;
    li.insertAdjacentHTML("beforeend", html2);
    li.querySelector(":scope > .jm-donos").addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      revelarPara(doc);
    });
  });
}
Hooks.on("renderDocumentDirectory", marcarDonos);

/* menu de botão direito da barra lateral nativa */
const elDe = (li) => (li instanceof HTMLElement ? li : null);
function opcaoAbrirNoJournal(app, opcoesMenu) {
  if (opcoesMenu.some((o) => o.name === T("Barra.AbrirNoJournalDaMesa"))) return;
  opcoesMenu.unshift({
    name: T("Barra.AbrirNoJournalDaMesa"),
    icon: `<i class="fa-solid fa-book-open"></i>`,
    callback: (li) => { const el = elDe(li); abrirJournal(el?.dataset.entryId ?? el?.dataset.documentId); }
  });
  opcoesMenu.push({
    name: T("Barra.QuemVePorJogador"),
    icon: `<i class="fa-solid fa-user-check"></i>`,
    condition: () => ehGM(),
    callback: (li) => { const el = elDe(li); const d = game.journal.get(el?.dataset.entryId ?? el?.dataset.documentId); if (d) revelarPara(d); }
  });
}
Hooks.on("getJournalEntryContextOptions", opcaoAbrirNoJournal);

function opcaoCriarNaPasta(app, opcoesMenu) {
  if (app && app.documentName && app.documentName !== "JournalEntry" && app.constructor?.name !== "JournalDirectory") return;
  if (opcoesMenu.some((o) => o.name === T("Comum.NovaPaginaDoJournalDa"))) return;
  opcoesMenu.unshift({
    name: T("Comum.NovaPaginaDoJournalDa"),
    icon: `<i class="fa-solid fa-book-open"></i>`,
    condition: (li) => ehGM() && game.folders.get(elDe(li)?.closest("[data-folder-id]")?.dataset.folderId)?.type === "JournalEntry",
    callback: (li) => escolherTipoECriar(elDe(li)?.closest("[data-folder-id]")?.dataset.folderId ?? null)
  });
}
Hooks.on("getFolderContextOptions", opcaoCriarNaPasta);

Hooks.on("renderJournalDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : null;
  if (!root) return;

  if (!root.querySelector(".jm-abrir")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jm-abrir";
    btn.innerHTML = `<i class="fa-solid fa-book-open"></i> ${T("Comum.JournalDaMesa")}`;
    btn.addEventListener("click", () => abrirJournal());
    const lugar = root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root;
    lugar.append(btn);
    if (ehGM()) {
      const novo = document.createElement("button");
      novo.type = "button";
      novo.className = "jm-abrir jm-novo-nativo";
      novo.innerHTML = `<i class="fa-solid fa-plus"></i> ${T("Barra.PaginaDoJournalDaMesa")}`;
      novo.addEventListener("click", () => escolherTipoECriar(null));
      lugar.append(novo);
    }
  }

  if (ehGM()) root.querySelectorAll("li[data-entry-id]").forEach((li) => {
    const nota = notaMestre(game.journal.get(li.dataset.entryId));
    if (!nota) return;
    li.dataset.tooltip = `<b>${esc(game.journal.get(li.dataset.entryId).name)}</b><br>${dicaNota(nota)}`;
    li.dataset.tooltipDirection = "LEFT";
    li.classList.add("jm-com-nota");
  });

  root.querySelectorAll("[data-folder-id]").forEach((li) => {
    const f = game.folders.get(li.dataset.folderId);
    if (f?.type === "JournalEntry" && pastaMarcadaOculta(f)) (li.closest("li") ?? li).classList.add("jm-pasta-oculta-nativa");
  });

  if (!root.dataset.jmClique) {
    root.dataset.jmClique = "1";
    root.addEventListener("click", (ev) => {
      if (!game.settings.get(MOD, "abrirAqui")) return;
      const li = ev.target.closest("[data-entry-id], [data-document-id]");
      if (!li || li.closest(".folder-header") || li.classList.contains("folder")) return;
      if (ev.target.closest(".entry-controls, .control, button")) return;
      const id = li.dataset.entryId ?? li.dataset.documentId;
      if (!game.journal.get(id) || !abreNoJournal(game.journal.get(id))) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      abrirJournal(id);
    }, true);
  }
});
