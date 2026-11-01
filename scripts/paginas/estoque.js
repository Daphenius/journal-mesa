/* Journal — lista de itens de estoque, usada pela loja (comprar) e pelo baú (pegar): linhas, preço,
 * quantidade, ocultar/remover, exportar para a aba Itens e soltar itens arrastados. */
import { T } from "../idioma.js";
import { negociacaoDeHoje } from "../partes/pechincha.js";
import { MOD, TE, analisar, arredondarPo, comoLista, dadosGet, dadosSet, dadosUnset, ehGM, esc, formatarPreco, garantirObjeto, itemLimpo, itemParaLoja, obterPasta, precoDoItem, qtdDoItem } from "../nucleo.js";

/** Lista de itens de estoque usada pela loja e pelo baú. */
async function listaItens(m, ed, modo, x = null) {
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

const acoes = {
  async removerItemLoja(app, ev, el) {
    const { page } = analisar(app._entry());
    await garantirObjeto(page, "items");
    await dadosUnset(page, `items.${el.dataset.id}`);
  },

  async ocultarItemLoja(app, ev, el) {
    const { page } = analisar(app._entry());
    await garantirObjeto(page, "items");
    const atual = !!dadosGet(page, `items.${el.dataset.id}.hidden`);
    await dadosSet(page, `items.${el.dataset.id}.hidden`, !atual);
  },

  async exportarItens(app) {
    const e = app._entry(); const { m } = analisar(e);
    const itens = comoLista(m.items).map(([, it]) => itemLimpo(it));
    if (!itens.length) return ui.notifications.warn(T("Janela.NaoHaItensParaExportar"));
    const raiz = await obterPasta("Item", T("Comum.Journal"), "itens");
    const pasta = await Folder.create({ name: e.name, type: "Item", folder: raiz?.id ?? null });
    await Item.createDocuments(itens.map((d) => ({ ...d, folder: pasta.id })));
    ui.notifications.info(`${itens.length} ${T("Janela.ItemNsCopiadoSPara")} ${e.name}".`);
  }
};

/* soltar um item do mundo/compêndio no estoque (loja: 1 unidade; baú: quantidade do item) */
const soltar = {
  async itemLoja(app, doc, e, page) {
    if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItem"));
    await garantirObjeto(page, "items");
    const data2 = itemParaLoja(doc, {}, analisar(e).tipo === "loot" ? null : 1);
    await dadosSet(page, `items.${data2._id}`, data2);
  }
};

/* preço e quantidade editados direto na lista */
function ouvintes(app, root) {
  root.querySelectorAll("[data-item-campo]").forEach((el) => el.addEventListener("change", async () => {
    const { page } = analisar(app._entry());
    await garantirObjeto(page, "items");
    const base = `items.${el.dataset.id}.flags.${MOD}`;
    if (el.dataset.itemCampo === "preco") await dadosSet(page, `${base}.preco`, arredondarPo(el.value));
    else if (el.value === "") await dadosUnset(page, `${base}.qtd`);
    else await dadosSet(page, `${base}.qtd`, Math.max(0, Number(el.value) || 0));
  }));
}

export { acoes, listaItens, ouvintes, soltar };
