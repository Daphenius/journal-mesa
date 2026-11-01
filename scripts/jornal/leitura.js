/* Jornal de Notícias — páginas de leitura (a "folha impressa").
 * Um só desenhista para a janela de leitura (leitor.js) e para a página do jornal no Journal.
 * Página 1, como um jornal: cabeçalho, faixa da edição, manchete com imagem, coluna de destaques,
 * e embaixo "Outras notícias", "Rumores" e "Anúncios e avisos". O que não cabe nessas caixas segue para
 * as páginas seguintes (continuação), em colunas. As páginas têm altura livre: texto longo nunca é cortado. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { ESTILOS, VERACIDADE, identidade, lerEdicao, normalizarEdicao, dataDaEdicao, rotVerdade, rotSecao, docDe } from "./dados.js";
import { segredosDe } from "./redacao.js";

import { esc as e } from "../nucleo.js";
/* quantos itens cabem em cada caixa da primeira página */
const CAIXAS = { destaques: 2, outras: 2, rumores: 4, anuncios: 4 };
const POR_PAGINA = 8;
const ICONES_RUMOR = ["fa-skull", "fa-moon", "fa-khanda", "fa-eye", "fa-mask", "fa-feather"];
const ICONES_ANUNCIO = ["fa-shield-halved", "fa-beer-mug-empty", "fa-leaf", "fa-coins", "fa-scroll", "fa-key"];

/** Ligações que o leitor pode abrir (o que ele não pode ver não aparece). */
export function vinculosVisiveis(uuids, user = game.user) {
  const r = [];
  for (const u of uuids ?? []) {
    const doc = docDe(u);
    if (!doc) continue;
    const dono = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
    if (!user.isGM && !dono?.testUserPermission?.(user, "LIMITED")) continue;
    r.push({ doc, dono });
  }
  return r;
}
/** Imagem de um documento ligado: a do NPC/local/organização no Journal, a do ator ou do item. */
const SEM_FOTO = /icons\/svg\/(mystery-man|item-bag|book|cowled)\.svg$/;
export function imagemDe(doc) {
  if (!doc) return "";
  let src = "";
  if (doc.documentName === "JournalEntry") { const a = J.analisar(doc); src = a.page?.src || a.pages.find((p) => p.type === "image")?.src || ""; }
  else if (doc.documentName === "JournalEntryPage") src = doc.src || imagemDe(doc.parent);
  else src = doc.img || "";
  return src && !SEM_FOTO.test(src) ? src : "";
}
/** Vínculo que entra com foto sozinho: NPC, local, organização, divindade, loja ou ator com imagem. */
export function fotoAutomatica(uuid) {
  const doc = docDe(uuid);
  if (!doc || !imagemDe(doc)) return false;
  const dono = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
  return dono.documentName === "Actor" || (dono.documentName === "JournalEntry" && ["person", "place", "organization", "deus", "shop"].includes(J.analisar(dono).tipo));
}
/** Legenda curta do retrato: o tipo e o detalhe principal (papel do NPC, tipo do local...). */
function legendaDe(doc) {
  const dono = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
  if (dono.documentName === "JournalEntry") {
    const a = J.analisar(dono);
    return [a.m?.role || a.m?.placetype || a.m?.shoptype || "", J.TIPOS[a.tipo]?.rotulo ?? ""].find(Boolean) ?? "";
  }
  return "";
}
/** Retratos (foto + nome) dos vínculos marcados com foto que o leitor pode ver. */
function retratos(m, classe = "") {
  const fotos = new Set(m.fotos ?? []);
  const l = vinculosVisiveis([...fotos]).map(({ doc }) => ({ doc, img: imagemDe(doc) })).filter((x) => x.img);
  if (!l.length) return "";
  return `<div class="jl-retratos ${classe}">${l.map(({ doc, img }) => `<figure class="jl-retrato" data-jornal-vinculo="${e(doc.uuid)}" data-tooltip="${e(t("Jornal.AbrirVinculo"))}">
    <img src="${e(img)}" alt=""><figcaption><b>${e(doc.name)}</b>${legendaDe(doc) ? `<small>${e(legendaDe(doc))}</small>` : ""}</figcaption></figure>`).join("")}</div>`;
}
/** Chips dos vínculos sem foto (os com foto já aparecem como retrato). */
const chipsDe = (m) => chips((m.vinculos ?? []).filter((u) => !(m.fotos ?? []).includes(u) || !imagemDe(docDe(u))));

function chips(uuids) {
  const l = vinculosVisiveis(uuids);
  if (!l.length) return "";
  return `<div class="jl-vincs">${l.map(({ doc, dono }) => {
    if (dono.documentName === "JournalEntry") {
      const a = J.analisar(dono);
      return `<a class="jl-vinc" data-jornal-vinculo="${e(doc.uuid)}"><i class="${J.TIPOS[a.tipo]?.icone ?? "fa-solid fa-book"}"></i> ${e(doc.name)}</a>`;
    }
    return `<a class="jl-vinc" data-jornal-vinculo="${e(doc.uuid)}"><i class="fa-solid ${doc.documentName === "Actor" ? "fa-user" : "fa-box"}"></i> ${e(doc.name)}</a>`;
  }).join("")}</div>`;
}

/** Monta as páginas de uma edição. mestre=true mostra a veracidade (só no Journal, nunca no leitor). */
export async function paginasEdicao(entry, p, { mestre = false, dados = null, segredos = null } = {}) {
  // dados: a cópia do editor (prévia do que ainda não foi salvo)
  const ed = dados ? normalizarEdicao(dados) : lerEdicao(p);
  const id = identidade(entry);
  const est = ESTILOS[id.estilo] ? id.estilo : "medieval";
  const seg = mestre ? (segredos ?? segredosDe(p.id)) : { materias: {}, nota: "" };
  const enr = async (h) => (h ? await J.TE().enrichHTML(h, { secrets: mestre, relativeTo: p }) : "");
  const marca = (m) => {
    const s = seg.materias[m.id];
    if (!mestre || (!s?.verdade && !s?.nota)) return "";
    const v = VERACIDADE[s.verdade] ?? VERACIDADE[""];
    return `<span class="jl-verdade" style="${v.cor ? `--jl-v:${v.cor}` : ""}" data-tooltip="${e(t("Jornal.SoVoceVe") + (s.nota ? `: ${s.nota}` : ""))}"><i class="fa-solid fa-user-secret"></i> ${e(s.verdade ? rotVerdade(s.verdade) : t("Jornal.NotaDoMestre"))}</span>`;
  };
  const data = dataDaEdicao(ed);

  const noticias = ed.materias.filter((m) => m.secao === "noticia");
  const rumores = ed.materias.filter((m) => m.secao === "rumor");
  const anuncios = ed.materias.filter((m) => m.secao === "aviso" || m.secao === "classificado");
  const destaques = noticias.slice(0, CAIXAS.destaques);
  const outras = noticias.slice(CAIXAS.destaques, CAIXAS.destaques + CAIXAS.outras);
  const rumores1 = rumores.slice(0, CAIXAS.rumores);
  const anuncios1 = anuncios.slice(0, CAIXAS.anuncios);
  const resto = [
    ...noticias.slice(CAIXAS.destaques + CAIXAS.outras),
    ...rumores.slice(CAIXAS.rumores),
    ...anuncios.slice(CAIXAS.anuncios)
  ];

  const destaque = async (m) => `<article class="jl-destaque" data-materia="${m.id}">
      ${m.categoria ? `<div class="jl-chapeu">${e(m.categoria)}</div>` : ""}
      <h3>${e(m.titulo)}</h3>${marca(m)}
      ${m.imagem ? `<img class="jl-img" src="${e(m.imagem)}" alt="">` : ""}
      ${m.autor ? `<div class="jl-autor">${e(m.autor)}</div>` : ""}
      ${retratos(m)}<div class="jl-texto">${await enr(m.texto)}</div>${chipsDe(m)}</article>`;
  const outra = async (m) => `<article class="jl-outra ${m.imagem ? "com-img" : ""}" data-materia="${m.id}">
      ${m.imagem ? `<img class="jl-miniatura" src="${e(m.imagem)}" alt="">` : ""}
      <div><h4>${e(m.titulo)}</h4>${marca(m)}${m.autor ? `<div class="jl-autor">${e(m.autor)}</div>` : ""}
      ${retratos(m, "pequenos")}<div class="jl-texto">${await enr(m.texto)}</div>${chipsDe(m)}</div></article>`;
  const rumor = async (m, i) => `<article class="jl-rumor" data-materia="${m.id}"><i class="fa-solid ${ICONES_RUMOR[i % ICONES_RUMOR.length]}"></i>
      <div><h5>${e(m.titulo)}</h5>${marca(m)}${retratos(m, "pequenos")}<div class="jl-texto">${await enr(m.texto)}</div>${chipsDe(m)}</div></article>`;
  const anuncio = async (m, i) => `<article class="jl-anuncio ${m.secao === "aviso" ? "aviso" : ""}" data-materia="${m.id}">
      <div><h5>${e(m.titulo)}</h5>${m.categoria ? `<div class="jl-chapeu">${e(m.categoria)}</div>` : ""}${marca(m)}
      ${retratos(m, "pequenos")}<div class="jl-texto">${await enr(m.texto)}</div>${chipsDe(m)}</div>
      ${m.imagem ? `<img class="jl-miniatura" src="${e(m.imagem)}" alt="">` : `<i class="fa-solid ${m.secao === "aviso" ? "fa-bullhorn" : ICONES_ANUNCIO[i % ICONES_ANUNCIO.length]}"></i>`}</article>`;
  const caixa = (titulo, icone, itens) => (itens ? `<section class="jl-caixa"><h4 class="jl-caixa-titulo"><i class="fa-solid ${icone}"></i> ${e(titulo)}</h4>${itens}</section>` : "");
  const seq = async (l, f) => (await Promise.all(l.map((m, i) => f(m, i)))).join("");

  const cabecalho = `<header class="jl-cabeca">
      <div class="jl-ornamento"><i class="fa-solid fa-compass"></i></div>
      <div class="jl-nome-bloco">
        ${id.logo ? `<img class="jl-logo" src="${e(id.logo)}" alt="">` : ""}
        <div class="jl-nome">${e(entry.name)}</div>
        ${id.subtitulo || id.lema ? `<div class="jl-subtitulo">${e(id.subtitulo || id.lema)}</div>` : ""}
      </div>
      <div class="jl-ornamento"><i class="fa-solid fa-chess-rook"></i></div>
    </header>
    <div class="jl-faixa"><span>${e(t("Jornal.EdicaoN", { n: ed.numero }))}</span><span>${id.regiao ? `${e(id.regiao)} <i class="fa-solid fa-feather-pointed"></i>` : `<i class="fa-solid fa-feather-pointed"></i>`}</span><span>${e(data)}</span></div>`;

  const manchete = `<section class="jl-manchete">
      <h1 class="jl-titulo">${e(ed.titulo || t("Jornal.SemManchete"))}</h1>
      ${ed.subtitulo ? `<p class="jl-sub">${e(ed.subtitulo)}</p>` : ""}
      <div class="jl-manchete-corpo ${ed.imagem ? "com-img" : ""}">
        <div class="jl-texto jl-capitular">${ed.editor ? `<div class="jl-autor">${e(t("Jornal.Por", { nome: ed.editor }))}</div>` : ""}${await enr(ed.texto)}</div>
        ${ed.imagem ? `<figure class="jl-figura"><img src="${e(ed.imagem)}" alt="">${ed.subtitulo ? "" : ""}</figure>` : ""}
      </div>
    </section>`;

  const lateral = destaques.length ? `<aside class="jl-lateral">${await seq(destaques, destaque)}</aside>` : "";
  const base = [
    caixa(t("Jornal.OutrasNoticias"), "fa-newspaper", await seq(outras, outra)),
    caixa(t("Jornal.Secao.rumor"), "fa-ear-listen", await seq(rumores1, rumor)),
    caixa(t("Jornal.AnunciosAvisos"), "fa-scroll", await seq(anuncios1, anuncio))
  ].filter(Boolean);
  const total = 1 + Math.ceil(resto.length / POR_PAGINA);
  const numero = (n) => `<div class="jl-num-pagina">${e(t("Jornal.PaginaDe", { n, total }))}</div>`;
  const rodape = ed.rodape ? `<footer class="jl-rodape">${e(ed.rodape)}</footer>` : "";

  const lang = e(game.i18n.lang);   // hifenização certa no texto justificado
  const paginas = [`<div class="jl-folha estilo-${est}" lang="${lang}" style="--jl-cor:${e(id.cor)}" data-jl-pagina="1">
    ${cabecalho}
    <div class="jl-topo ${lateral ? "" : "sem-lateral"}">${manchete}${lateral}</div>
    ${base.length ? `<div class="jl-base" style="--jl-n:${base.length}">${base.join("")}</div>` : ""}
    ${total === 1 ? rodape : ""}${total > 1 ? numero(1) : ""}
  </div>`];

  // continuação: o que sobrou, em colunas, por seção
  for (let i = 0; i < resto.length; i += POR_PAGINA) {
    const parte = resto.slice(i, i + POR_PAGINA);
    const n = paginas.length + 1;
    const blocos = [];
    for (const k of ["noticia", "rumor", "aviso", "classificado"]) {
      const l = parte.filter((m) => m.secao === k);
      if (!l.length) continue;
      const f = k === "noticia" ? destaque : k === "rumor" ? rumor : anuncio;
      blocos.push(`<section class="jl-cont-secao"><h4 class="jl-caixa-titulo">${e(rotSecao(k))}</h4><div class="jl-colunas">${await seq(l, f)}</div></section>`);
    }
    paginas.push(`<div class="jl-folha estilo-${est} continuacao" lang="${lang}" style="--jl-cor:${e(id.cor)}" data-jl-pagina="${n}">
      <div class="jl-cabeca-mini"><span class="jl-nome">${e(entry.name)}</span><span>${e(t("Jornal.EdicaoN", { n: ed.numero }))}${data ? ` · ${e(data)}` : ""}</span></div>
      ${blocos.join("")}
      ${n === total ? rodape : ""}${numero(n)}
    </div>`);
  }
  return paginas;
}

/** Ouvintes das ligações dentro das páginas (abrem o documento, se o leitor puder). */
export function ouvirVinculos(root) {
  root.querySelectorAll("[data-jornal-vinculo]").forEach((a) => a.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    abrirVinculo(a.dataset.jornalVinculo);
  }));
}
export function abrirVinculo(uuid) {
  const doc = docDe(uuid);
  if (!doc) return ui.notifications.warn(t("Jornal.VinculoSumiu"));
  const dono = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
  if (!game.user.isGM && !dono.testUserPermission(game.user, "LIMITED")) return ui.notifications.warn(t("Jornal.SemAcesso"));
  if (dono.documentName === "JournalEntry") {
    const app = J.abrirJournal();
    return app.abrirPagina(dono.id, doc !== dono ? { pagina: doc.id } : {});
  }
  return doc.sheet?.render(true);
}
