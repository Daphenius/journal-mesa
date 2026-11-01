/* Journal — painel "Linha do tempo" (aba especial __linha): o que já aconteceu (eventos, missões, sessões,
 * História, Nexus, jornais, histórico do calendário) e os próximos 30 dias. */
import { T } from "../idioma.js";
import * as Jornal from "../jornal/index.js";
import { Tempo, calApi, calNota, doCalendarioAtual, historicoCal, historicoCalVisivel, iconeSeguro, listaCal } from "../partes/calendario.js";
import { acontecimento, calNormalizar, calProximas, criarHistoria, ehHistoria, historias, paginasHistoria, registradosNaHistoria, registrarNaHistoria } from "../partes/historia.js";
import { Nexus } from "../partes/sessao.js";
import { MOD, STATUS, analisar, ehGM, esc, podeLer, podeVer } from "../nucleo.js";

/** Linha do tempo: o que já aconteceu (eventos, missões, sessões, histórico do calendário) e os próximos dias. */
async function linhaDoTempo(app, visiveis) {
  const gm = ehGM();
  if (!Tempo.ok()) return `<div class="jm-boas-vindas"><i class="fa-solid fa-timeline"></i><h2>${T("Janela.LinhaDoTempo")}</h2><p>${T("Janela.OCalendarioDoMundoNao")}</p></div>`;
  const hoje = Tempo.hoje();
  const itens = [];
  for (const j of visiveis) {
    const n = calNota(j) && doCalendarioAtual(j) ? calNormalizar(calNota(j)) : null;
    if (n && n.repetir === "nao" && n.td <= hoje) itens.push({ td: n.td, tipo: "evento", j, icone: n.icone, cor: n.cor, texto: "" });
    const a = analisar(j);
    if (a.tipo === "quest" && a.x.concluidaEm != null && podeLer(j)) itens.push({ td: Number(a.x.concluidaEm), tipo: "missao", j, icone: STATUS[a.m.status]?.icone ?? "fa-solid fa-scroll", texto: STATUS[a.m.status]?.rotulo ?? "" });
    const ses = j.flags?.[MOD]?.sessao;
    if (ses && Number.isFinite(Number(ses.tdFim))) itens.push({ td: Number(ses.tdFim), tipo: "sessao", j, icone: "fa-solid fa-book-bookmark", texto: `${T("Comum.Sessao")} ${ses.n}` });
  }
  const podeHist = gm || historicoCalVisivel();
  if (podeHist && calApi()) {
    for (const i of historicoCal()) if (i.td <= hoje) itens.push({ td: Number(i.td), tipo: "historico", texto: i.texto, icone: `fa-solid ${iconeSeguro(i.icone, "fa-circle")}` });
  }
  /* História: cada acontecimento com data entra aqui (os próximos vão para "Próximos 30 dias") */
  const futurosHist = [];
  for (const j of visiveis) {
    if (!ehHistoria(j)) continue;
    for (const p of paginasHistoria(j)) {
      const ac = acontecimento(p);
      if (ac.td == null) continue;
      const item = { td: ac.td, tipo: "historia", j, pagina: p.id, nome: p.name, icone: `fa-solid ${ac.icone}`, cor: ac.cor, texto: j.name };
      if (ac.td <= hoje) itens.push(item);
      else if (ac.td <= hoje + 30) futurosHist.push(item);
    }
  }
  /* Nexus: cada limiar cruzado (para baixo ou de volta para cima) fica no histórico do medidor */
  const nexusVisiveis = Nexus.ligado() ? Nexus.lista().filter((nx) => gm || (Nexus.jogadoresVeem() && nx.visivel)) : [];
  for (const nx of nexusVisiveis) {
    for (const h of nx.historico ?? []) {
      const td = Number(h.td);
      if (!Number.isFinite(td) || td > hoje) continue;
      const texto = h.subiu ? `${nx.nome} ${T("Comum.VoltouAcimaDe")} ${h.v}%` : `${nx.nome} ${T("Comum.CaiuAbaixoDe")} ${h.v}%`;
      itens.push({ td, tipo: "nexus", texto, extra: h.texto ?? "", origem: `nexus:${nx.id}:${h.id}`, icone: `fa-solid ${iconeSeguro(h.subiu ? "fa-arrow-trend-up" : nx.icone, "fa-gauge-high")}`, cor: nx.cor });
    }
  }
  /* Jornais: edições publicadas no dia delas (e as programadas, só para o mestre, nos próximos dias) */
  const doJornal = Jornal.naLinha() ? Jornal.itensLinha(hoje) : { passado: [], futuro: [] };
  itens.push(...doJornal.passado);
  const registrados = registradosNaHistoria();
  const temHistoria = historias().some((h) => podeVer(h));
  const filtros = [["tudo", T("Janela.Tudo")], ["historia", T("Comum.Historia")], ["evento", T("Comum.Eventos")], ["missao", T("Comum.Missoes")], ["sessao", T("Comum.Sessoes")], ...(doJornal.passado.length ? [["jornal", Jornal.t("Jornal.Jornais")]] : []), ...(nexusVisiveis.length ? [["nexus", T("Comum.Nexus")]] : []), ...(podeHist && calApi() ? [["historico", T("Comum.HistoricoDoCalendario2")]] : [])];
  const f = filtros.some(([k]) => k === app.filtroLinha) ? app.filtroLinha : "tudo";
  const lista = itens.filter((i) => f === "tudo" ? i.tipo !== "historico" || app.filtroLinha === "historico" : i.tipo === f);

  /* próximos 30 dias */
  const futuros = [];
  for (const j of visiveis) {
    if (!calNota(j) || !doCalendarioAtual(j)) continue;
    for (const td of calProximas(j, 3)) if (td >= hoje && td <= hoje + 30) futuros.push({ td, j, n: calNormalizar(calNota(j)) });
    const a = analisar(j);
    if (a.tipo === "quest" && a.x.prazo != null && !["completed", "failed"].includes(a.m.status) && podeLer(j)) {
      const td = Number(a.x.prazo);
      if (td >= hoje && td <= hoje + 30) futuros.push({ td, j, prazo: true });
    }
  }
  for (const i of futurosHist) futuros.push({ td: i.td, j: i.j, hist: i });
  for (const i of doJornal.futuro) futuros.push({ td: i.td, jornal: i });
  /* do Calendário: eventos das luas (eclipses, luas cheias juntas...) e contadores/prazos que terminam */
  for (const e of listaCal("proximosEventosLuas", 30)) {
    const td = Number(e.td);
    if (Number.isFinite(td) && td >= hoje && td <= hoje + 30) futuros.push({ td, ceu: { icone: iconeSeguro(e.icone, "fa-moon"), cor: /^#[0-9a-f]{3,8}$/i.test(e.cor ?? "") ? e.cor : "", texto: String(e.texto ?? "") } });
  }
  for (const c of listaCal("contadores")) {
    const td = Number(c.tdFim);
    if (!c.feito && Number.isFinite(td) && td >= hoje && td <= hoje + 30) futuros.push({ td, contador: String(c.nome ?? "") });
  }
  futuros.sort((a2, b2) => a2.td - b2.td);
  /* pena = registrar na História; marco = já está lá (abre o acontecimento) */
  const botaoHist = (i) => {
    if (i.tipo === "historia") return "";
    const origem = i.origem ?? (i.j ? i.j.uuid : `cal:${i.td}:${i.texto}`);
    const reg = registrados.get(origem);
    if (reg) return `<a class="jm-lt-hist feito" data-action="abrir" data-id="${reg.j}" data-pagina="${reg.p}" data-tooltip="${T("Janela.JaEstaNaHistoriaAbrir")}"><i class="fa-solid fa-landmark"></i></a>`;
    if (!gm) return "";
    return `<a class="jm-lt-hist" data-action="histRegistrar" data-td="${i.td}" data-origem="${esc(origem)}" data-tipo-item="${i.tipo}"
      data-nome="${esc(i.tipo === "jornal" ? i.nome : i.j ? i.j.name : i.texto)}" data-texto="${esc(i.tipo === "nexus" ? [i.texto, i.extra].filter(Boolean).join(": ") : i.texto ?? "")}" data-tooltip="${T("Comum.RegistrarNaHistoria")}"><i class="fa-solid fa-feather-pointed"></i></a>`;
  };
  const linhaItem = (i) => {
    if (i.tipo === "jornal") return `<li class="jm-lt-item jornal"><i class="${i.icone}" style="color:${esc(i.cor)}"></i><a data-action="jornal" data-op="ler" data-id="${i.j.id}" data-page="${i.pagina}"><b>${esc(i.nome)}</b></a> <small>${esc(i.texto)}</small>${botaoHist(i)}</li>`;
    if (i.tipo === "historia") return `<li class="jm-lt-item historia"><i class="${i.icone}" style="color:${esc(i.cor)}"></i><a data-action="abrir" data-id="${i.j.id}" data-pagina="${i.pagina}"><b>${esc(i.nome)}</b></a> <small><i class="fa-solid fa-landmark"></i> ${esc(i.texto)}</small></li>`;
    const nome = i.j ? `<a data-action="abrir" data-id="${i.j.id}"><b>${esc(i.j.name)}</b></a>` : esc(i.texto);
    return `<li class="jm-lt-item ${i.tipo}"><i class="${esc(i.icone?.startsWith("fa-solid") ? i.icone : `fa-solid ${i.icone ?? "fa-circle"}`)}" ${i.cor ? `style="color:${esc(i.cor)}"` : ""}></i>${nome}${i.j && i.texto ? ` <small>${esc(i.texto)}</small>` : ""}${i.extra ? ` <small>${esc(i.extra)}</small>` : ""}${botaoHist(i)}</li>`;
  };
  const porDia = new Map();
  for (const i of lista.sort((a2, b2) => b2.td - a2.td)) { if (!porDia.has(i.td)) porDia.set(i.td, []); porDia.get(i.td).push(i); }
  let anoLinha;
  const passado = [...porDia.entries()].map(([td, l]) => {
    const pt = Tempo.partes(td);
    const ano = pt.ano;
    const cab = ano !== anoLinha && (anoLinha !== undefined || ano !== Tempo.partes(hoje).ano) ? `<div class="jm-lt-ano">${T("Comum.Ano")} ${esc(pt.textoAno ?? ano)}${pt.era ? ` <small>${esc(pt.era)}</small>` : ""}</div>` : "";
    anoLinha = ano;
    return `${cab}<div class="jm-lt-dia" data-lt-td="${td}"><h4>${esc(Tempo.texto(td))} <small>${esc(Tempo.relativo(td))}</small>
      ${gm ? `<a class="jm-lt-hist" data-action="histRegistrar" data-td="${td}" data-tooltip="${T("Janela.RegistrarUmAcontecimentoNesteDia")}"><i class="fa-solid fa-plus"></i></a>` : ""}</h4>
      <ul>${l.map(linhaItem).join("")}</ul></div>`;
  }).join("");
  const proximos = futuros.map((x2) => `<li class="jm-lt-item" data-lt-td="${x2.td}"><span class="jm-lt-quando">${esc(Tempo.relativo(x2.td))}</span>
    ${x2.hist ? `<i class="${x2.hist.icone}" style="color:${esc(x2.hist.cor)}"></i> <a data-action="abrir" data-id="${x2.j.id}" data-pagina="${x2.hist.pagina}"><b>${esc(x2.hist.nome)}</b></a> <small><i class="fa-solid fa-landmark"></i> ${esc(x2.j.name)}</small>`
      : x2.prazo ? `<i class="fa-solid fa-hourglass-half"></i> <a data-action="abrir" data-id="${x2.j.id}"><b>${esc(x2.j.name)}</b></a> <small>${T("Janela.Prazo")}</small>`
      : x2.jornal ? `<i class="fa-solid fa-clock"></i> <a data-action="jornal" data-op="ver" data-id="${x2.jornal.j.id}" data-page="${x2.jornal.pagina}"><b>${esc(x2.jornal.nome)}</b></a> <small>${esc(x2.jornal.rotulo)}: ${esc(x2.jornal.texto)}</small>`
      : x2.ceu ? `<i class="fa-solid ${x2.ceu.icone}" ${x2.ceu.cor ? `style="color:${esc(x2.ceu.cor)}"` : ""}></i> <b>${esc(x2.ceu.texto)}</b> <small>${T("Janela.NoCeu")}</small>`
      : x2.contador != null ? `<i class="fa-solid fa-hourglass-end"></i> <b>${esc(x2.contador)}</b> <small>${T("Janela.ContadorDoCalendarioTermina")}</small>`
      : `<i class="fa-solid ${x2.n.icone}" style="color:${x2.n.cor}"></i> <a data-action="abrir" data-id="${x2.j.id}"><b>${esc(x2.j.name)}</b></a>`}
    <small>${esc(Tempo.texto(x2.td))}</small></li>`).join("");
  return `<article class="jm-pagina jm-linha-tempo">
    <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-timeline"></i> ${T("Janela.LinhaDoTempo")}</span>
      <h1 class="jm-titulo">${esc(Tempo.texto(hoje))}</h1></div>
      <div class="jm-cab-botoes">
        ${temHistoria || gm ? `<button type="button" data-action="histAbrir" data-tooltip="${temHistoria ? T("Janela.AbrirAHistoria") : T("Janela.CriarODiarioHistoria")}"><i class="fa-solid fa-landmark"></i></button>` : ""}
        ${gm ? `<button type="button" data-action="histRegistrar" data-tooltip="${T("Janela.RegistrarUmAcontecimentoNaHistoria")}"><i class="fa-solid fa-feather-pointed"></i></button>` : ""}
      </div></header>
    <section class="jm-secao"><h3><i class="fa-solid fa-forward"></i> ${T("Janela.Proximos30Dias")}</h3>${proximos ? `<ul class="jm-lt-lista">${proximos}</ul>` : `<p class="jm-vazio">${T("Janela.NadaMarcado")}</p>`}</section>
    <nav class="jm-subabas">${filtros.map(([k, r]) => `<button type="button" class="${f === k ? "ativo" : ""}" data-action="linhaFiltro" data-filtro="${k}">${r}</button>`).join("")}</nav>
    <section class="jm-secao"><h3><i class="fa-solid fa-clock-rotate-left"></i> ${T("Janela.OQueJaAconteceu")}</h3>${passado || `<p class="jm-vazio">${T("Janela.NadaPorAquiAinda")}</p>`}</section>
  </article>`;
}

export default {
  tipo: "__linha",

  html(entry, app, ctx) { return linhaDoTempo(app, ctx.visiveis); },

  acoes: {
    linhaFiltro(app, ev, el) { app.filtroLinha = el.dataset.filtro; app.render(); },

    async histRegistrar(app, ev, el) {
      const d = el.dataset;
      const td = d.td != null ? Number(d.td) : null;
      const origem = d.origem ?? "";
      let texto = d.texto ?? "";
      if (origem.startsWith("JournalEntry.")) {
        const nome = d.nome ?? "";
        const extra = { missao: texto ? `${T("Janela.Missao")}: ${texto}.` : T("Janela.Missao2"), sessao: `${texto}.`, evento: T("Janela.EventoDoCalendario"), jornal: `${T("Janela.Manchete")}: ${texto}.` }[d.tipoItem] ?? "";
        texto = `@UUID[${origem}]{${nome}} — ${extra}\n`;
      } else if (origem.startsWith("cal:") || origem.startsWith("nexus:")) texto = `${texto}\n`;
      await registrarNaHistoria({ td, nome: d.nome ?? "", texto, origem, icone: { missao: "fa-scroll", sessao: "fa-book-bookmark", evento: "fa-star", nexus: "fa-triangle-exclamation", jornal: "fa-scroll" }[d.tipoItem] ?? "fa-landmark" });
    },

    async histAbrir(app) {
      const lista = historias().filter((h) => podeVer(h));
      if (lista.length) return app.abrirPagina(lista[0].id);
      if (!ehGM()) return;
      const h = await criarHistoria(app.pastaDestino);
      app.abrirPagina(h.id);
    }
  }
};
