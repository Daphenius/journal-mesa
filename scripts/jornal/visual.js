/* Jornal de Notícias — o que aparece dentro do Journal: a página da publicação, a aba
 * "Jornais e Notícias", "Notícias relacionadas" e os itens da Linha do tempo.
 * A folha impressa (as páginas da edição) vem de leitura.js, a mesma da janela de leitura. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import {
  ESTILOS, ESTADOS, identidade, jornais, edicoes, dataDaEdicao, publicaEstado, materiasLigadas,
  rotEstilo, rotEstado, rotSecaoUm, htmlSeguro, docDe
} from "./dados.js";
import { segredosDe } from "./redacao.js";
import { paginasEdicao } from "./leitura.js";

const e = (s) => J.esc(s);

/** Todas as páginas da edição, uma embaixo da outra (mestre: com a veracidade, salvo "ver como jogador"). */
export async function folhaHTML(entry, p, { mestre = false } = {}) {
  return `<div class="jl-no-journal">${(await paginasEdicao(entry, p, { mestre })).join("")}</div>`;
}

const seloEstado = (est) => `<span class="jmj-estado est-${est}"><i class="${ESTADOS[est].icone}"></i> ${e(rotEstado(est))}</span>`;

function textoProgramada(ed) {
  if (ed.estado !== "programado" || ed.publicarEm == null) return "";
  const quando = J.Tempo.ok() ? `${J.Tempo.texto(ed.publicarEm)} (${J.Tempo.relativo(ed.publicarEm)})` : String(ed.publicarEm);
  return e(t(ed.auto ? "Jornal.ProgramadaAuto" : "Jornal.ProgramadaAviso", { quando }));
}

/** Botões do mestre para uma edição, conforme o estado. */
function botoesEdicao(p, ed) {
  const b = (op, icone, rotulo, dica = rotulo, cls = "") => `<button type="button" class="${cls}" data-action="jornal" data-op="${op}" data-id="${p.parent.id}" data-page="${p.id}" data-tooltip="${e(dica)}"><i class="${icone}"></i>${rotulo ? ` ${e(rotulo)}` : ""}</button>`;
  const l = [b("ler", "fa-solid fa-book-open-reader", t("Jornal.Ler"), t("Jornal.LerDica")), b("editarEdicao", "fa-solid fa-pen", t("Jornal.Editar"))];
  if (ed.estado === "rascunho") l.push(b("publicar", "fa-solid fa-newspaper", t("Jornal.Publicar")), b("programar", "fa-solid fa-clock", t("Jornal.Programar"), t("Jornal.ProgramarDica")));
  if (ed.estado === "programado") l.push(b("publicar", "fa-solid fa-newspaper", t("Jornal.PublicarAgora")), b("programar", "fa-solid fa-clock", t("Jornal.MudarData")), b("rascunho", "fa-solid fa-rotate-left", t("Jornal.Estado.rascunho"), t("Jornal.VoltarRascunho"), "sec"));
  if (ed.estado === "publicado") l.push(b("apresentar", "fa-solid fa-bullhorn", t("Jornal.Apresentar"), t("Jornal.ApresentarDica")), b("arquivar", "fa-solid fa-box-archive", t("Jornal.Arquivar"), t("Jornal.ArquivarDica"), "sec"), b("rascunho", "fa-solid fa-eye-slash", t("Jornal.Despublicar"), t("Jornal.DespublicarDica"), "sec"));
  if (ed.estado === "arquivado") l.push(b("apresentar", "fa-solid fa-bullhorn", t("Jornal.Apresentar")), b("desarquivar", "fa-solid fa-box-open", t("Jornal.Desarquivar"), t("Jornal.Desarquivar"), "sec"));
  l.push(b("novaAPartir", "fa-solid fa-clone", "", t("Jornal.Json.NovaAPartirDica"), "sec"), b("exportar", "fa-solid fa-file-export", "", t("Jornal.Json.ExportarDica"), "sec"));
  l.push(b("apagarEdicao", "fa-solid fa-trash", "", t("Jornal.ApagarDica"), "sec jm-lixeira"));
  return l.join("");
}

/** Edição que a página da publicação mostra: a pedida por link, a escolhida antes ou a mais nova. */
function edicaoEscolhida(app, entry, lista) {
  app.jornalSel ??= new Map();
  const pedida = app._rolarPara?.pagina;
  if (pedida && lista.some((x) => x.p.id === pedida)) { app.jornalSel.set(entry.id, pedida); app._rolarPara = null; }
  const atual = app.jornalSel.get(entry.id);
  const achada = lista.find((x) => x.p.id === atual);
  if (achada) return achada;
  const melhor = lista.find((x) => publicaEstado(x.ed.estado)) ?? lista[0] ?? null;
  if (melhor) app.jornalSel.set(entry.id, melhor.p.id);
  return melhor;
}

/** Corpo da página de uma publicação (abaixo do cabeçalho padrão do Journal). */
export async function corpoJornal(app, entry, secao) {
  const gm = game.user.isGM;
  const id = identidade(entry);
  const lista = edicoes(entry);
  const blocos = [];
  let org = "";
  if (id.organizacao) {
    const d = docDe(id.organizacao);
    if (d && (gm || d.testUserPermission?.(game.user, "LIMITED"))) org = `<a class="jmj-vinc" data-action="abrir" data-id="${d.id}"><i class="fa-solid fa-people-group"></i> ${e(d.name)}</a>`;
  }
  if (!org && id.orgTexto) org = `<span class="jmj-vinc"><i class="fa-solid fa-people-group"></i> ${e(id.orgTexto)}</span>`;
  const info = [id.regiao ? `<span class="jm-detalhe"><small>${e(t("Jornal.CirculaEm"))}</small>${e(id.regiao)}</span>` : "", org ? `<span class="jm-detalhe"><small>${e(t("Jornal.Responsavel"))}</small>${org}</span>` : "",
    `<span class="jm-detalhe"><small>${e(t("Jornal.EstiloVisual"))}</small><i class="${ESTILOS[id.estilo].icone}"></i> ${e(rotEstilo(id.estilo))}</span>`].join("");
  const descr = id.descricao ? `<div class="jm-texto">${await J.TE().enrichHTML(htmlSeguro(J.textoParaHtml(id.descricao)), { secrets: gm, relativeTo: entry })}</div>` : "";
  blocos.push(secao(e(t("Jornal.SobrePublicacao")), "fa-solid fa-newspaper", `<div class="jm-sub-linha">${info}</div>${descr}`, "jmj-sobre", "", gm ? `<a class="jm-mini-btn" data-action="jornal" data-op="identidade" data-id="${entry.id}" data-tooltip="${e(t("Jornal.EditarIdentidade"))}"><i class="fa-solid fa-pen"></i></a>` : ""));

  const publicadas = lista.filter((x) => publicaEstado(x.ed.estado)).length;
  blocos.push(`<div class="jm-hist-barra jmj-barra">
    ${gm ? `<button type="button" data-action="jornal" data-op="novaEdicao" data-id="${entry.id}"><i class="fa-solid fa-plus"></i> ${e(t("Jornal.NovaEdicao"))}</button>
      <button type="button" class="sec" data-action="jornal" data-op="importar" data-id="${entry.id}" data-tooltip="${e(t("Jornal.Json.ImportarDica"))}"><i class="fa-solid fa-file-import"></i> ${e(t("Jornal.Json.ImportarEdicoes"))}</button>` : ""}
    <button type="button" class="sec" data-action="abrirEspecial" data-id="__jornais"><i class="fa-solid fa-layer-group"></i> ${e(t("Jornal.TodosJornais"))}</button>
    <span class="jm-hist-conta">${e(t("Jornal.ContaPublicadas", { n: publicadas }))}</span>
  </div>`);

  if (!lista.length) {
    blocos.push(`<p class="jm-vazio jm-centro">${e(t(gm ? "Jornal.NenhumaEdicaoGM" : "Jornal.NenhumaEdicao"))}</p>`);
    return blocos.join("");
  }
  const sel = edicaoEscolhida(app, entry, lista);
  const linha = ({ p, ed }) => `<a class="jmj-ed-item ${p.id === sel?.p.id ? "ativo" : ""}" data-action="jornal" data-op="ver" data-id="${entry.id}" data-page="${p.id}">
      <b>${e(t("Jornal.NumeroCurto", { n: ed.numero }))}</b><span>${e(ed.titulo || t("Jornal.SemManchete"))}</span><small>${e(dataDaEdicao(ed))}</small>${gm ? seloEstado(ed.estado) : ""}</a>`;
  const ativas = lista.filter((x) => x.ed.estado !== "arquivado");
  const arq = lista.filter((x) => x.ed.estado === "arquivado");
  blocos.push(`<nav class="jmj-edicoes">${ativas.map(linha).join("")}
    ${arq.length ? `<details class="jmj-arquivo" ${sel && sel.ed.estado === "arquivado" ? "open" : ""}><summary><i class="fa-solid fa-box-archive"></i> ${e(t("Jornal.Arquivo", { n: arq.length }))}</summary>${arq.map(linha).join("")}</details>` : ""}</nav>`);

  if (sel) {
    if (gm) {
      const prog = textoProgramada(sel.ed);
      const nota = segredosDe(sel.p.id).nota;
      blocos.push(`<div class="jmj-controle">${seloEstado(sel.ed.estado)}${prog ? `<span class="jm-dica">${prog}</span>` : ""}
        ${nota ? `<span class="jl-verdade" data-tooltip="${e(nota)}"><i class="fa-solid fa-note-sticky"></i> ${e(t("Jornal.NotaDoMestre"))}</span>` : ""}
        <span class="jmj-controle-btns">${botoesEdicao(sel.p, sel.ed)}</span></div>`);
    } else {
      blocos.push(`<div class="jmj-controle"><span class="jm-dica">${e(t("Jornal.LerConvite"))}</span><span class="jmj-controle-btns">
        <button type="button" data-action="jornal" data-op="ler" data-id="${entry.id}" data-page="${sel.p.id}"><i class="fa-solid fa-book-open-reader"></i> ${e(t("Jornal.Ler"))}</button></span></div>`);
    }
    blocos.push(await folhaHTML(entry, sel.p, { mestre: gm }));
  }
  return blocos.join("");
}

/** Aba "Jornais e Notícias". */
export async function painelJornais(app) {
  const gm = game.user.isGM;
  const filtros = gm ? ["tudo", "publicado", "programado", "rascunho", "arquivado"] : ["tudo", "publicado", "arquivado"];
  if (!filtros.includes(app.jornaisFiltro)) app.jornaisFiltro = "tudo";
  const f = app.jornaisFiltro;
  const lista = jornais();
  const programadas = [];
  const cards = lista.map((j) => {
    const id = identidade(j);
    const eds = edicoes(j);
    const conta = (est) => eds.filter((x) => x.ed.estado === est).length;
    const ultima = eds.find((x) => x.ed.estado === "publicado") ?? eds.find((x) => x.ed.estado === "arquivado");
    for (const x of eds) if (x.ed.estado === "programado") programadas.push({ j, ...x });
    const mostrar = eds.filter((x) => f === "tudo" ? (gm || publicaEstado(x.ed.estado)) : x.ed.estado === f).slice(0, 8);
    const busca = `${j.name} ${id.subtitulo} ${id.regiao} ${eds.map((x) => `${x.ed.titulo} ${x.ed.materias.map((m) => m.titulo).join(" ")}`).join(" ")}`.toLowerCase();
    if (f !== "tudo" && !mostrar.length) return "";
    const ver = (p, op = publicaEstado(eds.find((x) => x.p === p)?.ed.estado) ? "ler" : "ver") => `data-action="jornal" data-op="${op}" data-id="${j.id}" data-page="${p.id}"`;
    return `<div class="jmj-card estilo-${id.estilo}" style="--jmj-cor:${e(id.cor)}" data-jornal-busca-item="${e(busca)}">
      <div class="jmj-card-topo">
        ${id.logo ? `<img class="jmj-card-logo" src="${e(id.logo)}" alt="">` : `<div class="jmj-card-logo icone"><i class="${ESTILOS[id.estilo].icone}"></i></div>`}
        <div class="jmj-card-txt"><a data-action="abrir" data-id="${j.id}"><b>${e(j.name)}</b></a>${id.subtitulo ? `<small>${e(id.subtitulo)}</small>` : ""}
          <div class="jmj-card-info">${id.regiao ? `<span><i class="fa-solid fa-location-dot"></i> ${e(id.regiao)}</span>` : ""}<span><i class="${ESTILOS[id.estilo].icone}"></i> ${e(rotEstilo(id.estilo))}</span></div></div>
        ${gm ? `<div class="jmj-card-btns"><a class="jm-mini-btn" data-action="jornal" data-op="novaEdicao" data-id="${j.id}" data-tooltip="${e(t("Jornal.NovaEdicao"))}"><i class="fa-solid fa-plus"></i></a>
          <a class="jm-mini-btn" data-action="jornal" data-op="importar" data-id="${j.id}" data-tooltip="${e(t("Jornal.Json.ImportarEdicoes"))}"><i class="fa-solid fa-file-import"></i></a>
          <a class="jm-mini-btn" data-action="jornal" data-op="identidade" data-id="${j.id}" data-tooltip="${e(t("Jornal.EditarIdentidade"))}"><i class="fa-solid fa-pen"></i></a></div>` : ""}
      </div>
      <div class="jmj-card-numeros">
        <span>${e(t("Jornal.ContaPublicadas", { n: conta("publicado") + conta("arquivado") }))}</span>
        ${gm ? `<span>${e(t("Jornal.ContaProgramadas", { n: conta("programado") }))}</span><span>${e(t("Jornal.ContaRascunhos", { n: conta("rascunho") }))}</span>` : ""}
        ${ultima ? `<span>${e(t("Jornal.Ultima"))} <a ${ver(ultima.p, "ler")}>${e(t("Jornal.NumeroCurto", { n: ultima.ed.numero }))}${dataDaEdicao(ultima.ed) ? ` · ${e(dataDaEdicao(ultima.ed))}` : ""}</a></span>` : ""}
      </div>
      ${mostrar.length ? `<ul class="jmj-card-eds">${mostrar.map(({ p, ed }) => `<li><a ${ver(p)}><b>${e(t("Jornal.NumeroCurto", { n: ed.numero }))}</b> ${e(ed.titulo || t("Jornal.SemManchete"))}</a> <small>${e(dataDaEdicao(ed))}</small>${gm ? seloEstado(ed.estado) : ""}</li>`).join("")}</ul>` : ""}
    </div>`;
  }).filter(Boolean).join("");
  programadas.sort((a, b) => (a.ed.publicarEm ?? 0) - (b.ed.publicarEm ?? 0));
  const proximas = gm && programadas.length ? `<section class="jm-secao"><h3><i class="fa-solid fa-clock"></i> ${e(t("Jornal.ProximasPublicacoes"))}</h3><ul class="jm-lt-lista">${programadas.map(({ j, p, ed }) =>
    `<li class="jm-lt-item"><a data-action="jornal" data-op="ver" data-id="${j.id}" data-page="${p.id}"><b>${e(j.name)}</b> ${e(t("Jornal.NumeroCurto", { n: ed.numero }))}: ${e(ed.titulo || t("Jornal.SemManchete"))}</a> <small>${textoProgramada(ed)}</small></li>`).join("")}</ul></section>` : "";
  return `<article class="jm-pagina jmj-painel">
    <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-newspaper"></i> ${e(t("Jornal.Imprensa"))}</span><h1 class="jm-titulo">${e(t("Jornal.Titulo"))}</h1></div>
      ${gm ? `<div class="jm-cab-botoes"><button type="button" data-action="jornal" data-op="criarJornal" data-tooltip="${e(t("Jornal.CriarJornal"))}"><i class="fa-solid fa-plus"></i></button>
        <button type="button" data-action="jornal" data-op="novaEdicao" data-tooltip="${e(t("Jornal.NovaEdicaoEscolher"))}"><i class="fa-solid fa-file-circle-plus"></i></button></div>` : ""}</header>
    <div class="jmj-filtros"><div class="jm-con-busca"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-jornal-busca placeholder="${e(t("Jornal.BuscarDica"))}" value="${e(app.jornaisBusca ?? "")}"></div>
      <nav class="jm-subabas">${filtros.map((k) => `<button type="button" class="${f === k ? "ativo" : ""}" data-action="jornal" data-op="filtro" data-filtro="${k}">${e(t(`Jornal.Filtro.${k}`))}</button>`).join("")}</nav></div>
    ${proximas}
    <div class="jmj-cards">${cards || `<p class="jm-vazio jm-centro">${e(t(gm ? (lista.length ? "Jornal.NadaFiltro" : "Jornal.NenhumJornalGM") : "Jornal.NenhumJornal"))}</p>`}</div>
    <p class="jm-vazio jm-centro jmj-nada-busca" hidden>${e(t("Jornal.NadaEncontrado"))}</p>
  </article>`;
}

/** "Notícias relacionadas" numa página do Journal (NPC, local, organização, missão...). */
export function secaoRelacionadas(entry, secao) {
  const uuids = [entry.uuid, ...entry.pages.contents.map((p) => p.uuid)];
  const l = materiasLigadas(uuids);
  if (!l.length) return "";
  const gm = game.user.isGM;
  const corpo = `<ul class="jmj-relacionadas">${l.slice(0, 20).map(({ j, p, ed, m }) => `<li>
      <a data-action="jornal" data-op="${publicaEstado(ed.estado) ? "ler" : "ver"}" data-id="${j.id}" data-page="${p.id}"><b>${e(m.titulo || rotSecaoUm(m.secao))}</b></a>${gm && !publicaEstado(ed.estado) ? ` ${seloEstado(ed.estado)}` : ""}
      <small>${e(j.name)} · ${e(t("Jornal.NumeroCurto", { n: ed.numero }))}${dataDaEdicao(ed) ? ` · ${e(dataDaEdicao(ed))}` : ""}${m.secao !== "noticia" ? ` · ${e(rotSecaoUm(m.secao))}` : ""}</small></li>`).join("")}</ul>
    ${l.length > 20 ? `<p class="jm-dica">${e(t("Jornal.EMais", { n: l.length - 20 }))}</p>` : ""}`;
  return secao(e(t("Jornal.NoticiasRelacionadas")), "fa-solid fa-newspaper", corpo, "jmj-sec-relacionadas");
}

/** Itens da Linha do tempo: edições publicadas (passado) e, para o mestre, as programadas (próximos dias). */
export function itensLinha(hoje) {
  const passado = [], futuro = [];
  for (const j of jornais()) {
    const id = identidade(j);
    for (const { p, ed } of edicoes(j)) {
      const nome = `${j.name} · ${t("Jornal.NumeroCurto", { n: ed.numero })}`;
      if (publicaEstado(ed.estado)) {
        const td = ed.td ?? ed.publicadoEm;
        if (td != null && td <= hoje) passado.push({ td, tipo: "jornal", j, pagina: p.id, origem: p.uuid, nome, texto: ed.titulo || t("Jornal.NovaEdicao"), icone: "fa-solid fa-newspaper", cor: id.cor });
      } else if (game.user.isGM && ed.estado === "programado" && ed.publicarEm != null && ed.publicarEm >= hoje && ed.publicarEm <= hoje + 30) {
        futuro.push({ td: ed.publicarEm, j, pagina: p.id, nome, texto: ed.titulo || t("Jornal.SemManchete"), rotulo: t("Jornal.EdicaoProgramada") });
      }
    }
  }
  return { passado, futuro };
}
