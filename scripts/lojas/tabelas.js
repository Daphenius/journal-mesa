/* Journal — tabelas de itens das lojas (configurações do módulo).
 *
 * Janela "Tabelas de itens das lojas" (Configurações do módulo › Escolher tabelas):
 *  - quais Tabelas de rolagem aparecem nas lojas (nenhuma marcada = todas);
 *  - tabela padrão do estoque semanal e das ofertas diárias (vale para a loja que não escolheu uma);
 *  - "Criar tabelas prontas": monta tabelas a partir de um compêndio de itens (o do D&D 5e, por exemplo),
 *    separadas por tipo e raridade, numa pasta própria. Os resultados apontam para os itens do compêndio
 *    (nada é copiado para o mundo até alguém comprar).
 * Setting "lojasTabelas" (mundo): { visiveis: [uuid], semanal: uuid, diaria: uuid }. */
const C = {};   // MOD, T, esc (entregues pelo journal.js)
const ApplicationV2 = foundry.applications.api.ApplicationV2;
const CHAVE = "lojasTabelas";
const PASTA = "Journal — tabelas das lojas";

export function configurarTabelasLojas(ctx) { Object.assign(C, ctx); }

export function cfgTabelas() {
  try {
    const c = game.settings.get(C.MOD, CHAVE) ?? {};
    return { visiveis: Array.isArray(c.visiveis) ? c.visiveis.filter((u) => typeof u === "string") : [], semanal: String(c.semanal ?? ""), diaria: String(c.diaria ?? "") };
  } catch { return { visiveis: [], semanal: "", diaria: "" }; }
}
/** Tabelas oferecidas nos seletores das lojas: [uuid, nome]. A escolhida pela loja aparece mesmo fora do filtro. */
export function tabelasDasLojas(atuais = []) {
  const manter = new Set([atuais].flat().filter(Boolean));
  const { visiveis } = cfgTabelas();
  const filtro = new Set(visiveis);
  return game.tables.filter((t) => !filtro.size || filtro.has(t.uuid) || manter.has(t.uuid)).map((t) => [t.uuid, t.name]);
}
/** Tabela de uma loja: a dela ou a padrão do módulo. */
export function tabelaDaLoja(propria, tipo) {
  if (propria) return propria;
  const c = cfgTabelas();
  return (tipo === "diaria" ? c.diaria : c.semanal) || "";
}
export const nomeTabela = (uuid) => { try { return fromUuidSync(uuid)?.name ?? ""; } catch { return ""; } };

/* ---------- tabelas prontas a partir de um compêndio ---------- */
const RARIDADES = ["common", "uncommon", "rare", "veryRare", "legendary"];
const GRUPOS = [
  { nome: "Armas", teste: (i) => i.type === "weapon" && !i.raridade },
  { nome: "Armaduras e escudos", teste: (i) => i.type === "equipment" && !i.raridade && ["light", "medium", "heavy", "shield"].includes(i.sub) },
  { nome: "Equipamento de aventura", teste: (i) => !i.raridade && (["loot", "container", "tool"].includes(i.type) || (i.type === "equipment" && !["light", "medium", "heavy", "shield"].includes(i.sub))) },
  { nome: "Poções e consumíveis", teste: (i) => i.type === "consumable" && (!i.raridade || i.raridade === "common") },
  { nome: "Itens mágicos comuns", teste: (i) => i.magico && i.raridade === "common" && i.type !== "consumable" },
  { nome: "Itens mágicos incomuns", teste: (i) => i.magico && i.raridade === "uncommon" },
  { nome: "Itens mágicos raros", teste: (i) => i.magico && i.raridade === "rare" },
  { nome: "Itens mágicos muito raros", teste: (i) => i.magico && i.raridade === "veryRare" },
  { nome: "Itens mágicos lendários", teste: (i) => i.magico && i.raridade === "legendary" }
];
export function compendiosDeItens() {
  return game.packs.filter((p) => p.documentName === "Item").map((p) => ({ id: p.collection, nome: `${p.metadata.label} (${p.collection})` }));
}
function compendioPadrao() {
  const l = compendiosDeItens();
  return (l.find((p) => /dnd5e\.(items|equipment)/.test(p.id)) ?? l.find((p) => /dnd5e/.test(p.id)) ?? l[0])?.id ?? "";
}

/** Cria as tabelas prontas. Devolve { criadas, puladas, vazias }. Tabela com o mesmo nome na pasta é pulada. */
export async function criarTabelasProntas(packId) {
  if (!game.user.isGM) return null;
  const pack = game.packs.get(packId);
  if (!pack || pack.documentName !== "Item") throw new Error(C.T("Compêndio de itens não encontrado."));
  const indice = await pack.getIndex({ fields: ["type", "system.rarity", "system.type.value", "system.price"] });
  const itens = indice.map((e) => {
    const raridade = ["artifact"].includes(e.system?.rarity) ? "artifact" : (RARIDADES.includes(e.system?.rarity) ? e.system.rarity : "");
    const preco = Number(e.system?.price?.value ?? e.system?.price ?? 0) || 0;
    return { e, type: e.type, sub: e.system?.type?.value ?? "", raridade, preco, magico: !!raridade };
  }).filter((i) => i.raridade !== "artifact" && (i.raridade || i.preco > 0));
  // a pasta é achada pela marca (e pelo nome, para as criadas antes da 4.9); a nova já sai no idioma do mestre
  let pasta = game.folders.find((f) => f.type === "RollTable" && (f.flags?.[C.MOD]?.tabelasLojas || f.name === PASTA || f.name === C.T(PASTA)));
  pasta ??= await Folder.create({ name: C.T(PASTA), type: "RollTable", flags: { [C.MOD]: { tabelasLojas: true } } });
  const r = { criadas: 0, puladas: 0, vazias: 0 };
  for (const g of GRUPOS) {
    const nome = C.T(g.nome);
    if (game.tables.some((t) => t.folder?.id === pasta.id && t.name === nome)) { r.puladas++; continue; }
    const l = itens.filter(g.teste).sort((a, b) => a.e.name.localeCompare(b.e.name));
    if (!l.length) { r.vazias++; continue; }
    const results = l.map((i, n) => {
      const uuid = i.e.uuid ?? `Compendium.${pack.collection}.Item.${i.e._id}`;
      return { type: "document", documentUuid: uuid, name: i.e.name, img: i.e.img, weight: 1, range: [n + 1, n + 1] };
    });
    await RollTable.create({ name: nome, folder: pasta.id, formula: `1d${results.length}`, replacement: true, displayRoll: true, description: `${pack.metadata.label}`, results });
    r.criadas++;
  }
  return r;
}

/* ---------- janela ---------- */
export class MenuTabelasLojas extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "jm-tabelas-lojas",
    classes: ["jm-janela", "jmj-seletor", "jm-tabelas-lojas"],
    tag: "div",
    window: { title: "Tabelas de itens das lojas", icon: "fa-solid fa-table-list", resizable: true },
    position: { width: 560, height: 700 },
    actions: { salvar: MenuTabelasLojas._salvar, criar: MenuTabelasLojas._criar }
  };
  get title() { return C.T("Tabelas de itens das lojas"); }

  async _renderHTML() {
    const T = C.T, e = C.esc;
    const c = cfgTabelas();
    const marcadas = new Set(c.visiveis);
    const pastas = new Map();
    for (const t of game.tables.contents.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = t.folder?.name ?? T("Sem pasta");
      if (!pastas.has(p)) pastas.set(p, []);
      pastas.get(p).push(t);
    }
    const op = (sel) => `<option value="">${e(T("— nenhuma —"))}</option>` + game.tables.contents.map((t) => `<option value="${t.uuid}" ${t.uuid === sel ? "selected" : ""}>${e(t.name)}</option>`).join("");
    const packs = compendiosDeItens();
    const padrao = compendioPadrao();
    return `<div class="jmj-sel">
      <section class="jm-secao"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> ${e(T("Criar tabelas prontas"))}</h3>
        <p class="jm-dica">${e(T("Monta tabelas a partir de um compêndio de itens: armas, armaduras, equipamento de aventura, poções e itens mágicos por raridade. Ficam na pasta"))} "${e(T(PASTA))}". ${e(T("Os itens não são copiados para o mundo: a tabela aponta para o compêndio."))}</p>
        ${packs.length ? `<label class="jmj-sel-uuid">${e(T("Compêndio"))} <select data-pack>${packs.map((p) => `<option value="${e(p.id)}" ${p.id === padrao ? "selected" : ""}>${e(p.nome)}</option>`).join("")}</select></label>
          <button type="button" data-action="criar"><i class="fa-solid fa-table-list"></i> ${e(T("Criar tabelas"))}</button>` : `<p class="jm-vazio">${e(T("Nenhum compêndio de itens neste mundo."))}</p>`}
      </section>
      <section class="jm-secao"><h3><i class="fa-solid fa-star"></i> ${e(T("Tabelas padrão"))}</h3>
        <p class="jm-dica">${e(T("Usadas pelas lojas que não escolheram uma tabela própria."))}</p>
        <label class="jmj-sel-uuid">${e(T("Estoque da semana"))} <select data-padrao="semanal">${op(c.semanal)}</select></label>
        <label class="jmj-sel-uuid">${e(T("Ofertas do dia"))} <select data-padrao="diaria">${op(c.diaria)}</select></label>
      </section>
      <section class="jm-secao"><h3><i class="fa-solid fa-filter"></i> ${e(T("Tabelas que aparecem nas lojas"))}</h3>
        <p class="jm-dica">${e(T("Marque as tabelas de itens. Nenhuma marcada: aparecem todas as tabelas do mundo."))}</p>
        <div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-busca placeholder="${e(T("Buscar tabela..."))}"></div>
        <div class="jmj-sel-lista">${[...pastas].map(([p, l]) => `<details class="jmj-sel-grupo" open data-grupo><summary><i class="fa-solid fa-folder"></i> ${e(p)} <small>${l.length}</small></summary>
          ${l.map((t) => `<label class="jmj-sel-item" data-nome="${e(t.name.toLowerCase())}"><input type="checkbox" value="${t.uuid}" ${marcadas.has(t.uuid) ? "checked" : ""}> <span>${e(t.name)}</span> <small>${t.results.size}</small></label>`).join("")}</details>`).join("")
          || `<p class="jm-vazio">${e(T("Nenhuma tabela de rolagem no mundo ainda."))}</p>`}</div>
      </section>
      <footer class="jmj-rodape-form"><button type="button" data-action="salvar"><i class="fa-solid fa-check"></i> ${e(T("Salvar"))}</button></footer>
    </div>`;
  }
  _replaceHTML(html, content) {
    content.innerHTML = html;
    try { this.element.dataset.tema = game.settings.get(C.MOD, "tema"); } catch { /* padrão */ }
    const busca = content.querySelector("[data-busca]");
    busca?.addEventListener("input", () => {
      const q = busca.value.trim().toLowerCase();
      content.querySelectorAll("[data-grupo]").forEach((g) => {
        let algum = false;
        g.querySelectorAll("[data-nome]").forEach((i) => { i.hidden = !!q && !i.dataset.nome.includes(q); if (!i.hidden) algum = true; });
        g.hidden = !algum;
      });
    });
  }
  static async _salvar() {
    const el = this.element;
    const visiveis = [...el.querySelectorAll(".jmj-sel-item input:checked")].map((c) => c.value);
    const semanal = el.querySelector('[data-padrao="semanal"]')?.value ?? "";
    const diaria = el.querySelector('[data-padrao="diaria"]')?.value ?? "";
    await game.settings.set(C.MOD, CHAVE, { visiveis, semanal, diaria });
    ui.notifications.info(C.T("Tabelas das lojas salvas."));
    this.close();
  }
  static async _criar() {
    const packId = this.element.querySelector("[data-pack]")?.value;
    if (!packId) return;
    try {
      ui.notifications.info(C.T("Criando as tabelas..."));
      const r = await criarTabelasProntas(packId);
      ui.notifications.info(`${C.T("Tabelas criadas")}: ${r.criadas} · ${C.T("já existiam")}: ${r.puladas}${r.vazias ? ` · ${C.T("sem itens no compêndio")}: ${r.vazias}` : ""}`);
      this.render();
    } catch (err) {
      console.error("Journal da Mesa | tabelas prontas", err);
      ui.notifications.error(`${C.T("Não consegui criar as tabelas")}: ${err?.message ?? err}`);
    }
  }
}

export function registrarTabelasLojas() {
  game.settings.register(C.MOD, CHAVE, { scope: "world", config: false, type: Object, default: { visiveis: [], semanal: "", diaria: "" }, onChange: () => C.atualizar?.() });
  game.settings.registerMenu(C.MOD, "lojasTabelasMenu", {
    name: "Tabelas de itens das lojas",
    label: "Escolher tabelas",
    hint: "Quais tabelas de rolagem aparecem nas lojas, as tabelas padrão do estoque semanal e das ofertas diárias, e tabelas prontas criadas a partir de um compêndio de itens.",
    icon: "fa-solid fa-table-list",
    type: MenuTabelasLojas,
    restricted: true
  });
}
