/* =========================================================
 * Journal — Foundry VTT v14 · D&D 5e
 *
 * Armazenamento 100% nativo:
 *   - cada página do Journal é um Diário (JournalEntry) comum,
 *     dentro das Pastas nativas do Foundry;
 *   - a primeira página (tipo "text") guarda a descrição em
 *     text.content e a imagem em src;
 *   - os dados de tipo (NPC, loja, missão, baú...) ficam em
 *     flags["journal-mesa"].dados, o formato próprio do módulo (desde a 5.0);
 *   - o resto (segredo, prazo, horário, divindade...) fica ao lado,
 *     em flags["journal-mesa"].
 *
 * Monk's Enhanced Journal: o Journal da Mesa não grava mais no formato dele.
 * Páginas no formato do Monk's são convertidas (copiadas) para o formato próprio
 * pelo importador (dadosDeMonks / importarDoMonks); as flags do Monk's ficam intactas.
 * ========================================================= */

// a versão dos dados primeiro: seus ganchos vêm antes de todos os outros
import { VERSAO_DADOS } from "./partes/versao.js";
import * as Jornal from "./jornal/index.js";
import { configurarTabelasLojas, registrarTabelasLojas, tabelasDasLojas, tabelaDaLoja, nomeTabela } from "./lojas/tabelas.js";

/* ---------- idioma ----------
 * T(), TF() e traduzirNoLugar() estão em idioma.js (textos em português no código, chave = código do texto).
 * As constantes do topo do arquivo (tipos, status, ícones...) e as configurações são traduzidas quando
 * o Foundry carrega o idioma (i18nInit, no fim do arquivo). */
import { T, TF, traduzirNoLugar } from "./idioma.js";
// partes do Journal (scripts/partes/)
import { CAL, CAL_AVISOS, CAL_FIM, CAL_ICONES, CAL_ICONES_GRUPOS, CAL_MODOS_MES, CAL_REPETIR, Tempo, calApi, lojaBloqueada } from "./partes/calendario.js";
import { HIST_ICONES, calHoje, criarHistoria, historias, notaPadrao } from "./partes/historia.js";
import { ACOES_GM, NEGOCIO_PADRAO, PERICIAS_VENDEDOR, RESULTADOS, negociacaoDeHoje } from "./partes/pechincha.js";
import { JournalApp, renovarEstoques } from "./partes/janela.js";
import { NEXUS_ICONES, Nexus, Rastreador, Sessao, souGMPrincipal } from "./partes/sessao.js";
import { abreNoJournal, cliqueEmLink, lembrarEstadoInicial, sessaoMudou } from "./partes/tempo.js";
import "./partes/barra.js";

const MOD = "journal-mesa";
const MEJ = "monks-enhanced-journal";
const CANAL = `module.${MOD}`;

const TIPOS = {
  person:       { rotulo: "NPC",         plural: "NPCs",         icone: "fa-solid fa-user" },
  place:        { rotulo: "Local",       plural: "Locais",       icone: "fa-solid fa-location-dot" },
  organization: { rotulo: "Organização", plural: "Organizações", icone: "fa-solid fa-people-group" },
  shop:         { rotulo: "Loja",        plural: "Lojas",        icone: "fa-solid fa-store" },
  quest:        { rotulo: "Missão",      plural: "Missões",      icone: "fa-solid fa-scroll" },
  deus:         { rotulo: "Divindade",   plural: "Divindades",   icone: "fa-solid fa-sun" },
  loot:         { rotulo: "Baú",         plural: "Baús",         icone: "fa-solid fa-box-open" },
  journalentry: { rotulo: "Anotação",    plural: "Anotações",    icone: "fa-solid fa-note-sticky" },
  historia:     { rotulo: "História",    plural: "Histórias",    icone: "fa-solid fa-landmark" },
  jornal:       { get rotulo() { return Jornal.t("Jornal.Jornal"); }, get plural() { return Jornal.t("Jornal.Jornais"); }, icone: "fa-solid fa-newspaper" },
  diario:       { rotulo: "Diário",      plural: "Diários",      icone: "fa-solid fa-book" },
  outro:        { rotulo: "Monk's",      plural: "Outros",       icone: "fa-solid fa-puzzle-piece" }
};

/* conexões com fichas (atores): não é página, mas entra nos filtros como um "tipo" */
const TIPO_FICHA = { rotulo: "Personagem", plural: "Personagens dos jogadores", icone: "fa-solid fa-user-shield" };
const infoCon = (k) => (k === "ficha" ? TIPO_FICHA : TIPOS[k]);
/** Fichas ligadas a uma página: flags.journal-mesa.fichas = { idDoAtor: { uuid, relacao, hidden } } */
const fichasDe = (page) => Object.entries(page?.flags?.[MOD]?.fichas ?? {}).filter(([, f]) => f?.uuid);

/* tipos que o Journal edita (registro de tipo em flags["journal-mesa"].dados) */
const EDITAVEIS = ["person", "place", "organization", "shop", "quest", "loot", "journalentry"];

/* botões de "Nova página" */
const NOVOS = [
  ["person"], ["place"], ["organization"], ["shop"], ["quest"], ["deus"],
  ["loot"], ["journalentry"], ["diario"], ["historia"], ["jornal"],
  ["evento", "Evento do calendário", "fa-solid fa-calendar-day"],
  ["imagem", "Imagem", "fa-solid fa-image"],
  ["pdf", "PDF", "fa-solid fa-file-pdf"],
  ["regra", "Regra", "fa-solid fa-gavel"]
];

const NOMES_MEJ = {
  encounter: "Encontro", poi: "Ponto de interesse", event: "Evento",
  picture: "Imagem", list: "Lista", slideshow: "Apresentação"
};

const NOMES_PAGINA = {
  text: "Texto", image: "Imagem", pdf: "PDF", video: "Vídeo",
  rule: "Regra", spells: "Lista de magias", class: "Classe", subclass: "Subclasse", map: "Mapa"
};
const ICONES_PAGINA = {
  text: "fa-solid fa-file-lines", image: "fa-solid fa-image", pdf: "fa-solid fa-file-pdf", video: "fa-solid fa-film",
  rule: "fa-solid fa-gavel", spells: "fa-solid fa-wand-sparkles", class: "fa-solid fa-shield-halved",
  subclass: "fa-solid fa-shield", map: "fa-solid fa-map"
};

/* campos simples do registro de tipo (papel, local, tendência...) */
const DETALHES = {
  person: [["role", "Papel"], ["location", "Local"]],
  place: [["placetype", "Tipo"], ["location", "Região"]],
  organization: [["alignment", "Tendência"], ["location", "Sede"]],
  shop: [["shoptype", "Tipo de loja"], ["location", "Local"]]
};

/* campos da Divindade (ficam no espaço do Journal) */
const CAMPOS_DEUS = [
  ["titulos", "Títulos e epítetos"], ["status", "Posição"], ["panteao", "Panteão"],
  ["dominios", "Domínios"], ["tendencia", "Tendência"], ["morada", "Morada / plano"]
];
const STATUS_DEUS = {
  "": "—", maior: "Deus maior", menor: "Deus menor", semideus: "Semideus", antigo: "Entidade antiga",
  ascendido: "Ascendido", adormecido: "Adormecido", morto: "Deus morto", esquecido: "Esquecido"
};
const SIMBOLOS_DEUS = [["simbolo", "Símbolo sagrado"], ["cores", "Cores sagradas"], ["animal", "Animal sagrado"], ["arma", "Arma favorita"]];
const SECOES_DEUS = {
  geral: [["aparencia", "Aparência e manifestações", "fa-solid fa-person-rays", "Como a divindade aparece aos mortais: avatar, sinais, presságios..."]],
  fe: [
    ["dogmas", "Dogmas e mandamentos", "fa-solid fa-hands-praying", "O que a fé ensina e exige dos fiéis."],
    ["tabus", "Tabus e pecados", "fa-solid fa-ban", "O que é proibido. O que acontece com quem quebra."],
    ["clero", "Clero e ordens sagradas", "fa-solid fa-church", "Título dos sacerdotes, hierarquia, vestes, ordens de paladinos..."],
    ["ritos", "Ritos, orações e oferendas", "fa-solid fa-fire-flame-curved", "Como se reza, o que se oferece, sacrifícios..."],
    ["festas", "Dias sagrados e festividades", "fa-solid fa-calendar-days", "Datas, festivais, peregrinações."],
    ["fieis", "Quem cultua", "fa-solid fa-people-group", "Povos, profissões, regiões e seitas."]
  ],
  poder: [
    ["dadivas", "Dádivas e bênçãos", "fa-solid fa-hand-sparkles", "O que a divindade concede aos devotos."],
    ["castigos", "Castigos e maldições", "fa-solid fa-cloud-bolt", "Como pune os inimigos e os infiéis."],
    ["caminhos", "Caminhos e Sequências", "fa-solid fa-route", "Caminhos ligados a esta divindade, poções, sequências..."]
  ]
};
const ABAS_DEUS = [["geral", "Visão geral", "fa-solid fa-sun"], ["fe", "Fé e clero", "fa-solid fa-church"], ["poder", "Poder e relíquias", "fa-solid fa-bolt"]];

const STATUS = {
  inactive:   { rotulo: "Indisponível", icone: "fa-solid fa-lock" },
  available:  { rotulo: "Disponível",   icone: "fa-solid fa-circle-pause" },
  inprogress: { rotulo: "Em andamento", icone: "fa-solid fa-circle-play" },
  completed:  { rotulo: "Concluída",    icone: "fa-solid fa-circle-check" },
  failed:     { rotulo: "Falhou",       icone: "fa-solid fa-circle-xmark" }
};

const OFERTAS = {
  achado:  { rotulo: "Achado",   desc: "Muito bom e barato.",           min: 0.35, max: 0.6 },
  luxo:    { rotulo: "Raridade", desc: "Muito bom, mas caro.",          min: 1.5,  max: 2.5 },
  escambo: { rotulo: "Escambo",  desc: "Barato... pelo menos em ouro.", min: 0.05, max: 0.2 }
};

const CUSTOS_PADRAO = [
  "Uma maldição que só se revela no pior momento",
  "Um favor que o vendedor vai cobrar quando quiser",
  "Uma lembrança querida, que some da memória",
  "O item foi roubado — e o dono verdadeiro vai procurá-lo",
  "Um ano de vida",
  "O nome verdadeiro do comprador, anotado num caderno"
].join("\n");

/* nomes dos temas: chaves de idioma (lang/). O id "lotd" continua o mesmo, para quem já usa o tema;
 * só o nome mostrado mudou para "Tema Vitoriano". */
const TEMAS = { claro: "JMESA.Tema.claro", lotd: "JMESA.Tema.vitoriano", noite: "JMESA.Tema.noite" };
const nomeTema = (k) => game.i18n.localize(TEMAS[k] ?? TEMAS.claro);

/* ---------- Regras da Mesa (sessão 0) ----------
 * Combinados discutidos entre mestre e jogadores. Ficam no setting "regrasMesa" (mundo):
 *   { itens: [{ id, cat, titulo, texto, status, autor (userId ou null se anônimo), criado,
 *               votos: { userId: "sim" | "nao" }, comentarios: [{ id, autor|null, texto, t }] }],
 *     sessao0: { concluida, quando } }
 * Só o mestre grava; os jogadores pedem pelo socket (mesma validação e fila das lojas). */
const REGRAS_CATS = {
  casa: ["Regras da casa", "fa-solid fa-gavel"],
  limites: ["Limites e véus", "fa-solid fa-shield-heart"],
  seguranca: ["Ferramentas de segurança", "fa-solid fa-hand"],
  tom: ["Tom e expectativas", "fa-solid fa-masks-theater"],
  grupo: ["Personagens e grupo", "fa-solid fa-people-group"],
  logistica: ["Logística da mesa", "fa-solid fa-calendar-check"]
};
const REGRAS_STATUS = {
  proposta: ["Proposta", "fa-solid fa-lightbulb"],
  discussao: ["Em discussão", "fa-solid fa-comments"],
  acordada: ["Combinado", "fa-solid fa-handshake"],
  recusada: ["Fora", "fa-solid fa-ban"]
};
const REGRAS_MODELOS = [
  ["casa", "Críticos e falhas críticas", "Como funcionam o 20 e o 1 natural nesta mesa?"],
  ["casa", "Morte de personagem", "Personagens podem morrer? Ressurreição é possível e a que custo?"],
  ["casa", "Descansos e recursos", "Descanso longo em qualquer lugar ou só em lugar seguro?"],
  ["limites", "Linhas (o que nunca aparece)", "Temas que não entram no jogo de jeito nenhum. Pode propor anonimamente."],
  ["limites", "Véus (acontece fora de cena)", "Temas que podem existir na história, mas sem descrição em cena."],
  ["seguranca", "Carta X / pausa", "Qualquer pessoa pode pedir para pular uma cena sem precisar explicar."],
  ["tom", "Tom da campanha", "Mais heroico, sombrio, cômico, investigativo? Quanto combate e quanta conversa?"],
  ["grupo", "Conflito entre personagens (PvP)", "Personagens podem agir contra outros personagens? Com que limite?"],
  ["grupo", "Ganchos e segredos", "O grupo tem um motivo para ficar junto? Segredos entre personagens são bem-vindos?"],
  ["logistica", "Horário e faltas", "Dia, horário, tolerância de atraso e o que acontece com o personagem de quem falta."],
  ["logistica", "Celular e distrações", "Combinado sobre celular, comida e conversas paralelas durante a sessão."]
];
const LIMITES_REGRAS = { titulo: 200, texto: 5000, comentario: 2000, itens: 300, comentarios: 200 };
const regrasMesa = () => {
  try { const r = game.settings.get(MOD, "regrasMesa"); return { itens: Array.isArray(r?.itens) ? r.itens : [], sessao0: r?.sessao0 ?? {} }; }
  catch { return { itens: [], sessao0: {} }; }
};
const TIPOS_SAQUE = ["weapon", "equipment", "consumable", "loot", "container", "tool"];

/* ---------------- utilidades ---------------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* APIs do Foundry 14 (os globais antigos, como TextEditor e FilePicker, estão obsoletos) */
const TE = () => foundry.applications.ux.TextEditor.implementation;
const FP = () => foundry.applications.apps.FilePicker.implementation;
const Dialogo = () => foundry.applications.api.DialogV2;
const LV = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;
const ehGM = () => game.user.isGM;
const diaAtual = () => game.settings.get(MOD, "dia");
const idsGM = () => game.users.filter((u) => u.isGM).map((u) => u.id);
const novoId = () => foundry.utils.randomID();
const dup = (o) => foundry.utils.deepClone(o);
const temModulo = (id) => !!game.modules.get(id)?.active;

/* ---------- fila serial ----------
 * As ações do mestre (compras, vendas, saques...) e o diário de sessão leem dados, decidem e gravam.
 * Duas ao mesmo tempo podiam vender o mesmo último item ou apagar a anotação uma da outra.
 * A fila faz a próxima tarefa da mesma chave esperar a anterior terminar (com ou sem erro). */
const FILAS = new Map();
function naFila(chave, tarefa) {
  const atual = (FILAS.get(chave) ?? Promise.resolve()).then(() => tarefa());
  const elo = atual.catch(() => {});
  FILAS.set(chave, elo);
  elo.then(() => { if (FILAS.get(chave) === elo) FILAS.delete(chave); });
  return atual;
}

/** Erro de uma integração opcional: registra no console uma vez por sessão e segue com a alternativa. */
const AVISADOS = new Set();
function avisoUmaVez(onde, err) {
  if (AVISADOS.has(onde)) return;
  AVISADOS.add(onde);
  console.warn(`${T("Journal da Mesa")} | ${onde}: ${T("usando a alternativa local")}`, err);
}

/** Erro numa ação: console sempre; notificação para quem clicou. */
function relatarErro(onde, err) {
  console.error(`${T("Journal da Mesa")} | ${onde}`, err);
  ui.notifications?.error(`${T("Journal da Mesa: falha em")} "${onde}" (${err?.message ?? err}${T("). Detalhes no console (F12).")}`);
}

function extrasPadrao() {
  return {
    tipo: "", segredo: "", dono: "", doador: "", rastrear: true, recompensas: "",
    prazo: null, aoVencer: "avisar", prazoAvisado: false, concluidaEm: null,
    horario: { ativo: false, folga: [] },
    negociacoes: {}, vendedorPericia: "per", vendedorBonus: 2, negocio: dup(NEGOCIO_PADRAO),
    deus: {
      ...Object.fromEntries([...CAMPOS_DEUS, ...SIMBOLOS_DEUS, ...Object.values(SECOES_DEUS).flat()].map(([k]) => [k, ""])),
      simboloImg: "", reliquias: []
    },
    semanal: { tabela: "", qtd: 6 },
    diaria: { tabela: "", chances: { achado: 40, luxo: 35, escambo: 25 }, custos: T(CUSTOS_PADRAO), ofertas: {} }
  };
}

/* ---------- formato próprio: flags["journal-mesa"].dados ----------
 * O registro de tipo de cada página (NPC, local, organização, loja, missão, baú, anotação). Os nomes dos
 * campos (type, relationships, items, objectives, rewards, currency, actor, status...) são os do formato
 * comum de diários aprimorados, para a conversão do Monk's ser direta; o registro é lido e gravado só aqui.
 * Itens de estoque (lojas e baús) guardam quantidade e preço em flags["journal-mesa"] do próprio item:
 *   { qtd: número ou ausente (ilimitado), preco: número em po, de: origem (saque), origem: uuid do item }.
 * Notas pessoais: dados.notas[idDoUsuário]. */
const CHAVE_DADOS = "dados";
function dadosPadrao(tipo) {
  const base = { type: tipo, relationships: {} };
  if (tipo === "person") Object.assign(base, { attributes: {}, role: "", location: "" });
  if (tipo === "place") Object.assign(base, { shops: [], townsfolk: [], attributes: {}, placetype: "", location: "" });
  if (tipo === "organization") Object.assign(base, { alignment: "", location: "" });
  if (tipo === "shop") Object.assign(base, { purchasing: "confirm", selling: "confirm", items: {}, opening: 480, closing: 1020, shoptype: "", location: "" });
  if (tipo === "quest") Object.assign(base, { rewards: [], objectives: {}, seen: false, status: "inprogress", source: "" });
  if (tipo === "loot") Object.assign(base, { purchasing: "free", items: {}, currency: {} });
  return base;
}

/** Lê um Diário e devolve como o Journal o enxerga. O resultado fica em cache até qualquer Diário
 *  ou página mudar (VERSAO_DADOS); quem usa só lê, nunca altera o objeto devolvido. */
const CACHE_ANALISE = { versao: -1, mapa: new Map() };
function analisar(entry) {
  if (CACHE_ANALISE.versao !== VERSAO_DADOS) { CACHE_ANALISE.versao = VERSAO_DADOS; CACHE_ANALISE.mapa.clear(); }
  const c = CACHE_ANALISE.mapa.get(entry.id);
  if (c && c.entry === entry) return c;
  const r = analisarAgora(entry);
  CACHE_ANALISE.mapa.set(entry.id, r);
  return r;
}

function analisarAgora(entry) {
  const pages = entry.pages.contents.sort((a, b) => a.sort - b.sort);
  const page = pages.find((p) => p.flags?.[MOD]?.[CHAVE_DADOS]?.type) ?? null;
  let t = normalizarTipo(page?.flags?.[MOD]?.[CHAVE_DADOS]?.type ?? null);
  let tipo = !page ? "diario" : (EDITAVEIS.includes(t) ? t : "outro");
  if (tipo === "journalentry" && page.flags?.[MOD]?.tipo === "deus") tipo = "deus";
  if (tipo === "diario" && entry.flags?.[MOD]?.tipo === "historia") tipo = "historia";
  if (tipo === "diario" && entry.flags?.[MOD]?.tipo === "jornal") tipo = "jornal";
  const m = page?.flags?.[MOD]?.[CHAVE_DADOS] ?? {};
  // os extras (x) são o resto de flags["journal-mesa"], sem o registro de tipo
  const { [CHAVE_DADOS]: _dados, ...proprios } = page?.flags?.[MOD] ?? {};
  const x = foundry.utils.mergeObject(extrasPadrao(), dup(proprios), { inplace: false });
  return { entry, pages, page, tipo, tipoBase: t, m, x };
}

/** Nomes antigos de tipo (de diários aprimorados antigos) → nome atual. */
function normalizarTipo(t) {
  if (t === "base" || t === "oldentry") return "journalentry";
  if (t === "checklist") return "list";
  return t;
}

/* ---------- gravação do registro de tipo (flags["journal-mesa"].dados) ----------
 * Lê e grava com update() e caminhos completos, que é o que o resto do núcleo usa
 * (substituirMapa, gravarJunto) — assim uma gravação só troca várias chaves de uma vez. */
const caminhoDados = (chave) => `flags.${MOD}.${CHAVE_DADOS}.${chave}`;
function dadosGet(doc, chave) {
  return doc ? foundry.utils.getProperty(doc.flags?.[MOD]?.[CHAVE_DADOS] ?? {}, chave) : undefined;
}
function dadosSet(doc, chave, valor) {
  return doc?.update({ [caminhoDados(chave)]: valor });
}
function dadosUnset(doc, chave) {
  if (!doc) return;
  const partes = chave.split(".");
  const ultimo = partes.pop();
  const base = [`flags.${MOD}.${CHAVE_DADOS}`, ...partes].join(".");
  return apagarChave(doc, base, ultimo);
}

/* ---------- conversão do formato do Monk's Enhanced Journal ----------
 * Só COPIA: lê flags["monks-enhanced-journal"] da página e grava o equivalente em flags["journal-mesa"].dados.
 * As flags do Monk's não são alteradas nem apagadas, e a página continua a mesma (mesmo id, mesmo uuid),
 * então os vínculos entre NPCs, locais, lojas e missões continuam valendo. */

/** Converte as flags do Monk's (objeto simples) no registro próprio. Devolve null se não houver tipo. */
function dadosDeMonks(mej) {
  if (!mej || typeof mej !== "object" || typeof mej.type !== "string" || !mej.type) return null;
  const d = {}; const notas = {};
  for (const [k, v] of Object.entries(mej)) {
    if (ID_VALIDO.test(k) && v && typeof v === "object" && "notes" in v) { notas[k] = String(v.notes ?? ""); continue; }
    d[k] = dup(v);
  }
  d.type = normalizarTipo(d.type);
  if (Object.keys(notas).length) d.notas = { ...(d.notas ?? {}), ...notas };
  // listas antigas (arrays) viram objetos por id, que é o formato do registro próprio
  for (const chave of ["items", "objectives", "rewards", "relationships"]) {
    if (chave in d && d[chave] != null) d[chave] = Object.fromEntries(comoLista(d[chave]).map(([k, o]) => [k, { ...o, id: o.id ?? k }]));
  }
  // itens de estoque: quantidade e preço do Monk's → flags["journal-mesa"] do item
  for (const it of Object.values(d.items ?? {})) {
    const f = it?.flags?.[MEJ];
    if (!f || typeof f !== "object") continue;
    const proprio = (it.flags[MOD] ??= {});
    if (typeof f.quantity === "number") proprio.qtd = f.quantity;
    else if (f.quantity != null && f.quantity !== "") proprio.qtd = Math.max(0, Number(f.quantity) || 0);
    proprio.preco = precoDoTexto(f.cost ?? f.price, it);
    if (f.from) proprio.de = String(f.from);
    delete it.flags[MEJ];
  }
  return d;
}

/** Diz se uma página (documento ou dados simples) está no formato do Monk's e ainda sem o registro próprio. */
function paginaPendenteDoMonks(page) {
  return !!page?.flags?.[MEJ]?.type && !page?.flags?.[MOD]?.[CHAVE_DADOS]?.type;
}

/** Converte, nos dados simples de um Diário (JSON importado), as páginas que estão só no formato do Monk's. */
function converterDadosDeEntrada(data) {
  let n = 0;
  for (const pg of data?.pages ?? []) {
    if (!paginaPendenteDoMonks(pg)) continue;
    const d = dadosDeMonks(pg.flags[MEJ]);
    if (!d) continue;
    foundry.utils.setProperty(pg, `flags.${MOD}.${CHAVE_DADOS}`, d);
    n++;
  }
  return n;
}

/**
 * Importa do Monk's: converte todas as páginas do mundo que estão no formato do Monk's e ainda não têm o
 * registro próprio. Uma gravação por Diário. Devolve o relatório: { convertidas, porTipo, limitadas, puladas,
 * vinculosQuebrados, falhas }.
 */
async function importarDoMonks({ entradas = null, silencioso = false } = {}) {
  const rel = { convertidas: [], porTipo: {}, limitadas: [], puladas: 0, vinculosQuebrados: [], falhas: [] };
  const lista = entradas ?? game.journal.contents;
  const vinculos = [];
  for (const e of lista) {
    const upds = [];
    for (const pg of e.pages.contents) {
      const temMonks = !!pg.flags?.[MEJ]?.type;
      if (!temMonks) continue;
      if (!paginaPendenteDoMonks(pg)) { rel.puladas++; continue; }
      const d = dadosDeMonks(pg.flags[MEJ]);
      if (!d) continue;
      upds.push({ _id: pg.id, [`flags.${MOD}.${CHAVE_DADOS}`]: d });
      const t = d.type;
      rel.porTipo[t] = (rel.porTipo[t] ?? 0) + 1;
      if (!EDITAVEIS.includes(t)) rel.limitadas.push({ id: e.id, nome: e.name, tipo: t });
      for (const [id, r] of comoLista(d.relationships)) vinculos.push({ de: e, para: r?.uuid ?? null, id: r?.id ?? id });
      rel.convertidas.push({ id: e.id, nome: e.name, tipo: t });
    }
    if (!upds.length) continue;
    try { await e.updateEmbeddedDocuments("JournalEntryPage", upds); }
    catch (err) {
      rel.falhas.push({ id: e.id, nome: e.name, erro: err?.message ?? String(err) });
      rel.convertidas = rel.convertidas.filter((c) => c.id !== e.id);
      console.error(`${T("Journal da Mesa")} | ${T("importar do Monk's")}: ${e.name}`, err);
    }
  }
  // vínculos que apontam para páginas que não existem mais (já estavam quebrados antes da conversão)
  for (const v of vinculos) {
    let existe = false;
    try { existe = !!(v.para ? fromUuidSync(v.para) : null) || game.journal.has(v.id); } catch { existe = game.journal.has(v.id); }
    if (!existe) rel.vinculosQuebrados.push({ de: v.de.name, para: v.para ?? v.id });
  }
  if (!silencioso) mostrarRelatorioMonks(rel);
  return rel;
}

function mostrarRelatorioMonks(rel) {
  const n = rel.convertidas.length;
  const tipos = Object.entries(rel.porTipo).map(([t, q]) => `<li>${esc(TIPOS[t]?.rotulo ?? NOMES_MEJ[t] ?? t)}: <b>${q}</b></li>`).join("");
  const lim = rel.limitadas.length
    ? `<p><b>${T("Tipos só do Monk's")}</b> (${rel.limitadas.length}): ${T("ficam no Journal da Mesa com edição limitada (nome, imagem e descrição).")}</p><ul>${rel.limitadas.slice(0, 30).map((l) => `<li>${esc(l.nome)} <small>(${esc(NOMES_MEJ[l.tipo] ?? l.tipo)})</small></li>`).join("")}${rel.limitadas.length > 30 ? "<li>…</li>" : ""}</ul>`
    : "";
  const vq = rel.vinculosQuebrados.length
    ? `<p><b>${T("Vínculos quebrados")}</b> (${rel.vinculosQuebrados.length}): ${T("conexões que apontam para páginas que não existem mais. Já estavam assim antes; a conversão não mexe nelas.")}</p><ul>${rel.vinculosQuebrados.slice(0, 30).map((v) => `<li>${esc(v.de)} → <code>${esc(String(v.para))}</code></li>`).join("")}${rel.vinculosQuebrados.length > 30 ? "<li>…</li>" : ""}</ul>`
    : "";
  const falhas = rel.falhas.length
    ? `<p><b>${T("Não convertidas")}</b> (${rel.falhas.length}):</p><ul>${rel.falhas.map((f) => `<li>${esc(f.nome)}: <code>${esc(f.erro)}</code></li>`).join("")}</ul>`
    : "";
  const content = `
    <p><b>${n}</b> ${T("página(s) convertida(s) do formato do Monk's Enhanced Journal.")} ${rel.puladas ? `${rel.puladas} ${T("já estavam no formato do Journal da Mesa e não foram tocadas.")}` : ""}</p>
    ${tipos ? `<ul>${tipos}</ul>` : ""}
    <p>${T("Os dados do Monk's ficaram como estavam: a conversão só copia. As páginas continuam as mesmas, então os vínculos entre elas seguem valendo.")}</p>
    ${lim}${vq}${falhas}`;
  console.info(`${T("Journal da Mesa")} | ${T("importar do Monk's")}`, rel);
  return Dialogo().prompt({ window: { title: T("Importar do Monk's Enhanced Journal") }, content, ok: { label: T("Fechar") }, rejectClose: false }).catch(() => null);
}

/** Conversão automática ao abrir o mundo (uma vez; só o mestre principal). */
async function migrarFormato() {
  let v = 0;
  try { v = Number(game.settings.get(MOD, "formatoDados")) || 0; } catch { v = 0; }
  if (v >= 5) return;
  const pendentes = game.journal.contents.filter((e) => e.pages.contents.some(paginaPendenteDoMonks));
  if (!pendentes.length) { await game.settings.set(MOD, "formatoDados", 5); return; }
  const ok = await Dialogo().confirm({
    window: { title: T("Journal da Mesa 5.0: formato novo") },
    content: `<p>${T("A partir da 5.0, o Journal da Mesa guarda os dados das páginas no formato próprio. Encontrei")} <b>${pendentes.length}</b> ${T("diário(s) com páginas no formato do Monk's Enhanced Journal.")}</p>
      <p>${T("Converter copia os dados para o formato novo. Nada é apagado: as flags do Monk's continuam como estão, e cada página continua a mesma, com os mesmos vínculos.")}</p>
      <p><b>${T("Recomendo fazer um backup do mundo antes.")}</b></p>
      <p>${T("Se escolher Depois, essas páginas aparecem como diário comum até a conversão (botão Importar do Monk's, no topo da lista do Journal da Mesa).")}</p>`,
    yes: { label: T("Converter agora") }, no: { label: T("Depois") }, rejectClose: false
  }).catch(() => false);
  if (!ok) return;
  const rel = await importarDoMonks({ entradas: pendentes });
  if (!rel.falhas.length) await game.settings.set(MOD, "formatoDados", 5);
}

/** Apaga uma chave com o ForcedDeletion do v14; se ele faltar ou falhar, com o "-=" (aceito no v14, obsoleto). */
async function apagarChave(doc, base, chave) {
  const Apagar = foundry.data?.operators?.ForcedDeletion;
  if (Apagar) {
    try { return await doc.update({ [`${base}.${chave}`]: new Apagar() }); } catch (err) { console.warn("Journal da Mesa | ForcedDeletion falhou, usando -=", err); }
  }
  return doc.update({ [`${base}.-=${chave}`]: null });
}

/** Listas antigas do Monk's podem ser arrays; o formato atual é objeto indexado por id. */
const comoLista = (v) => Array.isArray(v)
  ? v.map((o) => [o?.id ?? o?._id, o]).filter(([k, o]) => k && o)
  : Object.entries(v ?? {}).filter(([k, o]) => k && o);

/** Converte uma lista antiga (array) do Monk's em objeto por id, numa única gravação: ao gravar um objeto
 *  por cima de um array, o Foundry troca o valor inteiro (não mescla), então não é preciso apagar antes. */
async function garantirObjeto(page, chave) {
  const v = dadosGet(page, chave);
  if (!Array.isArray(v)) return;
  const obj = Object.fromEntries(comoLista(v).map(([k, o]) => [k, { ...o, id: k }]));
  await dadosSet(page, chave, obj);
}

/** Chave de exclusão de um campo: ForcedDeletion (v14); "-=" só se o operador não existir. */
function chaveApagar(upd, base, chave) {
  const Apagar = foundry.data?.operators?.ForcedDeletion;
  if (Apagar) upd[`${base}.${chave}`] = new Apagar();
  else upd[`${base}.-=${chave}`] = null;
  return upd;
}

/** Troca o conteúdo de um objeto-mapa (ex.: estoque da loja) por `novo` numa ÚNICA gravação (apaga as chaves
 *  que saem e grava as novas juntas), para uma falha no meio não deixar a lista vazia. `extras` entra na mesma gravação. */
async function substituirMapa(doc, base, novo, extras = {}) {
  const atual = foundry.utils.getProperty(doc, base);
  const upd = { ...extras };
  if (Array.isArray(atual) || atual == null || typeof atual !== "object") upd[base] = novo;
  else {
    for (const k of Object.keys(atual)) if (!(k in novo)) chaveApagar(upd, base, k);
    for (const [k, v] of Object.entries(novo)) upd[`${base}.${k}`] = v;
  }
  try { return await doc.update(upd); }
  catch (err) {
    // v14 recusou o operador: repete com o "-=" antigo (mesma gravação única)
    if (!Object.values(upd).some((v) => v?.constructor?.name === "ForcedDeletion")) throw err;
    console.warn("Journal da Mesa | ForcedDeletion falhou, usando -=", err);
    const upd2 = {};
    for (const [k, v] of Object.entries(upd)) {
      if (v?.constructor?.name === "ForcedDeletion") { const i = k.lastIndexOf("."); upd2[`${k.slice(0, i)}.-=${k.slice(i + 1)}`] = null; }
      else upd2[k] = v;
    }
    return doc.update(upd2);
  }
}

/** Grava várias mudanças (e exclusões) numa página de uma vez. sets: { chave: valor }, apagar: [chaves] (caminhos completos). */
async function gravarJunto(doc, sets = {}, apagar = []) {
  const upd = { ...sets };
  for (const caminho of apagar) { const i = caminho.lastIndexOf("."); chaveApagar(upd, caminho.slice(0, i), caminho.slice(i + 1)); }
  if (!Object.keys(upd).length) return;
  try { return await doc.update(upd); }
  catch (err) {
    if (!apagar.length || !foundry.data?.operators?.ForcedDeletion) throw err;
    console.warn("Journal da Mesa | ForcedDeletion falhou, usando -=", err);
    const upd2 = { ...sets };
    for (const caminho of apagar) { const i = caminho.lastIndexOf("."); upd2[`${caminho.slice(0, i)}.-=${caminho.slice(i + 1)}`] = null; }
    return doc.update(upd2);
  }
}

function podeVer(entry) { return ehGM() || entry.testUserPermission(game.user, "LIMITED"); }

/* ---------- páginas fixadas (por usuário) ----------
 * Fixar = a página fica no topo da lista e sempre aberta como a primeira aba (sem o X). */
function fixados() {
  try { const l = game.settings.get(MOD, "fixados"); return new Set(Array.isArray(l) ? l : []); } catch { return new Set(); }
}
async function alternarFixado(id) {
  const f = fixados();
  if (f.has(id)) f.delete(id); else f.add(id);
  await game.settings.set(MOD, "fixados", [...f]);
  return f.has(id);
}
function podeLer(entry) { return ehGM() || entry.testUserPermission(game.user, "OBSERVER"); }
function estaVisivel(entry) { return (entry.ownership?.default ?? 0) >= LV().OBSERVER; }

/** "todos" (padrão observador), "alguns" (algum jogador vê) ou "ninguem". */
function visibilidade(doc) {
  const own = doc.ownership ?? {};
  if ((own.default ?? 0) >= LV().OBSERVER) return "todos";
  const algum = (own.default ?? 0) >= LV().LIMITED
    || game.users.some((u) => !u.isGM && (own[u.id] ?? -1) >= LV().LIMITED);
  return algum ? "alguns" : "ninguem";
}

const NIVEIS = () => [
  [LV().NONE, T("Nada"), "fa-solid fa-ban"],
  [LV().LIMITED, T("Limitado"), "fa-solid fa-eye-low-vision"],
  [LV().OBSERVER, T("Observador"), "fa-solid fa-eye"],
  [LV().OWNER, T("Dono"), "fa-solid fa-crown"]
];
const nomeNivel = (n) => NIVEIS().find(([v]) => v === n)?.[1] ?? T("Nada");
const corUsuario = (u) => u.color?.css ?? (typeof u.color === "string" ? u.color : "#888");

/* ---------- revelação por seção ----------
 * flags["journal-mesa"].revelado[chave] no Diário:
 *   ausente  = segue a permissão da página (Observador vê, Limitado não)
 *   "todos"  = todos que veem a página (inclusive Limitado)
 *   "ninguem"= só o mestre
 *   [ids]    = Observadores + esses jogadores
 */
const estadoSecao = (entry, chave) => entry?.flags?.[MOD]?.revelado?.[chave];
function podeVerSecao(entry, chave, user = game.user) {
  if (user.isGM) return true;
  const st = estadoSecao(entry, chave);
  if (st === "todos") return entry.testUserPermission(user, "LIMITED");
  if (st === "ninguem") return false;
  const obs = entry.testUserPermission(user, "OBSERVER");
  if (Array.isArray(st)) return obs || st.includes(user.id);
  return obs;
}
function rotuloEstadoSecao(entry, chave) {
  const st = estadoSecao(entry, chave);
  if (st === "todos") return ["todos", "fa-eye", T("Revelada a todos que veem a página (inclusive Limitado)")];
  if (st === "ninguem") return ["ninguem", "fa-eye-slash", T("Escondida: só o mestre vê")];
  if (Array.isArray(st) && st.length) {
    const nomes = st.map((id) => game.users.get(id)?.name).filter(Boolean).join(", ");
    return ["alguns", "fa-user-check", `${T("Revelada também para")}: ${nomes}`];
  }
  return ["padrao", "fa-eye-low-vision", T("Segue a permissão da página (Observador vê, Limitado não)")];
}

/** Pasta oculta (marcada pelo mestre): some do Journal e da aba de Diários, sem apagar nada. */
const pastaMarcadaOculta = (f) => !!f?.getFlag?.(MOD, "oculta");
function pastaOculta(f) { for (let p = f; p; p = p.folder) if (pastaMarcadaOculta(p)) return true; return false; }
const entradaOculta = (j) => !!j.folder && pastaOculta(j.folder);

/** Bolinhas de permissão (estilo Ownership Viewer). */
function bolinhasDono(doc) {
  const own = doc?.ownership;
  if (!own) return "";
  const def = own.default ?? 0;
  const partes = [];
  if (def >= LV().LIMITED) partes.push(`<span class="jm-dono todos nivel-${def}" data-tooltip="${T("Todos os jogadores")}: ${nomeNivel(def)}"><i class="fa-solid fa-users"></i></span>`);
  for (const u of game.users) {
    if (u.isGM) continue;
    const n = own[u.id];
    if (n == null || n < LV().LIMITED || n <= def) continue;
    partes.push(`<span class="jm-dono nivel-${n}" style="--cor:${corUsuario(u)}" data-tooltip="${esc(u.name)}: ${nomeNivel(n)}">${esc((u.name || "?")[0].toUpperCase())}</span>`);
  }
  return partes.length ? `<span class="jm-donos" data-uuid="${doc.uuid}" data-tooltip-direction="UP">${partes.join("")}</span>` : "";
}

/** Nota rápida do mestre (só o mestre vê; aparece ao passar o mouse). */
const notaMestre = (e) => (ehGM() ? String(e?.getFlag?.(MOD, "nota") ?? "").trim() : "");
const dicaNota = (txt) => esc(txt).replace(/\n/g, "<br>");

async function editarNotaMestre(e) {
  if (!e || !ehGM()) return;
  const atual = String(e.getFlag(MOD, "nota") ?? "");
  const texto = await Dialogo().prompt({
    window: { title: `${T("Nota do mestre")}: ${e.name}`, icon: "fa-solid fa-note-sticky" },
    position: { width: 440 },
    content: `<p class="jm-dica">${T("Lembrete rápido, só para você. Aparece ao passar o mouse na lista.")}</p>
      <textarea name="nota" rows="5" style="width:100%" placeholder="${T("Ex.: Dono da taverna, deve 300 po à Guilda, sabe onde está o anel.")}">${esc(atual)}</textarea>`,
    ok: { label: T("Salvar"), icon: "fa-solid fa-check", callback: (ev, botao) => botao.form.elements.nota.value }
  }).catch(() => null);
  if (texto == null) return;
  if (texto.trim()) await e.setFlag(MOD, "nota", texto.trim());
  else await e.unsetFlag(MOD, "nota");
}

async function alternarPastaOculta(f) {
  if (!f || !ehGM()) return;
  const ocultar = !pastaMarcadaOculta(f);
  if (ocultar) await f.setFlag(MOD, "oculta", true);
  else await f.unsetFlag(MOD, "oculta");
  ui.notifications.info(ocultar ? `"${f.name}" ${T("foi para Ocultos (rodapé do Journal da Mesa).")}` : `"${f.name}" ${T("voltou para a lista.")}`);
  ui.journal?.render?.();
}

/** Janela para escolher quem vê a página: todos ou jogador por jogador. */
async function revelarPara(doc) {
  const own = doc.ownership ?? {};
  const jogadores = game.users.filter((u) => !u.isGM);
  const opcoesNivel = (nome, atual, comPadrao) => `<div class="jm-niveis">${comPadrao
    ? `<label class="jm-nivel"><input type="radio" name="${nome}" value="-1" ${atual == null || atual < 0 ? "checked" : ""}><span data-tooltip="${T("Segue o padrão de todos")}"><i class="fa-solid fa-arrow-turn-up"></i></span></label>` : ""}
    ${NIVEIS().map(([v, r, i]) => `<label class="jm-nivel"><input type="radio" name="${nome}" value="${v}" ${atual === v ? "checked" : ""}><span data-tooltip="${r}"><i class="${i}"></i> ${r}</span></label>`).join("")}</div>`;
  const linhas = jogadores.map((u) => `<div class="jm-revelar-linha">
    <span class="jm-dono" style="--cor:${corUsuario(u)}">${esc((u.name || "?")[0].toUpperCase())}</span>
    <div class="quem"><b>${esc(u.name)}</b>${u.character ? `<small>${esc(u.character.name)}</small>` : ""}</div>
    ${opcoesNivel(`u-${u.id}`, own[u.id], true)}</div>`).join("");
  const content = `<div class="jm-revelar">
    <div class="jm-revelar-linha todos"><span class="jm-dono todos"><i class="fa-solid fa-users"></i></span>
      <div class="quem"><b>${T("Todos os jogadores")}</b><small>${T("padrão")}</small></div>${opcoesNivel("default", own.default ?? 0, false)}</div>
    <hr>${linhas || `<p class="jm-vazio">${T("Nenhum jogador cadastrado.")}</p>`}
    <p class="jm-dica"><b>${T("Limitado")}</b>: ${T("vê só o nome e a imagem.")} <b>${T("Observador")}</b>: ${T("lê tudo.")} <b>${T("Dono")}</b>: ${T("pode editar.")}</p></div>`;
  const dados = await Dialogo().prompt({
    window: { title: `${T("Quem vê")}: ${doc.name}`, icon: "fa-solid fa-eye" },
    position: { width: 560 },
    content,
    ok: {
      label: T("Salvar"), icon: "fa-solid fa-check",
      callback: (ev, botao) => Object.fromEntries([...botao.form.querySelectorAll("input[type=radio]:checked")].map((i) => [i.name, Number(i.value)]))
    }
  }).catch(() => null);
  if (!dados) return;
  const novo = { ...dup(own), default: dados.default ?? 0 };
  for (const u of jogadores) {
    const v = dados[`u-${u.id}`];
    if (v == null || v < 0) delete novo[u.id];
    else novo[u.id] = v;
  }
  await doc.update({ ownership: novo }, { diff: false, recursive: false });
}

/** Abre uma imagem numa janela (o mestre pode mandar para os jogadores). */
function abrirImagem(src, titulo) {
  const IP = foundry.applications.apps.ImagePopout;
  new IP({ src, showTitle: !!titulo, window: { title: titulo || T("Imagem") } }).render(true);
}
function mostrarImagem(src, titulo, userIds = null) {
  game.socket.emit(CANAL, { acao: "imagem", src, titulo, userIds });
  abrirImagem(src, titulo);
}
function entradas() { return game.journal.filter((j) => podeVer(j)); }

function textoParaHtml(t) {
  t = String(t ?? "");
  return /<[a-z][\s\S]*>/i.test(t) ? t : esc(t).replace(/\n/g, "<br>");
}

/* ---------- moedas: lidas do sistema (respeita o Custom DnD5e) ---------- */

const MOEDAS_PADRAO = {
  pp: { label: "Platina", abbreviation: "pl", conversion: 0.1 },
  gp: { label: "Ouro", abbreviation: "po", conversion: 1 },
  ep: { label: "Electrum", abbreviation: "pe", conversion: 2 },
  sp: { label: "Prata", abbreviation: "pp", conversion: 10 },
  cp: { label: "Cobre", abbreviation: "pc", conversion: 100 }
};
const CORES_MOEDA = { pp: "#aebfd4", gp: "#d9a93a", ep: "#8fb39a", sp: "#bfc3c7", cp: "#b87333" };

const configMoedas = () => CONFIG.DND5E?.currencies ?? MOEDAS_PADRAO;
const convDe = (k) => Number(configMoedas()[k]?.conversion) || 1;

/** Moedas habilitadas no mundo, da mais valiosa para a menos valiosa. */
function moedasAtivas() {
  let custom = {};
  try {
    if (temModulo("custom-dnd5e") && game.settings.get("custom-dnd5e", "enable-currency")) custom = game.settings.get("custom-dnd5e", "currency") ?? {};
  } catch { /* Custom DnD5e sem configuração de moedas */ }
  return Object.entries(configMoedas())
    .filter(([k]) => custom[k]?.visible !== false)
    .map(([k, c]) => ({
      k,
      rotulo: game.i18n.localize(c.label ?? k),
      abrev: game.i18n.localize(c.abbreviation ?? k),
      conv: Number(c.conversion) || 1,
      icone: c.icon ?? null
    }))
    .sort((a, b) => a.conv - b.conv);
}

function iconeMoeda(m) {
  return m.icone
    ? `<img class="jm-moeda-ico" src="${esc(m.icone)}" alt="">`
    : `<i class="fa-solid fa-coins jm-moeda-ico" style="color:${CORES_MOEDA[m.k] ?? "#c9a035"}"></i>`;
}

function precoEmPo(item) {
  const p = item?.system?.price;
  if (p == null) return 0;
  const valor = Number(typeof p === "object" ? p.value : p) || 0;
  const den = (typeof p === "object" ? p.denomination : "gp") ?? "gp";
  return valor / convDe(den);
}

/** Preço escrito como texto ("10 gp", "2.5", "-5 sp"; usado na conversão do Monk's) → po. */
function precoDoTexto(str, item) {
  if (str == null || str === "") return precoEmPo(item);
  if (typeof str === "number") return Math.abs(str) || 0;
  const s = String(str);
  const valor = Math.abs(parseFloat(s.replace(",", ""))) || 0;
  const moeda = s.replace(/[^a-z]/gi, "").toLowerCase() || "gp";
  return valor / convDe(moeda);
}
/** Preço de um item de estoque (flags["journal-mesa"].preco, em po); sem ele, o preço da ficha do item. */
function precoDoItem(it) {
  const p = it?.flags?.[MOD]?.preco;
  return typeof p === "number" && Number.isFinite(p) ? p : precoEmPo(it);
}
/** Quantidade em estoque de um item (número) ou undefined (ilimitado). */
function qtdDoItem(it) {
  const q = it?.flags?.[MOD]?.qtd;
  return typeof q === "number" ? q : undefined;
}
const arredondarPo = (po) => Math.round((Number(po) || 0) * 100) / 100;

/** Quebra um valor em po nas moedas de até 1 po (sem electrum), da maior para a menor. */
function quebrarEmMoedas(po) {
  const lista = moedasAtivas().filter((m) => m.conv >= 1 && m.k !== "ep");
  const menor = Math.max(1, ...lista.map((m) => m.conv));
  let resto = Math.round((Number(po) || 0) * menor);
  const saida = {};
  for (const m of lista) {
    const valor = menor / m.conv;
    const n = Math.floor(resto / valor + 1e-9);
    if (n > 0) { saida[m.k] = n; resto -= n * valor; }
  }
  return saida;
}

function formatarPreco(po) {
  const partes = quebrarEmMoedas(po);
  const texto = moedasAtivas().filter((m) => partes[m.k]).map((m) => `${partes[m.k]} ${m.abrev}`).join(" ");
  return texto || T("grátis");
}

function formatarMoedas(moedas) {
  return moedasAtivas().filter((m) => Number(moedas?.[m.k]) > 0).map((m) => `${Number(moedas[m.k])} ${m.abrev}`).join(" · ") || T("nenhuma moeda");
}

/** Desconta um valor (em po) das moedas do ator. Moedas acima de 1 po e electrum não são criadas do nada. */
function pagar(ator, custoPo) {
  const c = ator.system?.currency;
  if (!c) return null;
  const ms = moedasAtivas();
  const menor = Math.max(1, ...ms.map((m) => m.conv));
  const unid = (m) => menor / m.conv;
  const total = ms.reduce((s, m) => s + (Number(c[m.k]) || 0) * unid(m), 0);
  const custo = Math.round((Number(custoPo) || 0) * menor);
  if (total + 1e-6 < custo) return null;
  let resto = Math.round(total - custo);
  const novo = {};
  for (const m of ms) {
    const u = unid(m);
    let n = Math.floor(resto / u + 1e-9);
    if (m.conv < 1 || m.k === "ep") n = Math.min(n, Number(c[m.k]) || 0);
    novo[m.k] = n;
    resto -= n * u;
  }
  return novo;
}

/** Soma um valor (em po) às moedas do ator. */
function receber(ator, po) {
  const c = ator.system?.currency ?? {};
  const soma = quebrarEmMoedas(po);
  return Object.fromEntries(moedasAtivas().map((m) => [m.k, (Number(c[m.k]) || 0) + (soma[m.k] || 0)]));
}

const chavesMoedas = () => moedasAtivas().map((m) => m.k);

/** Campos de moeda com ícone (baú, recompensas). */
function camposMoedas(moedas, campoBase) {
  return `<div class="jm-moedas-ed">${moedasAtivas().map((m) => `<label data-tooltip="${esc(m.rotulo)}">${iconeMoeda(m)}
    <input type="number" min="0" data-campo="${campoBase}.${m.k}" data-num value="${Number(moedas?.[m.k]) || 0}"><span>${esc(m.abrev)}</span></label>`).join("")}</div>`;
}
function mostrarMoedas(moedas) {
  const ms = moedasAtivas().filter((m) => Number(moedas?.[m.k]) > 0);
  if (!ms.length) return "";
  return `<div class="jm-moedas">${ms.map((m) => `<span class="jm-moeda" data-tooltip="${esc(m.rotulo)}">${iconeMoeda(m)} ${Number(moedas[m.k])} <small>${esc(m.abrev)}</small></span>`).join("")}</div>`;
}

async function resultadoParaItem(r) {
  let uuid = r.documentUuid ?? null;
  if (!uuid && r.documentCollection && r.documentId) {
    uuid = r.documentCollection.includes(".")
      ? `Compendium.${r.documentCollection}.Item.${r.documentId}`
      : `${r.documentCollection}.${r.documentId}`;
  }
  let doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
  if (doc && doc.documentName !== "Item") doc = null;
  const bruto = r.name || r.text || r.description || T("Item misterioso");
  return {
    doc,
    uuid: doc?.uuid ?? "",
    nome: doc?.name ?? String(bruto).replace(/<[^>]+>/g, "").trim(),
    img: doc?.img ?? r.img ?? "icons/svg/item-bag.svg",
    preco: doc ? precoEmPo(doc) : 0
  };
}

/** Item no formato de estoque do Journal da Mesa (lojas e baús). */
function itemParaLoja(doc, info = {}, quantidade = 1) {
  const data = doc ? (doc.toObject?.() ?? dup(doc)) : { name: info.nome, type: "loot", img: info.img, system: {} };
  data._id = novoId();
  if (data.flags) delete data.flags[MEJ];   // um item copiado de um estoque do Monk's não traz o formato dele
  foundry.utils.setProperty(data, `flags.${MOD}.preco`, arredondarPo(doc ? precoEmPo(doc) : info.preco));
  foundry.utils.setProperty(data, `flags.${MOD}.qtd`, quantidade);
  if (doc?.uuid) foundry.utils.setProperty(data, `flags.${MOD}.origem`, doc.uuid);
  return data;
}

/** Limpa os dados de estoque antes de o item ir para uma ficha ou para a aba Itens. */
function itemLimpo(it) {
  const d = dup(it);
  delete d._id;
  if (d.flags) { delete d.flags[MEJ]; delete d.flags[MOD]; }
  delete d.hidden; delete d.lock; delete d.consumable;
  return d;
}

function sortearTipo(chances) {
  const lista = Object.keys(OFERTAS).map((k) => [k, Math.max(0, Number(chances?.[k]) || 0)]);
  const total = lista.reduce((s, [, v]) => s + v, 0) || 1;
  let x = Math.random() * total;
  for (const [k, v] of lista) { if ((x -= v) < 0) return k; }
  return "achado";
}

function atorDoJogador() {
  const token = canvas?.tokens?.controlled?.find((t) => t.actor?.isOwner);
  return token?.actor ?? game.user.character ?? null;
}

function chat(conteudo, { whisper, ator } = {}) {
  return ChatMessage.create({
    content: `<div class="jm-chat">${conteudo}</div>`,
    whisper,
    speaker: ator ? ChatMessage.getSpeaker({ actor: ator }) : undefined
  });
}

/* tipos de aviso aceitos (o tipo também chega pelo socket: nunca chamar um método qualquer de ui.notifications) */
const TIPOS_AVISO = new Set(["info", "warn", "error", "success"]);
const tipoAviso = (t) => (TIPOS_AVISO.has(t) && typeof ui.notifications?.[t] === "function" ? t : "info");
function aviso(userId, texto, tipo = "info") {
  if (userId === game.user.id) return ui.notifications[tipoAviso(tipo)](texto);
  game.socket.emit(CANAL, { acao: "aviso", userId, texto, tipo });
}

function avatar(img, tipo, classe = "") {
  const t = TIPOS[tipo] ?? TIPOS.diario;
  return img
    ? `<img class="jm-av ${classe}" src="${esc(img)}" alt="">`
    : `<div class="jm-av jm-av-icone ${classe} tipo-${tipo}"><i class="${t.icone}"></i></div>`;
}

function opcoes(lista, atual, vazio = TF("— nenhum —")) {
  return `<option value="">${esc(vazio)}</option>` + lista
    .map(([v, r]) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(r)}</option>`).join("");
}

function corDaPasta(f) {
  const c = f.color;
  if (!c) return null;
  const css = typeof c === "string" ? c : (c.css ?? String(c));
  try {
    const [r, g, b] = (foundry.utils.Color.from(c).rgb ?? [0, 0, 0]);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { fundo: css, texto: lum > 0.6 ? "#1c1b19" : "#ffffff" };
  } catch { return { fundo: css, texto: "#ffffff" }; }
}

function caminhoDaPasta(pasta) {
  const nomes = [];
  for (let p = pasta; p; p = p.folder) nomes.unshift(p.name);
  return nomes;
}

/** Tipos de página disponíveis no mundo (núcleo + sistema), sem os do Monk's. */
function tiposDePagina() {
  const todos = game.documentTypes?.JournalEntryPage ?? Object.keys(CONFIG.JournalEntryPage?.dataModels ?? {});
  return todos.filter((t) => t !== "base" && !t.includes("."));
}
function nomeDoTipoDePagina(t) {
  if (NOMES_PAGINA[t]) return NOMES_PAGINA[t];
  const chave = CONFIG.JournalEntryPage?.typeLabels?.[t];
  return chave ? game.i18n.localize(chave) : t;
}

/** Abre o seletor de arquivos do Foundry. Devolve o caminho escolhido, ou null se a janela for fechada sem escolher. */
function escolherArquivo(tipo) {
  return new Promise((resolve) => {
    let escolhido = false;
    const fp = new (FP())({ type: tipo, callback: (path) => { escolhido = true; resolve(path || null); } });
    const fecharOriginal = fp.close.bind(fp);
    fp.close = async (...args) => {
      const r = await fecharOriginal(...args);
      setTimeout(() => { if (!escolhido) resolve(null); }, 0);   // o callback da escolha vem antes do fechar
      return r;
    };
    fp.render(true);
  });
}

async function obterPasta(tipoDoc, nome, chave, pai = null) {
  return game.folders.find((f) => f.type === tipoDoc && f.getFlag(MOD, "chave") === chave)
    ?? Folder.create({ name: nome, type: tipoDoc, folder: pai, flags: { [MOD]: { chave } } });
}

function baixarJson(dados, nome) {
  const texto = JSON.stringify(dados, null, 2);
  const salvar = foundry.utils.saveDataToFile;
  salvar(texto, "text/json", `${nome.replace(/[^\p{L}\p{N}_-]+/gu, "-")}.json`);
}

/** Pede um arquivo JSON ao usuário. Devolve o conteúdo, ou null se ele cancelar ou o arquivo não for JSON. */
function lerArquivoJson() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    let resolvido = false;
    // cancelar: o navegador avisa com "cancel"; se não avisar, o foco volta para a janela sem nenhum arquivo
    const aoVoltar = () => setTimeout(() => { if (!input.files?.length) terminar(null); }, 1000);
    const terminar = (v) => { if (resolvido) return; resolvido = true; window.removeEventListener("focus", aoVoltar); resolve(v); };
    input.addEventListener("change", async () => {
      const arq = input.files?.[0];
      if (!arq) return terminar(null);
      try { terminar(JSON.parse(await arq.text())); }
      catch { ui.notifications.error(T("Esse arquivo não é um JSON válido.")); terminar(null); }
    });
    input.addEventListener("cancel", () => terminar(null));
    window.addEventListener("focus", aoVoltar);
    input.click();
  });
}

/* ---------------- menu de botão direito ---------------- */

const Menu = {
  el: null,
  abrir(ev, itens) {
    ev.preventDefault();
    ev.stopPropagation();
    this.fechar();
    const el = document.createElement("div");
    el.className = "jm-menu";
    el.dataset.tema = game.settings.get(MOD, "tema");
    for (const it of itens.filter(Boolean)) {
      if (it === "-") { el.insertAdjacentHTML("beforeend", `<hr>`); continue; }
      const b = document.createElement("button");
      b.type = "button";
      if (it.perigo) b.classList.add("perigo");
      b.innerHTML = `<i class="${it.icone}"></i><span>${esc(it.rotulo)}</span>`;
      b.addEventListener("click", () => { this.fechar(); it.acao(); });
      el.append(b);
    }
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(ev.clientX, window.innerWidth - r.width - 8)}px`;
    el.style.top = `${Math.min(ev.clientY, window.innerHeight - r.height - 8)}px`;
    this.el = el;
    setTimeout(() => {
      this._fora = (e) => { if (!el.contains(e.target)) this.fechar(); };
      this._esc = (e) => { if (e.key === "Escape") this.fechar(); };
      document.addEventListener("pointerdown", this._fora, { capture: true });
      document.addEventListener("keydown", this._esc);
    });
  },
  fechar() {
    this.el?.remove();
    this.el = null;
    if (this._fora) document.removeEventListener("pointerdown", this._fora, { capture: true });
    if (this._esc) document.removeEventListener("keydown", this._esc);
    this._fora = this._esc = null;
  }
};

/* ---------------- ações executadas pelo mestre ---------------- */

async function executarRolagemDiaria({ entryId, userId }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  if (lojaBloqueada(e, userId)) return aviso(userId, T("A loja está fechada agora."), "warn");
  const { page, x } = analisar(e);
  if (!page) return;
  const dia = diaAtual();
  const atual = x.diaria.ofertas[userId];
  if (atual && atual.dia === dia) return aviso(userId, T("Você já rolou a oferta de hoje nesta loja. Volte amanhã!"), "warn");
  const uuidDiaria = tabelaDaLoja(x.diaria.tabela, "diaria");
  const tabela = uuidDiaria ? await fromUuid(uuidDiaria) : null;
  if (!tabela) return aviso(userId, T("Esta loja ainda não tem tabela de ofertas diárias."), "warn");
  const { results } = await tabela.roll();
  if (!results?.length) return aviso(userId, T("A tabela não retornou nenhum item."), "warn");

  const { doc, ...info } = await resultadoParaItem(results[0]);
  const tipo = sortearTipo(x.diaria.chances);
  const cfg = OFERTAS[tipo];
  const base = info.preco > 0 ? info.preco : 10;
  const preco = Math.max(0.01, Math.round(base * (cfg.min + Math.random() * (cfg.max - cfg.min)) * 100) / 100);
  const custos = String(x.diaria.custos || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const custoOculto = tipo === "escambo"
    ? (custos[Math.floor(Math.random() * custos.length)] ?? T("Algo que ainda não foi revelado")) : "";

  await page.setFlag(MOD, `diaria.ofertas.${userId}`, { dia, ...info, precoBase: base, preco, tipo, custoOculto, comprado: false });

  const user = game.users.get(userId);
  await chat(
    `<i class="fa-solid fa-dice-d20"></i> <b>${esc(user?.name)}</b> ${T("rolou a oferta do dia em")} <b>${esc(e.name)}</b>: ` +
    `${esc(info.nome)} <span class="jm-tag ${tipo}">${cfg.rotulo}</span> ${T("por")} ${formatarPreco(preco)}.`,
    { whisper: [...new Set([userId, ...idsGM()])] }
  );
  if (tipo === "escambo") await chat(`<i class="fa-solid fa-lock"></i> ${T("Custo oculto do escambo de")} <b>${esc(user?.name)}</b>: <i>${esc(custoOculto)}</i>`, { whisper: idsGM() });
}

async function executarCompra({ entryId, origem, itemId, actorUuid, userId, quantidade = 1 }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  if (lojaBloqueada(e, userId)) return aviso(userId, T("A loja está fechada agora."), "warn");
  const { page, m, x } = analisar(e);
  if (!page) return;
  const ator = await fromUuid(actorUuid);
  if (!ator) return aviso(userId, T("Personagem não encontrado."), "warn");
  let n = Math.max(1, Math.floor(Number(quantidade) || 1));

  let nome, preco, itemData = null, escambo = false, custoOculto = "";
  if (origem === "semanal") {
    const item = Object.fromEntries(comoLista(m.items))[itemId];
    const estoque = qtdDoItem(item);
    if (!item || estoque === 0 || item.hidden || item.lock) return aviso(userId, T("Esse item não está disponível."), "warn");
    if (typeof estoque === "number" && n > estoque) return aviso(userId, `${T("Só restam")} ${estoque} ${T("na loja.")}`, "warn");
    nome = item.name;
    preco = precoDoItem(item);
    const neg = negociacaoDeHoje(x, userId, `c_${itemId}`);
    if (neg?.mult != null) preco = Math.round(preco * neg.mult * 100) / 100;
    preco = Math.round(preco * n * 100) / 100;
    itemData = itemLimpo(item);
    const porUnidade = Number(itemData.system?.quantity) || 1;
    if (itemData.system) itemData.system.quantity = porUnidade * n;
  } else {
    n = 1;
    const o = x.diaria.ofertas[userId];
    if (!o || o.dia !== diaAtual() || o.comprado) return aviso(userId, T("Essa oferta não está mais disponível."), "warn");
    nome = o.nome; preco = o.preco;
    escambo = o.tipo === "escambo"; custoOculto = o.custoOculto;
    if (o.uuid) { const src = await fromUuid(o.uuid).catch(() => null); if (src?.documentName === "Item") itemData = src.toObject(); }
    itemData ??= { name: o.nome, type: "loot", img: o.img };
    delete itemData._id;
    if (escambo) foundry.utils.setProperty(itemData, `flags.${MOD}.escambo`, custoOculto);
  }

  const moedas = pagar(ator, preco);
  if (!moedas) return aviso(userId, `${ator.name} ${T("não tem dinheiro suficiente")} (${formatarPreco(preco)}).`, "warn");

  // entrega primeiro e cobra depois: se a cobrança falhar, o item entregue é apagado (mesma reversão do estoque)
  const criados = await ator.createEmbeddedDocuments("Item", [itemData]);
  try { await ator.update({ "system.currency": moedas }); }
  catch (err) {
    try { await ator.deleteEmbeddedDocuments("Item", criados.map((d) => d.id)); }
    catch (err2) { console.error(`${T("Journal da Mesa")} | ${T("não consegui desfazer a entrega do item")}`, err2); }
    throw err;
  }

  if (origem === "semanal") {
    await garantirObjeto(page, "items");
    const estoque = dadosGet(page, `items.${itemId}.flags.${MOD}.qtd`);
    if (typeof estoque === "number") await dadosSet(page, `items.${itemId}.flags.${MOD}.qtd`, Math.max(0, estoque - n));
  } else {
    await page.setFlag(MOD, `diaria.ofertas.${userId}.comprado`, true);
  }

  const linha = TF("{quem} comprou {n}{item} por {preco} em {loja}.", { quem: `<b>${esc(ator.name)}</b>`, n: n > 1 ? `<b>${n}×</b> ` : "", item: `<b>${esc(nome)}</b>`, preco: formatarPreco(preco), loja: `<b>${esc(e.name)}</b>` });
  await chat(`<i class="fa-solid fa-coins"></i> ${linha}`, { ator });
  Sessao.registrar("loja", linha);
  if (escambo) await chat(`<i class="fa-solid fa-skull"></i> <b>${esc(ator.name)}</b> ${T("aceitou o escambo por")} <b>${esc(nome)}</b>. ${T("Preço verdadeiro")}: <i>${esc(custoOculto)}</i>`, { whisper: idsGM() });
}

/** Pegar item de um baú: a pilha inteira vai para a ficha. */
async function executarPegar({ entryId, itemId, actorUuid, userId }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  const { page, m } = analisar(e);
  const ator = await fromUuid(actorUuid);
  if (!page || !ator) return aviso(userId, T("Personagem não encontrado."), "warn");
  const item = Object.fromEntries(comoLista(m.items))[itemId];
  if (!item || item.hidden || item.lock) return aviso(userId, T("Alguém já pegou esse item."), "warn");
  await ator.createEmbeddedDocuments("Item", [itemLimpo(item)]);
  await garantirObjeto(page, "items");
  await dadosUnset(page, `items.${itemId}`);
  const linha = TF("{quem} pegou {item} de {bau}.", { quem: `<b>${esc(ator.name)}</b>`, item: `<b>${esc(item.name)}</b>`, bau: `<b>${esc(e.name)}</b>` });
  await chat(`<i class="fa-solid fa-hand"></i> ${linha}`, { ator });
  Sessao.registrar("saque", linha);
}

/** Notas pessoais: dados.notas[idDoUsuário]. */
async function executarNota({ pageUuid, userId, texto }) {
  const page = await fromUuid(pageUuid);
  // userId já foi conferido (id de um usuário existente), então a chave da flag não pode apontar para outro campo
  if (page && ID_VALIDO.test(userId) && game.users.get(userId)) await dadosSet(page, `notas.${userId}`, String(texto));
}

/** Pegar um item de uma recompensa já entregue. */
async function executarPegarRecompensa({ entryId, grupo, itemId, actorUuid, userId }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  const { page, m } = analisar(e);
  const ator = await fromUuid(actorUuid);
  if (!page || !ator) return aviso(userId, T("Personagem não encontrado."), "warn");
  const r = Object.fromEntries(comoLista(m.rewards))[grupo];
  const item = Object.fromEntries(comoLista(m.items))[itemId];
  if (!r?.awarded) return aviso(userId, T("Essa recompensa ainda não foi entregue."), "warn");
  if (!item || !(r.itemIds ?? []).includes(itemId)) return aviso(userId, T("Alguém já pegou esse item."), "warn");
  await ator.createEmbeddedDocuments("Item", [itemLimpo(item)]);
  await dadosSet(page, `rewards.${grupo}.itemIds`, (r.itemIds ?? []).filter((i) => i !== itemId));
  await dadosUnset(page, `items.${itemId}`);
  const linha = `<b>${esc(ator.name)}</b> ${T("pegou")} <b>${esc(item.name)}</b> ${T("da recompensa de")} <b>${esc(e.name)}</b>.`;
  await chat(`<i class="fa-solid fa-gift"></i> ${linha}`, { ator });
  Sessao.registrar("missao", linha);
}

/* ---------- validação dos pedidos ----------
 * O mestre executa estas ações a pedido do jogador. O pedido chega pelo socket com o id do usuário e
 * da ficha escritos pelo próprio cliente, então o mestre confere tudo antes de executar:
 *   - o usuário existe; - a ficha existe e pertence a ele (Dono); - a página existe e ele pode vê-la.
 * Limitação: o Foundry não informa quem enviou a mensagem; um jogador que forje o id de outro usuário
 * E use uma ficha desse outro ainda passaria. Isso exige acesso ao console e fica registrado no chat. */
const ID_VALIDO = /^[a-zA-Z0-9]{16}$/;
function motivoRecusa(acao, msg) {
  if (!msg || typeof msg !== "object" || !ACOES_GM[acao]) return T("pedido desconhecido");
  const u = typeof msg.userId === "string" && ID_VALIDO.test(msg.userId) ? game.users.get(msg.userId) : null;
  if (!u) return T("usuário inválido");
  if (msg.actorUuid != null) {
    const ator = typeof msg.actorUuid === "string" ? fromUuidSync(msg.actorUuid) : null;
    if (!ator || ator.documentName !== "Actor") return T("ficha inválida");
    if (!u.isGM && !ator.testUserPermission(u, "OWNER")) return T("a ficha não pertence a quem pediu");
  }
  if (msg.entryId != null) {
    const e = game.journal.get(msg.entryId);
    if (!e) return T("página inexistente");
    if (!u.isGM && !e.testUserPermission(u, "LIMITED")) return T("sem acesso à página");
  }
  if (acao === "nota") {
    const page = typeof msg.pageUuid === "string" ? fromUuidSync(msg.pageUuid) : null;
    if (page?.documentName !== "JournalEntryPage") return T("página inexistente");
    if (!u.isGM && !page.parent?.testUserPermission(u, "LIMITED")) return T("sem acesso à página");
    if (typeof msg.texto !== "string" || msg.texto.length > 20000) return T("texto inválido");
  }
  if (["comprar", "vender"].includes(acao) && msg.quantidade != null && !(Number(msg.quantidade) >= 1 && Number(msg.quantidade) <= 10000)) return T("quantidade inválida");
  if (acao === "regras" && typeof msg.op !== "string") return T("operação inválida");
  return null;
}

/** Executa um pedido no mestre: valida e roda na fila (um pedido de cada vez). */
function executarPedido(acao, msg) {
  const motivo = motivoRecusa(acao, msg);
  if (motivo) {
    console.warn(`${T("Journal da Mesa | pedido")} "${acao}" recusado: ${motivo}`, msg);
    if (typeof msg?.userId === "string" && game.users.get(msg.userId)) aviso(msg.userId, `${T("O mestre não pôde fazer isso")} (${motivo}).`, "warn");
    return Promise.resolve();
  }
  return naFila("gm", () => ACOES_GM[acao](msg)).catch((err) => {
    console.error(`${T("Journal da Mesa | pedido")} "${acao}" falhou`, err, msg);
    aviso(msg.userId, T("Algo deu errado do lado do mestre; nada foi cobrado. Tente de novo."), "error");
    if (msg.userId !== game.user.id) ui.notifications.error(`${T("Journal da Mesa: falha ao executar")} "${acao}" (${err?.message ?? err}).`);
  });
}

function pedir(acao, dadosMsg) {
  if (ehGM()) return executarPedido(acao, dadosMsg);
  if (!game.users.activeGM) return ui.notifications.warn(T("O mestre precisa estar online para isso."));
  game.socket.emit(CANAL, { acao, ...dadosMsg });
}

/* ---------------- baú de saque do combate ---------------- */

function derrotadosDo(combat) {
  return combat.combatants.contents.filter((c) => {
    const a = c.actor ?? c.token?.actor;
    if (!a || a.hasPlayerOwner) return false;
    return c.defeated || Number(a.system?.attributes?.hp?.value ?? 1) <= 0;
  });
}

async function criarBauDoCombate(combat) {
  const derrotados = derrotadosDo(combat);
  if (!derrotados.length) return ui.notifications.warn(T("Nenhum inimigo derrotado neste combate."));

  const items = {};
  const moedas = Object.fromEntries(chavesMoedas().map((k) => [k, 0]));
  const nomes = [];
  for (const c of derrotados) {
    const a = c.actor ?? c.token?.actor;
    nomes.push(c.name ?? a.name);
    for (const k of chavesMoedas()) moedas[k] += Number(a.system?.currency?.[k]) || 0;
    for (const it of a.items) {
      if (!TIPOS_SAQUE.includes(it.type)) continue;
      if (it.system?.type?.value === "natural") continue;
      const data = itemParaLoja(it, {}, Number(it.system?.quantity) || 1);
      foundry.utils.setProperty(data, `flags.${MOD}.de`, a.name);
      delete data.flags[MOD].origem;   // o item da ficha do inimigo some com o token; sem link para ele
      items[data._id] = data;
    }
  }

  const pasta = await obterPasta("JournalEntry", T("Saques"), "saques");
  const nome = `${T("Baú")} — ${combat.scene?.name ?? T("Combate")} (${new Date().toLocaleDateString(game.i18n.lang)})`;
  const e = await JournalEntry.create({
    name: nome,
    folder: pasta?.id ?? null,
    ownership: { default: LV().NONE },
    pages: [{
      name: nome, type: "text",
      text: { content: `<p>${T("Saque de")}: ${nomes.map(esc).join(", ")}.</p>` },
      src: "icons/svg/chest.svg",
      flags: { [MOD]: { [CHAVE_DADOS]: { ...dadosPadrao("loot"), items, currency: moedas } } }
    }]
  });
  abrirJournal(e.id);
  ui.notifications.info(`${T("Baú criado com")} ${Object.keys(items).length} ${T("item(ns). Ele começa oculto; mostre aos jogadores quando quiser.")}`);
  return e;
}

/* ---------------- criação (usada pelo Journal e pela barra nativa) ---------------- */

async function criarTipo(tipo, pastaId = null) {
  const nova = async (nome, pagina) => JournalEntry.create({
    name: nome, folder: pastaId ?? null, sort: ordemNova(pastaId), ownership: { default: LV().NONE }, pages: [{ name: nome, ...pagina }]
  });
  if (EDITAVEIS.includes(tipo)) return { entry: await nova(`${TIPOS[tipo].rotulo} ${T("sem nome")}`, { type: "text", text: { content: "" }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao(tipo) } } }), editar: true };
  if (tipo === "deus") return { entry: await nova(T("Divindade sem nome"), { type: "text", text: { content: "" }, flags: { [MOD]: { tipo: "deus", [CHAVE_DADOS]: dadosPadrao("journalentry") } } }), editar: true };
  if (tipo === "diario") return { entry: await nova(T("Novo diário"), { type: "text", text: { content: "" } }), editar: false };
  if (tipo === "historia") return { entry: await criarHistoria(pastaId, historias().length ? T("Nova história") : T("História")), editar: false };
  if (tipo === "jornal") return { entry: await Jornal.criarJornal(pastaId), editar: false, jornal: true };
  if (tipo === "evento") {
    const hoje = calHoje();
    if (!Number.isFinite(hoje)) { ui.notifications.warn(T("Ative o Calendário da Mesa para criar eventos.")); return null; }
    if (pastaId == null) pastaId = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag?.(CAL, "pasta"))?.id ?? null;
    const e = await nova(T("Novo evento"), { type: "text", text: { content: "" }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao("journalentry") } } });
    await e.update({ [`flags.${CAL}.nota`]: notaPadrao(hoje) });
    return { entry: e, editar: true };
  }
  if (tipo === "regra") return { entry: await nova(T("Nova regra"), { type: "rule", text: { content: "" } }), editar: false, abrirFicha: true };
  if (tipo === "imagem" || tipo === "pdf") {
    const caminho = await escolherArquivo(tipo === "imagem" ? "image" : "any");
    if (!caminho) return null;
    const nome = decodeURIComponent(caminho.split("/").pop().replace(/\.[^.]+$/, ""));
    return { entry: await nova(nome, { type: tipo === "imagem" ? "image" : "pdf", src: caminho }), editar: false };
  }
  return null;
}

/** Valor de ordem para uma página nova: depois da última ou antes da primeira da pasta (configurável). */
function ordemNova(pastaId) {
  const irmaos = game.journal.filter((j) => (j.folder?.id ?? null) === (pastaId ?? null));
  if (!irmaos.length) return 0;
  const passo = CONST.SORT_INTEGER_DENSITY ?? 100000;
  const ordens = irmaos.map((j) => Number(j.sort) || 0);
  return game.settings.get(MOD, "posicaoNova") === "inicio" ? Math.min(...ordens) - passo : Math.max(...ordens) + passo;
}

/** Janela de escolha de tipo, para criar pela barra nativa de Diários. */
async function escolherTipoECriar(pastaId = null) {
  const temRegra = tiposDePagina().includes("rule");
  const lista = NOVOS.filter(([k]) => (k !== "regra" || temRegra) && (k !== "evento" || calApi())).map(([k, r, i]) => [k, r ?? TIPOS[k].rotulo, i ?? TIPOS[k].icone]);
  const pasta = pastaId ? game.folders.get(pastaId) : null;
  const tipo = await Dialogo().wait({
    window: { title: T("Nova página do Journal da Mesa"), icon: "fa-solid fa-book-open" },
    position: { width: 460 },
    content: `<p class="jm-dica">${T("Criar")} ${pasta ? `${T("em")} <b>${esc(pasta.name)}</b>` : T("na raiz")}:</p>`,
    buttons: lista.map(([k, r, i]) => ({ action: k, label: r, icon: i })),
    classes: ["jm-dialogo-tipos"],
    rejectClose: false
  }).catch(() => null);
  if (!tipo) return;
  const r = await criarTipo(tipo, pastaId);
  if (!r) return;
  janela ??= new JournalApp();
  janela.abrirPagina(r.entry.id, { editar: r.editar });
  if (r.abrirFicha) r.entry.pages.contents[0]?.sheet.render(true);
  if (r.jornal) Jornal.EditorJornal.abrir(r.entry.id);
}

/* ---------------- ações compartilhadas ---------------- */

function abrirPermissoes(e) {
  new foundry.applications.apps.DocumentOwnershipConfig({ document: e }).render(true);
}

/** Abre a página na tela só de quem tem permissão de ver (Limitado ou mais). */
async function mostrarAosJogadores(e) {
  const quem = game.users.filter((u) => !u.isGM && u.active && e.testUserPermission(u, "LIMITED"));
  if (!quem.length) {
    const algum = game.users.some((u) => !u.isGM && e.testUserPermission(u, "LIMITED"));
    const ok = await Dialogo().confirm({
      window: { title: T("Ninguém pode ver"), icon: "fa-solid fa-bullhorn" },
      content: `<p>${TF(algum ? "Nenhum jogador online pode ver {nome}." : "Nenhum jogador tem permissão para ver {nome}.", { nome: `<b>${esc(e.name)}</b>` })}</p><p>${T("Escolher agora quem vê?")}</p>`
    });
    if (ok) await revelarPara(e);
    return;
  }
  game.socket.emit(CANAL, { acao: "abrir", entryId: e.id, userIds: quem.map((u) => u.id) });
  ui.notifications.info(`"${e.name}" ${T("aberta para")}: ${quem.map((u) => u.name).join(", ")}.`);
}

/** Abre a ficha padrão do Foundry, mesmo que a ficha "Journal" esteja como padrão. */
function abrirFichaPadrao(e) {
  const Base = foundry.applications?.sheets?.journal?.JournalEntrySheet;
  if (Base) { const f = new Base({ document: e }); f._jmNativo = true; f.render(true); }
  else { const f = e.sheet; f._jmNativo = true; f.render(true); }
}

async function apagarEntrada(e) {
  const ok = await Dialogo().confirm({
    window: { title: T("Apagar página") },
    content: `<p>${T("Apagar")} <b>${esc(e.name)}</b>? ${T("Isso apaga o Diário do Foundry e não pode ser desfeito.")}</p>`
  });
  if (ok) await e.delete();
}

function corParaTexto(c) { return c ? (typeof c === "string" ? c : (c.css ?? String(c))) : null; }

function exportarPasta(f) {
  const lista = [];
  const visitar = (pasta, caminho) => {
    for (const j of game.journal.filter((jj) => jj.folder?.id === pasta.id)) {
      const data = j.toObject();
      delete data.folder;
      lista.push({ caminho, data });
    }
    for (const sub of game.folders.filter((ff) => ff.type === "JournalEntry" && ff.folder?.id === pasta.id)) {
      visitar(sub, [...caminho, { nome: sub.name, cor: corParaTexto(sub.color) }]);
    }
  };
  visitar(f, [{ nome: f.name, cor: corParaTexto(f.color) }]);
  baixarJson({ formato: "journal-mesa", versao: 1, entradas: lista }, f.name);
}

/**
 * Importa JSON:
 *  - exportação de pasta do Journal (recria as subpastas);
 *  - Diário do Foundry (um ou uma lista), inclusive os exportados pelo Monk's;
 *  - Itens (um ou uma lista) — vão para a aba Itens.
 */
async function importarJson(pastaId) {
  const dados = await lerArquivoJson();
  if (!dados) return;
  const limpar = (d) => { const c = dup(d); delete c._id; delete c.folder; delete c._stats; return c; };
  let criados = 0, itens = 0, convertidas = 0;

  if (dados.formato === "journal-mesa" && Array.isArray(dados.entradas)) {
    const cache = new Map();
    const pastaPara = async (caminho) => {
      let pai = pastaId ?? null;
      let chave = pai ?? "";
      for (const parte of caminho) {
        chave += `/${parte.nome}`;
        if (!cache.has(chave)) {
          const existe = game.folders.find((ff) => ff.type === "JournalEntry" && ff.name === parte.nome && (ff.folder?.id ?? null) === pai);
          cache.set(chave, existe ?? await Folder.create({ name: parte.nome, type: "JournalEntry", folder: pai, color: parte.cor || null }));
        }
        pai = cache.get(chave).id;
      }
      return pai;
    };
    for (const { caminho, data } of dados.entradas) {
      const d = limpar(data);
      convertidas += converterDadosDeEntrada(d);
      await JournalEntry.create({ ...d, folder: await pastaPara(caminho ?? []) });
      criados++;
    }
  } else {
    const lista = Array.isArray(dados) ? dados : [dados];
    for (const d of lista) {
      if (!d || typeof d !== "object") continue;
      if (Array.isArray(d.pages)) {
        const dd = limpar(d);
        convertidas += converterDadosDeEntrada(dd);
        await JournalEntry.create({ ...dd, folder: pastaId ?? null });
        criados++;
      } else if (d.type && d.system && d.name) {
        const raiz = await obterPasta("Item", T("Journal"), "itens");
        /* mantém o _id do arquivo (quando livre) para que relíquias e links @UUID[Item.id] continuem funcionando */
        const manterId = typeof d._id === "string" && /^[a-zA-Z0-9]{16}$/.test(d._id) && !game.items.has(d._id);
        const dadosItem = { ...limpar(d), folder: raiz?.id ?? null };
        if (manterId) dadosItem._id = d._id;
        await Item.create(dadosItem, { keepId: manterId });
        itens++;
      }
    }
  }
  if (!criados && !itens) return ui.notifications.warn(T("Não encontrei diários nem itens nesse JSON."));
  ui.notifications.info(`${T("Importado")}: ${criados} ${T("página(s)")}${itens ? ` ${T("e")} ${itens} ${T("item(ns) na aba Itens")}` : ""}${convertidas ? ` (${convertidas} ${T("convertida(s) do formato do Monk's")})` : ""}.`);
}

/* ---------------- inicialização ---------------- */

let janela = null;
let FichaJournalClasse = null;
/** A janela do Journal (cria na primeira vez). Quem está fora deste arquivo usa isto em vez de atribuir "janela". */
function obterJanela() { janela ??= new JournalApp(); return janela; }

function abrirJournal(id) {
  janela ??= new JournalApp();
  if (id && game.journal.get(id)) janela.abrirPagina(id);
  else janela.render({ force: true });
  return janela;
}

const atualizarTudo = foundry.utils.debounce(() => {
  if (janela?.rendered) janela.render();
  Rastreador.render();
}, 80);

Hooks.once("init", () => {
  Jornal.registrarConfiguracoes();
  registrarTabelasLojas();
  game.settings.register(MOD, "tema", {
    name: T("Tema do Journal da Mesa"), hint: T("Visual da janela e do rastreador de missões."),
    scope: "client", config: true, type: String, choices: TEMAS, default: "claro", onChange: atualizarTudo
  });
  game.settings.register(MOD, "rastreador", {
    name: T("Mostrar rastreador de missões"), hint: T("Painel flutuante com as missões em andamento."),
    scope: "client", config: true, type: Boolean, default: true, onChange: atualizarTudo
  });
  game.settings.register(MOD, "abrirAqui", {
    name: T("Abrir diários sempre no Journal da Mesa"),
    hint: T("Diários abertos em qualquer lugar (barra lateral, notas no mapa, links, macros, outros módulos) abrem nesta janela, na página certa — se o diário usar a ficha padrão ou a ficha \"Journal da Mesa\". Diários com a ficha de outro módulo (Heavy Lore, Monk's...) abrem na janela desse módulo. Desligado: só abre no Journal da Mesa quem tiver a ficha \"Journal da Mesa\" escolhida em Configurar Ficha."),
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "editor", {
    name: T("Editor de descrição"),
    hint: T("\"Foundry\" usa o editor com formatação. \"Simples\" usa uma caixa de texto (aceita HTML) — use se o editor do Foundry não deixar digitar."),
    scope: "client", config: true, type: String, default: "foundry",
    choices: { foundry: T("Foundry (com formatação)"), simples: T("Simples (caixa de texto)") }
  });
  game.settings.register(MOD, "posicaoNova", {
    name: T("Onde colocar páginas novas"),
    hint: T("Ao criar uma página dentro de uma pasta (a pasta clicada ou a da página aberta), ela vai para o fim ou para o início da pasta. Pastas em ordem alfabética ignoram isso."),
    scope: "world", config: true, type: String, default: "fim",
    choices: { fim: T("No fim da pasta (depois da última)"), inicio: T("No início da pasta (antes da primeira)") },
    onChange: () => atualizarTudo()
  });
  game.settings.register(MOD, "pechinchaChat", {
    name: T("Pechincha interativa no chat"),
    hint: T("Ligado: a pechincha cria um cartão no chat; o jogador clica no dado dele e o mestre no dado do vendedor (com vantagem/desvantagem). Desligado: os dois dados são rolados na hora."),
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "donos", {
    name: T("Mostrar quem vê cada documento"),
    hint: T("Bolinhas com a inicial de cada jogador que tem acesso (como o Ownership Viewer), no Journal da Mesa e nas abas de Atores, Itens, Diários, Cenas, Tabelas e Macros. Clique nelas para mudar."),
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => { atualizarTudo(); for (const a of Object.values(ui.sidebar?.tabs ?? {})) a?.render?.(); }
  });
  game.settings.register(MOD, "bauFimCombate", {
    name: T("Perguntar sobre o baú de saque ao fim do combate"),
    hint: T("Ao encerrar um combate, oferece criar um Baú com os itens e moedas dos inimigos derrotados."),
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "nexusAtivo", {
    name: T("Medidor dos Nexus"),
    hint: T("Liga a aba Nexus no Journal da Mesa: um medidor (0 a 100%) para cada Nexus, com limiares que avisam o mestre e podem ligar uma anomalia no clima do Calendário da Mesa."),
    scope: "world", config: true, type: Boolean, default: false, onChange: () => atualizarTudo()
  });
  game.settings.register(MOD, "nexusJogadores", {
    name: T("Jogadores veem os Nexus"),
    hint: T("Mostra aos jogadores os medidores marcados como visíveis (só leitura)."),
    scope: "world", config: true, type: Boolean, default: false, onChange: () => atualizarTudo()
  });
  game.settings.register(MOD, "renovarAuto", {
    name: T("Renovar o estoque das lojas a cada nova semana"),
    hint: T("Com o Calendário da Mesa: quando começa uma semana, as lojas que têm tabela de estoque rolam o estoque novo sozinhas. Desligado: o calendário só lembra o mestre no chat."),
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(MOD, "sessaoAuto", {
    name: T("Diário de sessão automático"),
    hint: T("Ao entrar no mundo, o mestre começa a anotar a sessão sozinho (compras, vendas, saques, missões, prazos, dias que passaram, Nexus). Desligado: use o botão do diário no rodapé do Journal da Mesa."),
    scope: "world", config: true, type: Boolean, default: false
  });
  game.settings.register(MOD, "nexusLista", { scope: "world", config: false, type: Array, default: [], onChange: () => { if (["__nexus", "__linha"].includes(janela?.ativa)) atualizarTudo(); } });
  game.settings.register(MOD, "sessaoAtual", {
    scope: "world", config: false, type: Object, default: null,
    // só redesenha quando a sessão começa ou termina (não a cada registro)
    onChange: (v) => { if (sessaoMudou(!!v?.inicio) && ehGM()) atualizarTudo(); }
  });
  game.settings.register(MOD, "sessaoNumero", { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register(MOD, "regrasMesa", { scope: "world", config: false, type: Object, default: { itens: [], sessao0: {} }, onChange: () => { if (janela?.ativa === "__regras") atualizarTudo(); } });
  // fixados: por usuário (acompanha a pessoa em qualquer computador); onde não houver esse escopo, por navegador
  game.settings.register(MOD, "fixados", { scope: CONST.SETTING_SCOPES?.USER ?? "client", config: false, type: Array, default: [], onChange: () => atualizarTudo() });
  game.settings.register(MOD, "posRastreador", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(MOD, "pastasAbertas", { scope: "client", config: false, type: Array, default: [] });
  game.settings.register(MOD, "dia", { scope: "world", config: false, type: Number, default: 1, onChange: atualizarTudo });
  // versão do formato dos dados (5 = flags["journal-mesa"].dados, desde a 5.0); 0 = ainda não conferido
  game.settings.register(MOD, "formatoDados", { scope: "world", config: false, type: Number, default: 0 });

  /* ficha "Journal" na lista de fichas de Diário (Configurar Ficha) */
  const Base = foundry.applications?.sheets?.journal?.JournalEntrySheet;
  const Config = foundry.applications?.apps?.DocumentSheetConfig;
  if (Base && Config?.registerSheet) {
    /** Abre o diário da ficha na janela do Journal da Mesa, na página/âncora pedidas (pageId, page, anchor). */
    const abrirPelaFicha = (ficha, opcoes, resto) => {
      const extra = typeof opcoes === "object" && opcoes ? opcoes : (resto[0] ?? {});
      janela ??= new JournalApp();
      janela.abrirPagina(ficha.document.id, { pagina: extra.pageId ?? extra.page?.id ?? null, ancora: extra.anchor ?? null });
    };
    /* ficha "Journal da Mesa": renderizar = abrir o diário na janela do módulo (a ficha nativa não aparece).
     * Um diário que não está no mundo (compêndio) não tem como abrir na janela: fica com a ficha nativa. */
    class FichaJournal extends Base {
      async render(opcoes, ...resto) {
        if (!this.document || !game.journal.get(this.document.id)) return super.render(opcoes, ...resto);
        abrirPelaFicha(this, opcoes, resto);
        return this;
      }
    }
    FichaJournalClasse = FichaJournal;
    Config.registerSheet(JournalEntry, MOD, FichaJournal, { label: T("Journal da Mesa (janela única)"), makeDefault: false });

    /* A opção "Abrir diários sempre no Journal da Mesa" vale também para diários que usam a ficha padrão do
     * Foundry ou do sistema (a ficha do módulo registrada acima só vale para quem a escolheu em Configurar
     * Ficha). Por isso a abertura da ficha padrão é interceptada aqui: só a ABERTURA (render forçado de
     * uma ficha fechada) de um diário do mundo que o usuário pode ver e que abreNoJournal aceita (ficha do
     * núcleo, do sistema ou deste módulo). Fichas de outros módulos (Monk's, Heavy Lore...) e as marcadas
     * com _jmNativo ("Abrir na ficha padrão") seguem para o render original, com o resultado dele. */
    const renderOriginal = Base.prototype.render;
    Base.prototype.render = function (opcoes, ...resto) {
      let interceptar = false;
      try {
        const forcar = opcoes === true || opcoes?.force === true;
        const doc = this.document;
        interceptar = forcar && !this.rendered && !this._jmNativo && game.ready && game.settings.get(MOD, "abrirAqui")
          && doc?.documentName === "JournalEntry" && !doc.pack && !!game.journal.get(doc.id) && podeVer(doc) && abreNoJournal(doc);
      } catch (err) { avisoUmaVez(T("abrir no Journal da Mesa"), err); interceptar = false; }
      if (interceptar) {
        try { abrirPelaFicha(this, opcoes, resto); return Promise.resolve(this); }   // mesma forma do original (Promise da ficha); a nativa fica fechada
        catch (err) { avisoUmaVez(T("abrir no Journal da Mesa"), err); }
      }
      return renderOriginal.call(this, opcoes, ...resto);
    };
  }
});

Hooks.once("ready", () => {
  game.modules.get(MOD).api = {
    abrir: abrirJournal, bauDoCombate: criarBauDoCombate, importarJson, importarDoMonks, criarPagina: criarTipo,
    /** Dia do mundo das ofertas diárias (usado pelo Calendário da Mesa na virada do dia). */
    dia: {
      get: () => diaAtual(),
      somar: async (n) => { if (!ehGM()) return diaAtual(); const v = Math.max(1, diaAtual() + Math.trunc(Number(n) || 0)); await game.settings.set(MOD, "dia", v); return v; }
    },
    renovarEstoques,
    fixados: () => [...fixados()],
    /** Jornal de Notícias: só o que o usuário pode ler (sem veracidade, notas do mestre ou rascunhos de outros). */
    jornais: Jornal.apiJornais,
    /** Abre a Linha do tempo, no dia td se vier (o Calendário da Mesa 4.2+ usa no painel do dia). */
    linhaDoTempo: (td = null) => { janela ??= new JournalApp(); janela.abrirLinha(td); return janela; },
    /** Medidores dos Nexus (cópia) e mudar o valor de um (só o mestre). */
    nexus: { lista: () => (Nexus.ligado() ? Nexus.lista() : []), definir: (id, valor) => Nexus.definir(id, valor) }
  };

  game.socket.on(CANAL, (msg) => {
    if (msg.acao === "abrir") {
      if (msg.userIds && !msg.userIds.includes(game.user.id)) return;
      return abrirJournal(msg.entryId);
    }
    if (msg.acao === "jornalApresentar") return Jornal.aoApresentar(msg);
    // imagem e aviso podem ser forjados por qualquer cliente: só texto, tamanho limitado, sem esquemas perigosos
    if (msg.acao === "imagem") {
      if (msg.userIds && !(Array.isArray(msg.userIds) && msg.userIds.includes(game.user.id))) return;
      const src = typeof msg.src === "string" ? Jornal.caminhoSeguro(msg.src) : "";
      if (src) abrirImagem(src, typeof msg.titulo === "string" ? msg.titulo.slice(0, 200) : "");
      return;
    }
    if (msg.acao === "aviso") {
      if (msg.userId === game.user.id && typeof msg.texto === "string") ui.notifications[tipoAviso(msg.tipo)](msg.texto.slice(0, 500));
      return;
    }
    if (game.user !== game.users.activeGM) return;
    executarPedido(msg.acao, msg);
  });

  document.addEventListener("click", cliqueEmLink, true);

  if (temModulo(MEJ) && ehGM()) {
    ui.notifications.info(T("Journal da Mesa: o Monk's Enhanced Journal também está ativo. Desde a 5.0 cada um guarda os próprios dados, e o que você muda num não aparece no outro. Recomendo deixar só um ativo."));
  }
  if (souGMPrincipal()) {
    migrarFormato().catch((err) => relatarErro(T("conversão do formato"), err));
    /* páginas que chegam no formato do Monk's (criadas por ele, importadas de compêndios...) ganham o registro próprio */
    const converterSeVier = (entry) => {
      if (!souGMPrincipal() || !entry?.pages?.contents?.some(paginaPendenteDoMonks)) return;
      importarDoMonks({ entradas: [entry], silencioso: true }).catch((err) => relatarErro(T("importar do Monk's"), err));
    };
    Hooks.on("createJournalEntry", (entry) => converterSeVier(entry));
    Hooks.on("updateJournalEntryPage", (page, changes) => {
      const c = `flags.${MEJ}.type`;
      if (foundry.utils.hasProperty(changes ?? {}, c)) converterSeVier(page.parent);
    });
  }
  Rastreador.render();
  lembrarEstadoInicial();
  if (souGMPrincipal() && game.settings.get(MOD, "sessaoAuto") && !Sessao.ativa()) Sessao.iniciar();
  // edições programadas que venceram enquanto o mundo estava fechado
  if (souGMPrincipal()) Jornal.verificarProgramadas().catch((err) => relatarErro(T("edições programadas"), err));
});

/* ---------------- Jornal de Notícias: funções do Journal que ele usa ---------------- */
Jornal.instalarContexto({
  MOD, CAL, CANAL, TIPOS, esc, TE, FP, Dialogo, LV, Tempo, Sessao, analisar, chat, idsGM, dup, naFila,
  relatarErro, avisoUmaVez, textoParaHtml, ordemNova, souGMPrincipal,
  abrirJournal: () => { janela ??= new JournalApp(); return janela; },
  atualizarTudo: () => atualizarTudo()
});
Jornal.registrarGanchos();
configurarTabelasLojas({ MOD, T: (s) => T(s), esc, atualizar: () => atualizarTudo() });
/* "Copiar o registro da sessão" na janela de encerrar a sessão (texto simples, para o Transcritor da Mesa) */
document.addEventListener?.("click", async (ev) => {
  const b = ev.target?.closest?.("[data-jm-copiar-registro]");
  if (!b || !ehGM()) return;
  ev.preventDefault();
  const s = Sessao.atual();
  const linhas = (s?.registros ?? []).map((r) => `- ${String(r.html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}`).filter((l) => l.length > 2);
  const texto = `${T("Registro automático do Journal da Mesa")} — ${T("Sessão")} ${s?.n ?? ""}\n${linhas.join("\n") || T("(nada anotado)")}`;
  try {
    if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(texto); else await navigator.clipboard.writeText(texto);
    ui.notifications.info(T("Registro copiado."));
  } catch { ui.notifications.warn(T("Não consegui copiar automaticamente.")); }
});
/* ---------------- idioma: constantes e configurações ---------------- */
Hooks.once("i18nInit", () => {
  for (const o of [TIPOS, TIPO_FICHA, NOVOS, NOMES_MEJ, NOMES_PAGINA, DETALHES, CAMPOS_DEUS, STATUS_DEUS, SIMBOLOS_DEUS, SECOES_DEUS,
    ABAS_DEUS, STATUS, OFERTAS, REGRAS_CATS, REGRAS_STATUS, REGRAS_MODELOS, CAL_REPETIR, CAL_MODOS_MES, CAL_FIM, CAL_ICONES_GRUPOS,
    CAL_ICONES, CAL_AVISOS, HIST_ICONES, MOEDAS_PADRAO, RESULTADOS, PERICIAS_VENDEDOR, NEXUS_ICONES]) traduzirNoLugar(o);
  // nome, dica e opções das configurações e menus do módulo (registrados em português no "init")
  for (const [chave, def] of game.settings.settings ?? []) {
    if (!String(chave).startsWith(`${MOD}.`)) continue;
    if (typeof def.name === "string") def.name = T(def.name);
    if (typeof def.hint === "string") def.hint = T(def.hint);
    if (def.choices && typeof def.choices === "object") for (const k of Object.keys(def.choices)) if (typeof def.choices[k] === "string") def.choices[k] = T(def.choices[k]);
  }
  for (const [chave, def] of game.settings.menus ?? []) {
    if (!String(chave).startsWith(`${MOD}.`)) continue;
    for (const c of ["name", "label", "hint"]) if (typeof def[c] === "string") def[c] = T(def[c]);
  }
});

export { ABAS_DEUS, CAMPOS_DEUS, DETALHES, Dialogo, FP, FichaJournalClasse, ICONES_PAGINA, CHAVE_DADOS, LIMITES_REGRAS, LV, MOD, Menu, NOMES_MEJ, NOVOS, OFERTAS, REGRAS_CATS, REGRAS_MODELOS, REGRAS_STATUS, SECOES_DEUS, SIMBOLOS_DEUS, STATUS, STATUS_DEUS, TE, TEMAS, TIPOS, TIPOS_SAQUE, abrirFichaPadrao, abrirImagem, abrirJournal, abrirPermissoes, alternarFixado, alternarPastaOculta, analisar, apagarChave, apagarEntrada, atorDoJogador, atualizarTudo, avatar, aviso, avisoUmaVez, baixarJson, bolinhasDono, caminhoDaPasta, camposMoedas, chat, chavesMoedas, comoLista, converterDadosDeEntrada, corDaPasta, criarBauDoCombate, criarTipo, dadosDeMonks, derrotadosDo, diaAtual, dicaNota, dup, editarNotaMestre, ehGM, entradaOculta, entradas, esc, escolherTipoECriar, estaVisivel, estadoSecao, executarCompra, executarNota, executarPegar, executarPegarRecompensa, executarRolagemDiaria, exportarPasta, fichasDe, fixados, formatarMoedas, formatarPreco, garantirObjeto, gravarJunto, idsGM, importarDoMonks, importarJson, infoCon, itemLimpo, itemParaLoja, janela, dadosGet, dadosPadrao, dadosSet, dadosUnset, migrarFormato, mostrarAosJogadores, mostrarImagem, mostrarMoedas, paginaPendenteDoMonks, naFila, nomeDoTipoDePagina, nomeTema, notaMestre, novoId, obterJanela, obterPasta, opcoes, ordemNova, pastaMarcadaOculta, pastaOculta, pedir, podeLer, podeVer, podeVerSecao, precoDoItem, precoEmPo, qtdDoItem, arredondarPo, receber, regrasMesa, relatarErro, resultadoParaItem, revelarPara, rotuloEstadoSecao, substituirMapa, temModulo, textoParaHtml, tiposDePagina, visibilidade };
