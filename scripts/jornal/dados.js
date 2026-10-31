/* Jornal de Notícias — dados das publicações e das edições.
 *
 * Publicação = Diário nativo com flags["journal-mesa"].tipo = "jornal" e a identidade em
 *              flags["journal-mesa"].jornal. A circulação é a permissão do próprio Diário
 *              (o olho do Journal / "Configurar permissões" do Foundry).
 * Edição     = página de texto do Diário com flags["journal-mesa"].edicao (só dados públicos).
 *              Rascunho e programada: permissão própria "Nada" (só o mestre e quem ele liberar).
 *              Publicada e arquivada: permissão "herdar" do Diário (quem lê o jornal lê a edição).
 *              text.content guarda uma versão simples da edição, para a ficha padrão do Foundry.
 * Segredos   = veracidade e notas do mestre ficam fora da página (redacao.js). */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { limparHtml } from "./html.js";

/* rótulos: chaves de idioma (lang/*.json, "JMESA.Jornal...."); use os rot*() abaixo para o texto */
export const ESTILOS = {
  medieval: { icone: "fa-solid fa-scroll" },
  gazeta: { icone: "fa-solid fa-feather-pointed" },
  clandestino: { icone: "fa-solid fa-mask" }
};
export const ESTADOS = {
  rascunho: { icone: "fa-solid fa-pen-ruler" },
  programado: { icone: "fa-solid fa-clock" },
  publicado: { icone: "fa-solid fa-newspaper" },
  arquivado: { icone: "fa-solid fa-box-archive" }
};
/* seções onde uma matéria pode aparecer (o que o leitor vê) */
export const SECOES = {
  noticia: { icone: "fa-solid fa-newspaper" },
  rumor: { icone: "fa-solid fa-ear-listen" },
  aviso: { icone: "fa-solid fa-bullhorn" },
  classificado: { icone: "fa-solid fa-tags" }
};
/* veracidade: SÓ o mestre (fica na redação, nunca na página) */
export const VERACIDADE = {
  "": { cor: "" },
  verdadeira: { cor: "#3f8f4f" },
  rumor: { cor: "#b8862e" },
  manipulada: { cor: "#b8473f" },
  propaganda: { cor: "#8a3fb8" },
  naoConfirmada: { cor: "#5f7a99" },
  oficial: { cor: "#2e6db8" }
};
export const CATEGORIAS = ["politica", "guerra", "comercio", "crime", "fe", "sociedade", "misterio", "viagens", "natureza", "cultura", "opiniao"];

export const rotEstilo = (k) => t(`Jornal.Estilo.${ESTILOS[k] ? k : "medieval"}`);
export const rotEstado = (k) => t(`Jornal.Estado.${ESTADOS[k] ? k : "rascunho"}`);
export const rotSecao = (k) => t(`Jornal.Secao.${SECOES[k] ? k : "noticia"}`);
export const rotSecaoUm = (k) => t(`Jornal.SecaoUm.${SECOES[k] ? k : "noticia"}`);
export const rotVerdade = (k) => t(`Jornal.Verdade.${k || "nenhuma"}`);
export const rotCategoria = (k) => t(`Jornal.Categoria.${k}`);

const LIM = { curto: 200, medio: 600, html: 60000, materias: 60, vinculos: 30 };
const ID = /^[a-zA-Z0-9]{16}$/;
const COR = /^#[0-9a-f]{6}$/i;

const txt = (v, n = LIM.curto) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const txtLongo = (v, n = LIM.medio * 4) => String(v ?? "").replace(/\r/g, "").slice(0, n);
/** Caminho de imagem: sem esquemas perigosos (javascript:, data:text...). */
export function caminhoSeguro(v) {
  const s = txt(v, 500);
  if (!s) return "";
  if (/^\s*(javascript|vbscript|data:(?!image\/))/i.test(s)) return "";
  return s;
}
/** HTML rico (das caixas de texto do Foundry), sempre limpo antes de ir para a tela (html.js). */
export const htmlSeguro = (v) => limparHtml(String(v ?? "").slice(0, LIM.html));
export const LIMITES = LIM;
/** UUID de documento do mundo que uma matéria pode citar (Diário, página, ator, item). */
export const uuidValido = (u) => typeof u === "string" && /^(JournalEntry|Actor|Item)\.[a-zA-Z0-9]{16}(\.(JournalEntryPage|Item)\.[a-zA-Z0-9]{16})?$/.test(u);
/** Documento de um UUID (null se não existir ou se o UUID for malformado: fromUuidSync lança nesses casos). */
export function docDe(uuid) {
  if (typeof uuid !== "string" || !uuid) return null;
  try { return fromUuidSync(uuid) ?? null; } catch { return null; }
}
const tdOuNulo = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

/* ---------------- publicação ---------------- */

export function identidadePadrao() {
  return { subtitulo: "", logo: "", descricao: "", regiao: "", organizacao: "", orgTexto: "", estilo: "medieval", cor: "#7a4b1f", lema: "" };
}
export function normalizarIdentidade(i) {
  const p = identidadePadrao();
  return {
    subtitulo: txt(i?.subtitulo), logo: caminhoSeguro(i?.logo), descricao: txtLongo(i?.descricao, 4000),
    regiao: txt(i?.regiao), organizacao: uuidValido(i?.organizacao) ? i.organizacao : "", orgTexto: txt(i?.orgTexto),
    estilo: ESTILOS[i?.estilo] ? i.estilo : p.estilo, cor: COR.test(i?.cor ?? "") ? i.cor : p.cor, lema: txt(i?.lema)
  };
}
export const ehJornal = (j) => !!j && j.documentName === "JournalEntry" && j.flags?.[J.MOD]?.tipo === "jornal";
export const identidade = (j) => normalizarIdentidade(j?.flags?.[J.MOD]?.jornal);
/** Publicações que o usuário enxerga (o mestre vê todas). */
export const jornais = (user = game.user) => game.journal.filter((j) => ehJornal(j) && (user.isGM || j.testUserPermission(user, "LIMITED")));

export async function criarJornal(pastaId = null, nome = null) {
  nome ??= t("Jornal.NovoJornal");
  if (!game.user.isGM) return null;
  return JournalEntry.create({
    name: nome, folder: pastaId ?? null, sort: J.ordemNova(pastaId), ownership: { default: J.LV().NONE },
    flags: { [J.MOD]: { tipo: "jornal", jornal: identidadePadrao() } }, pages: []
  });
}

/* ---------------- edição ---------------- */

export function materiaPadrao(secao = "noticia") {
  return { id: foundry.utils.randomID(), secao, titulo: "", texto: "", imagem: "", categoria: "", autor: "", vinculos: [], fotos: [] };
}
export function normalizarMateria(m) {
  return {
    id: ID.test(m?.id ?? "") ? m.id : foundry.utils.randomID(),
    secao: SECOES[m?.secao] ? m.secao : "noticia",
    titulo: txt(m?.titulo), texto: htmlSeguro(m?.texto), imagem: caminhoSeguro(m?.imagem),
    categoria: txt(m?.categoria, 60), autor: txt(m?.autor, 120),
    vinculos: [...new Set((Array.isArray(m?.vinculos) ? m.vinculos : []).filter(uuidValido))].slice(0, LIM.vinculos),
    /* vínculos mostrados com foto dentro da matéria (sempre um subconjunto dos vínculos) */
    fotos: [...new Set(Array.isArray(m?.fotos) ? m.fotos : [])].filter((u) => Array.isArray(m?.vinculos) && m.vinculos.includes(u) && uuidValido(u))
  };
}
export function edicaoPadrao(numero = 1, td = null) {
  return {
    v: 1, numero, td, dataTexto: "", titulo: "", subtitulo: "", imagem: "", editor: "", texto: "", rodape: "",
    materias: [], estado: "rascunho", publicarEm: null, auto: true, anunciar: true, avisado: false,
    publicadoEm: null, arquivadoEm: null
  };
}
export function normalizarEdicao(e) {
  const p = edicaoPadrao();
  return {
    v: 1,
    numero: Math.max(0, Math.min(999999, Math.trunc(Number(e?.numero) || 0))),
    td: tdOuNulo(e?.td), dataTexto: txt(e?.dataTexto, 120),
    titulo: txt(e?.titulo), subtitulo: txt(e?.subtitulo, 400), imagem: caminhoSeguro(e?.imagem), editor: txt(e?.editor, 120),
    texto: htmlSeguro(e?.texto), rodape: txt(e?.rodape, 400),
    materias: (Array.isArray(e?.materias) ? e.materias : []).slice(0, LIM.materias).map(normalizarMateria),
    estado: ESTADOS[e?.estado] ? e.estado : p.estado,
    publicarEm: tdOuNulo(e?.publicarEm), auto: e?.auto !== false, anunciar: e?.anunciar !== false, avisado: !!e?.avisado,
    publicadoEm: tdOuNulo(e?.publicadoEm), arquivadoEm: tdOuNulo(e?.arquivadoEm)
  };
}
export const ehEdicao = (p) => !!p && p.documentName === "JournalEntryPage" && !!p.flags?.[J.MOD]?.edicao && ehJornal(p.parent);
export const lerEdicao = (p) => (ehEdicao(p) ? normalizarEdicao(p.flags[J.MOD].edicao) : null);
export const publicaEstado = (est) => est === "publicado" || est === "arquivado";

/** O usuário pode ler esta edição? Mestre sempre; jogador: precisa de Observador na página. */
export function podeLerEdicao(p, user = game.user) {
  if (!ehEdicao(p)) return false;
  if (user.isGM) return true;
  return p.testUserPermission(user, "OBSERVER");
}
/** Edições de uma publicação que o usuário pode ler, da mais nova para a mais antiga. */
export function edicoes(entry, user = game.user) {
  return entry.pages.contents.filter((p) => podeLerEdicao(p, user))
    .map((p) => ({ p, ed: lerEdicao(p) }))
    .sort((a, b) => (b.ed.numero - a.ed.numero) || (b.p.sort - a.p.sort));
}
export const proximoNumero = (entry) => entry.pages.contents.reduce((mx, p) => Math.max(mx, lerEdicao(p)?.numero ?? 0), 0) + 1;
export const nomeDaPagina = (ed) => `${t("Jornal.NumeroCurto", { n: ed.numero })} — ${ed.titulo || t("Jornal.SemManchete")}`.slice(0, 250);

export async function criarEdicao(entry, dados = null) {
  if (!game.user.isGM || !ehJornal(entry)) return null;
  // dados: a edição já pronta (importação): nome, texto e flags vão na mesma criação, sem página vazia no meio
  const ed = dados ? normalizarEdicao({ ...dados, estado: "rascunho", publicarEm: null, publicadoEm: null, arquivadoEm: null, avisado: false })
    : edicaoPadrao(proximoNumero(entry), J.Tempo.ok() ? J.Tempo.hoje() : null);
  const [p] = await entry.createEmbeddedDocuments("JournalEntryPage", [{
    name: nomeDaPagina(ed), type: "text", text: { content: dados ? htmlNativo(entry, ed) : "" },
    sort: (entry.pages.contents.reduce((mx, pg) => Math.max(mx, pg.sort), 0) || 0) + 100000,
    ownership: { default: J.LV().NONE },
    flags: { [J.MOD]: { edicao: ed } }
  }]);
  return p;
}

/** Data mostrada na edição: a do calendário (td) ou o texto manual. */
export function dataDaEdicao(ed) {
  if (ed.td != null && J.Tempo.ok()) return J.Tempo.texto(ed.td);
  return ed.dataTexto || "";
}

/** Versão simples (só o que é público) para a ficha padrão do Foundry e para o Translate All. */
export function htmlNativo(entry, ed) {
  const e = J.esc;
  const secoes = Object.keys(SECOES).map((k) => {
    const l = ed.materias.filter((m) => m.secao === k);
    if (!l.length) return "";
    return `<h2>${e(rotSecao(k))}</h2>${l.map((m) => `<h3>${e(m.titulo || rotSecaoUm(k))}</h3>${m.categoria || m.autor ? `<p><em>${e([m.categoria, m.autor].filter(Boolean).join(" · "))}</em></p>` : ""}${m.imagem ? `<p><img src="${e(m.imagem)}"></p>` : ""}${m.texto}`).join("")}`;
  }).join("");
  const data = dataDaEdicao(ed);
  return `<p><b>${e(entry.name)}</b> — ${e(t("Jornal.EdicaoN", { n: ed.numero }))}${data ? ` — ${e(data)}` : ""}</p>
    <h1>${e(ed.titulo || t("Jornal.SemManchete"))}</h1>${ed.subtitulo ? `<p><em>${e(ed.subtitulo)}</em></p>` : ""}
    ${ed.imagem ? `<p><img src="${e(ed.imagem)}"></p>` : ""}${ed.editor ? `<p>${e(t("Jornal.Por", { nome: ed.editor }))}</p>` : ""}${ed.texto}${secoes}
    ${ed.rodape ? `<hr><p><small>${e(ed.rodape)}</small></p>` : ""}`;
}

/** Grava o conteúdo público de uma edição (nome, texto nativo e flags) numa só atualização. Só o mestre. */
export async function gravarEdicao(p, dados) {
  if (!game.user.isGM || !ehEdicao(p)) return null;
  const atual = lerEdicao(p);
  // o estado e as datas de publicação só mudam pela publicação (publicacao.js)
  const ed = normalizarEdicao({ ...dados, estado: atual.estado, publicadoEm: atual.publicadoEm, arquivadoEm: atual.arquivadoEm, avisado: atual.avisado });
  await p.update({ name: nomeDaPagina(ed), "text.content": htmlNativo(p.parent, ed), [`flags.${J.MOD}.edicao`]: ed });
  return ed;
}

/** Matérias publicadas ligadas a um documento (uuid do Diário ou de uma página dele), que o usuário pode ler. */
export function materiasLigadas(uuids, user = game.user) {
  const alvo = new Set(uuids);
  const r = [];
  for (const j of jornais(user)) for (const { p, ed } of edicoes(j, user)) {
    // jogador: só publicadas; mestre: todas (com o estado), para ver na hora que a ligação funcionou
    if (!user.isGM && !publicaEstado(ed.estado)) continue;
    for (const m of ed.materias) if (m.vinculos.some((u) => alvo.has(u))) r.push({ j, p, ed, m });
  }
  return r.sort((a, b) => ((b.ed.td ?? b.ed.publicadoEm ?? 0) - (a.ed.td ?? a.ed.publicadoEm ?? 0)));
}
