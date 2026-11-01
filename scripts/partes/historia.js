/* Journal — História: diário de acontecimentos com data, ligado à Linha do tempo.
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T, TF } from "../idioma.js";
import { CAL, CAL_ANTIGOS, CAL_AVISOS, CAL_FIM, CAL_ICONES, CAL_MODOS_MES, CAL_REPETIR, Tempo, calApi, calNota } from "./calendario.js";
import { Dialogo, LV, MOD, analisar, apagarChave, avisoUmaVez, ehGM, esc, ordemNova, podeVerSecao, textoParaHtml } from "../nucleo.js";

/* ---------- História: diário de acontecimentos com data, ligado à Linha do tempo ----------
 * É um Diário comum com flags.journal-mesa.tipo = "historia". Cada acontecimento é uma página
 * nativa com flags.journal-mesa.acontecimento = { td, icone, cor, origem }.
 *   td     = dia (o mesmo número do calendário); sem td = "sem data", fica fora da linha do tempo
 *   origem = uuid da página que gerou o registro (missão, sessão, evento) ou "cal:td:texto"
 */
const HIST_ICONES = {
  "fa-landmark": "Marco", "fa-crown": "Reino / coroação", "fa-shield-halved": "Guerra / batalha", "fa-dove": "Paz / tratado",
  "fa-skull": "Morte / tragédia", "fa-baby": "Nascimento", "fa-fire": "Catástrofe", "fa-hand-sparkles": "Milagre / magia",
  "fa-city": "Fundação", "fa-ship": "Viagem / descoberta", "fa-book-skull": "Segredo / profecia", "fa-scroll": "Missão",
  "fa-book-bookmark": "Sessão", "fa-star": "Outro"
};
const HIST_COR = "#b8862e";
const ehHistoria = (j) => !!j && analisar(j).tipo === "historia";
const historias = () => game.journal.filter((j) => ehHistoria(j));

function acontecimento(p) {
  const a = p?.flags?.[MOD]?.acontecimento ?? {};
  const bruto = a.td;
  const td = bruto === null || bruto === undefined || bruto === "" || !Number.isFinite(Number(bruto)) ? null : Math.trunc(Number(bruto));
  return {
    td,
    icone: HIST_ICONES[a.icone] ? a.icone : "fa-landmark",
    cor: /^#[0-9a-f]{6}$/i.test(a.cor ?? "") ? a.cor : HIST_COR,
    origem: typeof a.origem === "string" ? a.origem : ""
  };
}

/** Páginas da História que o usuário pode ler (mesma regra do diário comum, com "revelar por partes"). */
function paginasHistoria(entry, user = game.user) {
  const pages = entry.pages.contents.sort((a, b) => a.sort - b.sort);
  if (user.isGM) return pages;
  if (!entry.testUserPermission(user, "LIMITED")) return [];
  return pages.filter((p) => p.testUserPermission(user, "OBSERVER") || podeVerSecao(entry, `pg-${p.id}`, user));
}

/** Ordem cronológica (sem data no fim, na ordem das páginas). */
function ordenarAcontecimentos(pages, desc = false) {
  return [...pages].sort((a, b) => {
    const ta = acontecimento(a).td, tb = acontecimento(b).td;
    if (ta == null && tb == null) return a.sort - b.sort;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return (desc ? tb - ta : ta - tb) || a.sort - b.sort;
  });
}

async function criarHistoria(pastaId = null, nome = T("História")) {
  return JournalEntry.create({
    name: nome, folder: pastaId ?? null, sort: ordemNova(pastaId), ownership: { default: LV().NONE },
    flags: { [MOD]: { tipo: "historia" } }, pages: []
  });
}

async function novoAcontecimento(h, { nome = T("Acontecimento"), td = null, icone = "fa-landmark", cor = HIST_COR, origem = "", html = "" } = {}) {
  const [p] = await h.createEmbeddedDocuments("JournalEntryPage", [{
    name: nome, type: "text", text: { content: html },
    sort: (h.pages.contents.reduce((mx, pg) => Math.max(mx, pg.sort), 0) || 0) + 100000,
    flags: { [MOD]: { acontecimento: { td, icone, cor, origem } } }
  }]);
  return p;
}

/** Acontecimentos já registrados, pela origem: Map(origem → { j, p }). */
function registradosNaHistoria() {
  const mapa = new Map();
  for (const h of historias()) for (const p of paginasHistoria(h)) {
    const o = acontecimento(p).origem;
    if (o && !mapa.has(o)) mapa.set(o, { j: h.id, p: p.id });
  }
  return mapa;
}

/** Janela "Registrar na História" (só o mestre). Devolve { entry, page } ou null. */
async function registrarNaHistoria({ td = null, nome = "", texto = "", origem = "", icone = "fa-landmark", historiaId = null } = {}) {
  if (!ehGM()) return null;
  const lista = historias();
  const sel = historiaId && game.journal.get(historiaId) ? historiaId : (lista[0]?.id ?? "");
  let dataHtml = "";
  if (Tempo.ok()) {
    const p = Tempo.partes(Number.isFinite(td) ? td : Tempo.hoje());
    dataHtml = `<label>${T("Data")} <span class="jm-data">
        <input type="number" name="dia" min="1" value="${p.dia}" data-tooltip="${T("Dia")}">
        <select name="mes">${Tempo.meses(p.ano).map((m) => `<option value="${m.i}" ${m.i === p.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
        <input type="number" name="ano" value="${p.ano}" data-tooltip="${T("Ano")}"></span></label>
      <label class="jm-check"><input type="checkbox" name="semData"> ${T("Sem data (não aparece na linha do tempo)")}</label>`;
  }
  const dados = await Dialogo().prompt({
    window: { title: T("Registrar na História"), icon: "fa-solid fa-landmark" },
    position: { width: 500 },
    content: `<div class="jm-form-dialogo">
      <label>${T("Diário")} <select name="hist">${lista.map((j) => `<option value="${j.id}" ${j.id === sel ? "selected" : ""}>${esc(j.name)}</option>`).join("")}
        <option value="" ${sel ? "" : "selected"}>+ ${T("Nova História")}</option></select></label>
      <label>${T("Acontecimento")} <input type="text" name="nome" value="${esc(nome)}" placeholder="${T("Ex.: A queda da Torre de Prata")}"></label>
      ${dataHtml}
      <label>${T("Ícone")} <select name="icone">${Object.entries(HIST_ICONES).map(([k, r]) => `<option value="${k}" ${k === icone ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <label>${T("O que aconteceu")} <textarea name="texto" rows="6" placeholder="${T("Como foi, quem estava, o que mudou...")}">${esc(texto)}</textarea></label>
    </div>`,
    ok: { label: T("Registrar"), icon: "fa-solid fa-feather-pointed", callback: (ev, b) => {
      const f = b.form.elements;
      return { hist: f.hist.value, nome: f.nome.value, texto: f.texto.value, icone: f.icone.value, semData: !!f.semData?.checked,
        dia: Number(f.dia?.value), mes: Number(f.mes?.value), ano: Number(f.ano?.value) };
    } }
  }).catch(() => null);
  if (!dados) return null;
  let tdFinal = null;
  if (Tempo.ok() && !dados.semData) {
    tdFinal = Tempo.tdDe(dados.ano, dados.mes, dados.dia);
    if (tdFinal == null) { ui.notifications.warn(T("Essa data não existe neste calendário.")); return null; }
  }
  const h = (dados.hist && game.journal.get(dados.hist)) || await criarHistoria();
  const page = await novoAcontecimento(h, { nome: String(dados.nome).trim() || T("Acontecimento"), td: tdFinal, icone: dados.icone, origem, html: textoParaHtml(String(dados.texto).trim()) });
  ui.notifications.info(`${T("Registrado em")} "${h.name}".`);
  return { entry: h, page };
}

/** Seletor de data (dia, mês, ano). O ouvinte [data-data] cuida de converter. */
function campoData(alvo, td, extra = "") {
  if (!Tempo.ok()) return `<span class="jm-dica">${T("Calendário indisponível.")}</span>`;
  const p = Tempo.partes(Number.isFinite(td) ? td : Tempo.hoje());
  const meses = Tempo.meses(p.ano);
  return `<span class="jm-data" data-data="${esc(alvo)}" ${extra}>
    <input type="number" min="1" max="${meses[p.mes]?.dias ?? 31}" value="${p.dia}" data-parte="dia" data-tooltip="${T("Dia")}">
    <select data-parte="mes">${meses.map((m) => `<option value="${m.i}" ${m.i === p.mes ? "selected" : ""} ${m.existe === false ? "disabled" : ""}>${esc(m.nome)}${m.existe === false ? T(" (não existe neste ano)") : ""}</option>`).join("")}</select>
    <input type="number" value="${p.ano}" data-parte="ano" data-tooltip="${T("Ano")}">
  </span>`;
}

const calHoje = () => Tempo.hoje();

/** Texto da data de uma nota: data completa quando há calendário nativo; senão, relativo a hoje. */
function calTextoDia(td) {
  if (Tempo.ok()) {
    const rel = Tempo.relativo(td);
    return `${Tempo.texto(td)}${[TF("hoje"), TF("amanhã"), TF("ontem")].includes(rel) ? ` (${rel})` : ""}`;
  }
  const d = td - Tempo.hoje();
  if (d === 0) return T("Hoje");
  return d > 0 ? `${T("Daqui a")} ${d} dias` : `${T("Há")} ${-d} dias`;
}

/** Nota já no formato novo (mesmas regras do Calendário da Mesa). */
function calNormalizar(n) {
  if (!n || !Number.isFinite(Number(n.td))) return null;
  const td = Math.trunc(Number(n.td));
  let repetir = n.repetir, cada = Math.max(1, Math.trunc(Number(n.cada) || 1));
  if (CAL_ANTIGOS[repetir]) { const [r, c] = CAL_ANTIGOS[repetir]; repetir = r; if (c) cada = c; }
  if (!CAL_REPETIR[repetir]) repetir = "nao";
  const semHoje = Tempo.ok() ? Tempo.partes(td).sem : 0;
  const dias = [...new Set((Array.isArray(n.diasSemana) ? n.diasSemana : []).map(Number).filter((d) => d >= 0))].sort((x, y) => x - y);
  return {
    ...n, td, repetir, cada,
    hora: /^\d{1,2}:\d{2}$/.test(n.hora ?? "") ? n.hora : "",
    diasSemana: dias.length ? dias : [semHoje],
    modoMes: CAL_MODOS_MES[n.modoMes] ? n.modoMes : "dia",
    duracao: Math.max(1, Math.trunc(Number(n.duracao) || 1)),
    fim: { tipo: CAL_FIM[n.fim?.tipo] ? n.fim.tipo : "nunca", td: Math.trunc(Number(n.fim?.td ?? td)) || td, vezes: Math.max(1, Math.trunc(Number(n.fim?.vezes) || 1)) },
    excecoes: Array.isArray(n.excecoes) ? n.excecoes : [],
    cor: /^#[0-9a-f]{6}$/i.test(n.cor ?? "") ? n.cor : "#c9a227",
    icone: CAL_ICONES[n.icone] ? n.icone : "fa-star",
    aviso: CAL_AVISOS[n.aviso] ? n.aviso : "nenhum"
  };
}

/** Nota nova, no calendário em uso. */
function notaPadrao(td, campos = {}) {
  let calId;
  try { calId = calApi()?.calendarioAtual?.().id; } catch (err) { avisoUmaVez(T("calendário em uso"), err); }
  return calNormalizar({ td, hora: "", repetir: "nao", cada: 1, duracao: 1, cor: "#c9a227", icone: "fa-star", aviso: "nenhum", fim: { tipo: "nunca" }, ...(calId ? { cal: calId } : {}), ...campos });
}

/** Frase da repetição: a do calendário quando ele está ativo. */
function calResumoRepeticao(entry) {
  try { const t = calApi()?.notas?.descrever?.(entry); if (t) return t; } catch (err) { avisoUmaVez(T("descrição da repetição pelo Calendário"), err); }
  const n = calNormalizar(calNota(entry));
  if (!n || n.repetir === "nao") return n?.duracao > 1 ? TF("{n} dias", { n: n.duracao }) : T("Não repete");
  const un = { dias: T("dias"), semanas: T("semanas"), meses: T("meses"), anos: T("anos") }[n.repetir];
  const base = n.cada === 1 ? { dias: T("Todo dia"), semanas: T("Toda semana"), meses: T("Todo mês"), anos: T("Todo ano") }[n.repetir] : `${T("A cada")} ${n.cada} ${un}`;
  return `${base}${n.duracao > 1 ? `, ${TF("durando {n} dias", { n: n.duracao })}` : ""}`;
}

/** Regra simplificada (só quando o calendário não está ativo). */
function calAconteceLocal(n, td) {
  if (td < n.td) return false;
  if (n.repetir === "nao") return td === n.td;
  if (n.repetir === "dias") return (td - n.td) % n.cada === 0;
  if (!Tempo.ok()) return false;
  const b = Tempo.partes(n.td), c = Tempo.partes(td);
  if (n.repetir === "semanas") return n.diasSemana.includes(c.sem) && Math.floor((td - n.td) / Math.max(1, Tempo.semana().length || 7)) % n.cada === 0;
  if (n.repetir === "meses") return c.dia === b.dia && (((c.ano - b.ano) * 12 + (c.mes - b.mes)) % n.cada === 0);
  if (n.repetir === "anos") return c.dia === b.dia && c.mes === b.mes && (c.ano - b.ano) % n.cada === 0;
  return false;
}

/** Próximas datas (td) em que a nota começa, a partir de hoje. */
function calProximas(entry, qtd = 1) {
  try {
    const r = calApi()?.notas?.proximas?.(entry, qtd);
    if (Array.isArray(r)) return r.map((x) => Number(x.td)).filter(Number.isFinite);
  } catch (err) { avisoUmaVez(T("próximas datas pelo Calendário"), err); }
  const n = calNormalizar(calNota(entry));
  if (!n) return [];
  const desde = Tempo.hoje(), r = [];
  for (let td = Math.max(desde, n.td); td < desde + 1500 && r.length < qtd; td++) if (calAconteceLocal(n, td)) r.push(td);
  return r;
}
const calProxima = (entry) => calProximas(entry, 1)[0] ?? null;

async function calSalvar(entry, mudancas) {
  const atual = calNota(entry) ?? notaPadrao(Tempo.hoje());
  const nova = calNormalizar({ ...atual, ...mudancas });
  if (!nova) return ui.notifications.warn(T("Não consegui marcar a data: o calendário não está disponível."));
  await entry.update({ [`flags.${CAL}.nota`]: nova });
}

async function calTirar(entry) {
  return apagarChave(entry, `flags.${CAL}`, "nota");
}

export { HIST_ICONES, acontecimento, calHoje, calNormalizar, calProxima, calProximas, calResumoRepeticao, calSalvar, calTextoDia, calTirar, campoData, criarHistoria, ehHistoria, historias, notaPadrao, novoAcontecimento, ordenarAcontecimentos, paginasHistoria, registradosNaHistoria, registrarNaHistoria };
