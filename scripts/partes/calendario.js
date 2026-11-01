/* Journal — integração com o Calendário da Mesa, datas pelo calendário nativo e horário das lojas.
 * Parte do journal.js; depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T, TF } from "../idioma.js";
import { MOD, analisar, avisoUmaVez } from "../nucleo.js";

/* ---------------- integração com o Calendário da Mesa ---------------- */

const CAL = "calendario-mesa";
/* mesmos valores que o calendário aceita (ele ignora o que não conhece) */
/* formato de repetição das notas; notas gravadas no formato antigo (anual/mensal/semanal/ndias) são convertidas ao ler */
const CAL_REPETIR = { nao: "Não repete", dias: "Dias", semanas: "Semanas", meses: "Meses", anos: "Anos" };
const CAL_ANTIGOS = { anual: ["anos", 1], mensal: ["meses", 1], semanal: ["semanas", 1], ndias: ["dias", null] };
const CAL_MODOS_MES = { dia: "No mesmo dia do mês", semana: "No mesmo dia da semana (ex.: 2ª terça)", ultima: "No último desse dia da semana" };
const CAL_FIM = { nunca: "Nunca", data: "Numa data", vezes: "Depois de N vezes" };
/* ícones das notas do calendário, em grupos (os antigos continuam valendo) */
const CAL_ICONES_GRUPOS = [
  ["Elementos do mundo", [
    ["fa-droplet", "Água"], ["fa-mountain", "Terra"], ["fa-fire", "Fogo"], ["fa-wind", "Ar"],
    ["fa-sun", "Luz"], ["fa-cloud-moon", "Trevas"], ["fa-wand-magic-sparkles", "Magia (Éter)"]]],
  ["Céu e natureza", [
    ["fa-moon", "Lua"], ["fa-star", "Estrela"], ["fa-cloud-sun", "Céu"], ["fa-cloud-rain", "Chuva"], ["fa-bolt", "Tempestade"],
    ["fa-snowflake", "Inverno"], ["fa-seedling", "Primavera"], ["fa-leaf", "Outono"], ["fa-wheat-awn", "Colheita"],
    ["fa-tree", "Floresta"], ["fa-water", "Mar"], ["fa-volcano", "Vulcão"], ["fa-rainbow", "Arco-íris"]]],
  ["Fé e mistério", [
    ["fa-hands-praying", "Religioso"], ["fa-church", "Templo"], ["fa-ankh", "Sagrado"], ["fa-fire-flame-curved", "Ritual"],
    ["fa-eye", "Profecia"], ["fa-ghost", "Espíritos"], ["fa-skull", "Caveira"], ["fa-book-skull", "Proibido"],
    ["fa-hat-wizard", "Arcano"], ["fa-flask", "Alquimia"], ["fa-dragon", "Dragão"], ["fa-gem", "Tesouro"]]],
  ["Povo e história", [
    ["fa-book-open", "História"], ["fa-feather", "Crônica"], ["fa-crown", "Coroa"], ["fa-flag", "Bandeira"], ["fa-landmark", "Cidade"],
    ["fa-scale-balanced", "Justiça"], ["fa-coins", "Comércio"], ["fa-ship", "Navegação"], ["fa-scroll", "Missão"],
    ["fa-gift", "Festa"], ["fa-champagne-glasses", "Banquete"], ["fa-music", "Música"], ["fa-masks-theater", "Teatro"],
    ["fa-heart", "Casamento"], ["fa-baby", "Nascimento"], ["fa-cake-candles", "Aniversário"]]],
  ["Guerra e perigo", [
    ["fa-shield-halved", "Guerra"], ["fa-horse", "Torneio"], ["fa-crosshairs", "Caçada"], ["fa-skull-crossbones", "Praga"],
    ["fa-virus", "Doença"], ["fa-bell", "Lembrete"], ["fa-hourglass-half", "Prazo"]]]
];
const CAL_ICONES = Object.fromEntries(CAL_ICONES_GRUPOS.flatMap(([, l]) => l));
/* cor sugerida ao escolher um elemento (só troca se a cor atual for a padrão ou de outro elemento) */
const CAL_CORES_ELEMENTO = {
  "fa-droplet": "#3b82f6", "fa-mountain": "#8b5a2b", "fa-fire": "#e2522c", "fa-wind": "#5fb8a8",
  "fa-sun": "#f2c230", "fa-cloud-moon": "#5b4a8a", "fa-wand-magic-sparkles": "#b05be8"
};
const CAL_AVISOS = { nenhum: "Sem aviso", mestre: "Avisar só o mestre", todos: "Avisar todos no chat" };

const calApi = () => (game.modules.get(CAL)?.active ? game.modules.get(CAL).api ?? null : null);
/** Ícone Font Awesome só com letras, números e hífen (o que vem de outro módulo não entra cru no HTML). */
const iconeSeguro = (i, padrao) => (/^fa-[a-z0-9-]+$/.test(String(i ?? "")) ? i : padrao);
/** Histórico da campanha do Calendário (pela API dele). */
function historicoCal() {
  const api = calApi();
  if (typeof api?.historico !== "function") return [];
  try { return api.historico() ?? []; } catch (err) { avisoUmaVez(T("Comum.HistoricoDoCalendario"), err); return []; }
}
function historicoCalVisivel() {
  const api = calApi();
  if (typeof api?.historicoVisivel !== "function") return false;
  try { return !!api.historicoVisivel(); } catch (err) { avisoUmaVez(T("Comum.HistoricoDoCalendario"), err); return false; }
}
/** A nota é do calendário em uso agora? (com vários calendários, cada civilização vê só as dela, como na grade do Calendário) */
function doCalendarioAtual(entry) {
  const api = calApi();
  if (typeof api?.notas?.calendario !== "function" || typeof api?.calendarioAtual !== "function") return true;
  try { const id = api.notas.calendario(entry); return !id || id === api.calendarioAtual()?.id; }
  catch (err) { avisoUmaVez(T("Calendario.CalendarioDaNota"), err); return true; }
}
/** Chama uma função da API do Calendário que devolve lista; erro ou ausência = []. */
function listaCal(nome, ...args) {
  const api = calApi();
  if (typeof api?.[nome] !== "function") return [];
  try { const r = api[nome](...args); return Array.isArray(r) ? r : []; } catch (err) { avisoUmaVez(`${nome} ${T("Calendario.DoCalendario")}`, err); return []; }
}
const calNota = (entry) => {
  const n = entry?.flags?.[CAL]?.nota;
  return n && Number.isFinite(Number(n.td)) ? n : null;
};
/* ---------- datas pelo calendário nativo do Foundry (game.time.calendar) ----------
 * O Calendário da Mesa troca o calendário nativo pelo do mundo; sem ele, vale o calendário
 * padrão do Foundry/sistema. "td" = número do dia desde o tempo zero (o mesmo que o
 * Calendário da Mesa grava nas notas).
 */
const Tempo = {
  /** API de datas do Calendário da Mesa, que conhece meses que somem, eras etc. */
  d() { const api = calApi(); return api?.datas?.tdDe ? api.datas : null; },
  cal() { return game.time?.calendar ?? null; },
  ok() { if (this.d()) return true; const c = this.cal(); return !!(c?.timeToComponents && c?.months?.values?.length); },
  segDia() {
    const d = this.cal()?.days ?? {};
    return (Number(d.hoursPerDay) || 24) * (Number(d.minutesPerHour) || 60) * (Number(d.secondsPerMinute) || 60);
  },
  hoje() {
    try { const td = Number(this.d()?.hoje?.() ?? calApi()?.agora?.().td); if (Number.isFinite(td)) return Math.trunc(td); } catch (err) { avisoUmaVez(T("Calendario.DiaDeHojePeloCalendario"), err); }
    return Math.floor((game.time?.worldTime ?? 0) / this.segDia());
  },
  comp(td) { return this.cal().timeToComponents(Math.trunc(td) * this.segDia()); },
  deslocAno() { return Number(this.cal()?.years?.yearZero) || 0; },
  /** { dia (1..), mes (0..), ano (mostrado), sem } */
  partes(td) {
    const d = this.d();
    if (d) { const p = d.partes(td); return { dia: p.dia, mes: p.mes, ano: p.ano, sem: p.sem, texto: p.textoCurto, textoAno: p.textoAno ?? String(p.ano), era: p.era ?? "" }; }
    const c = this.comp(td);
    return { dia: c.dayOfMonth + 1, mes: c.month, ano: c.year + this.deslocAno(), sem: c.dayOfWeek };
  },
  /** meses de um ano mostrado: [{ i, nome, dias, existe }] */
  meses(ano = this.partes(this.hoje()).ano) {
    const d = this.d();
    if (d) return d.meses(ano);
    const c = this.cal();
    const interno = ano - this.deslocAno();
    const bis = !!c?.isLeapYear?.(interno);
    return (c?.months?.values ?? []).map((m, i) => ({ i, nome: game.i18n.localize(m.name ?? `${T("Calendario.Mes")} ${i + 1}`), dias: Number(bis && m.leapDays != null ? m.leapDays : m.days) || 0, existe: true }));
  },
  semana() {
    const d = this.d();
    if (d) return d.semana();
    return (this.cal()?.days?.values ?? []).map((x, i) => game.i18n.localize(x.name ?? `${T("Comum.Dia2")} ${i + 1}`));
  },
  texto(td) {
    if (!this.ok()) return `${T("Comum.Dia")} ${td}`;
    const d = this.d();
    if (d) return d.partes(td).textoCurto;
    const p = this.partes(td);
    return TF("Calendario.DiaDeMesDeAno", { dia: p.dia, mes: this.meses(p.ano)[p.mes]?.nome ?? "?", ano: p.ano });
  },
  /** dia (1..), mês (0..), ano mostrado → td; null se a data não existe */
  tdDe(ano, mes, dia) {
    const d = this.d();
    if (d) return d.tdDe(ano, mes, dia);
    const c = this.cal();
    if (!c?.componentsToTime) return null;
    const meses = this.meses(ano);
    mes = Math.trunc(mes); dia = Math.trunc(dia);
    if (!meses[mes] || dia < 1 || dia > meses[mes].dias) return null;
    let doy = dia - 1;
    for (let i = 0; i < mes; i++) doy += meses[i].dias;
    const td = Math.floor(c.componentsToTime({ year: Math.trunc(ano) - this.deslocAno(), day: doy, hour: 0, minute: 0, second: 0 }) / this.segDia());
    const v = this.comp(td);
    return v.month === mes && v.dayOfMonth === dia - 1 ? td : null;
  },
  relativo(td) {
    const d = td - this.hoje();
    if (d === 0) return TF("Comum.Hoje");
    if (d === 1) return TF("Comum.Amanha");
    if (d === -1) return TF("Comum.Ontem");
    const n = Math.abs(d);
    if (n >= 60 && this.ok()) {
      const a = this.partes(this.hoje()), b = this.partes(td);
      const porAno = Math.max(1, this.meses(a.ano).length);
      const meses = Math.abs((a.ano - b.ano) * porAno + (a.mes - b.mes));
      const anos = Math.abs(a.ano - b.ano);
      const txt = anos >= 2 ? TF("Calendario.NAnos", { n: anos }) : meses >= 2 ? TF("Calendario.NMeses", { n: meses }) : TF("Comum.NDias", { n });
      return d > 0 ? TF("Calendario.DaquiAT", { t: txt }) : TF("Calendario.HaT", { t: txt });
    }
    return d > 0 ? TF("Calendario.DaquiANDias", { n: d }) : TF("Calendario.HaNDias", { n: -d });
  }
};

/* ---------- horário das lojas (abre/fecha no formato do Monk's: minutos do dia) ---------- */
const minParaHora = (m) => `${String(Math.floor((Number(m) || 0) / 60)).padStart(2, "0")}:${String(Math.round((Number(m) || 0) % 60)).padStart(2, "0")}`;
const horaParaMin = (t) => { const r = String(t ?? "").trim().match(/^(\d{1,2}):(\d{2})$/); return r ? Number(r[1]) * 60 + Number(r[2]) : null; };

/** Horário da loja: { ativo, abre, fecha, folga }. Com o Calendário da Mesa ativo, vale a regra dele
 *  (a mesma que bloqueia a compra); sem ele, a mesma regra feita aqui:
 *  loja do Journal sem horário ligado = sempre aberta; loja só do Monk's = abertura e fechamento dele. */
function horarioLoja(entry) {
  const { page, m, tipo } = analisar(entry);
  if (!page || tipo !== "shop") return null;
  try {
    const api = calApi();
    if (typeof api?.horarioLoja === "function") { const h = api.horarioLoja(entry); if (h) return { ...h, folga: (h.folga ?? []).map(Number) }; }
  } catch (err) { avisoUmaVez(T("Calendario.HorarioDaLojaPeloCalendario"), err); }
  const hj = page.flags?.[MOD]?.horario;
  const doJournal = !!page.flags?.[MOD];
  const folga = Array.isArray(hj?.folga) ? hj.folga.map(Number).filter(Number.isFinite) : [];
  return { ativo: hj ? hj.ativo !== false : !doJournal, abre: Number(m.opening ?? 480), fecha: Number(m.closing ?? 1020), folga };
}

/** "folga", "horario" ou null (aberta). */
function lojaFechadaPor(entry) {
  try { const api = calApi(); if (typeof api?.lojaFechadaPor === "function") return api.lojaFechadaPor(entry); } catch (err) { avisoUmaVez(T("Calendario.LojaFechadaPeloCalendario"), err); }
  const h = horarioLoja(entry);
  if (!h?.ativo) return null;
  const c = game.time?.components;
  if (!c) return null;
  if (h.folga.length && h.folga.includes(c.dayOfWeek)) return "folga";
  if (h.abre === h.fecha) return null;
  const minPorHora = Number(game.time.calendar?.days?.minutesPerHour) || 60;
  const min = c.hour * 60 + c.minute * (60 / minPorHora);
  const dentro = h.abre < h.fecha ? min >= h.abre && min < h.fecha : min >= h.abre || min < h.fecha;
  return dentro ? null : "horario";
}

function textoHorarioLoja(entry) {
  const h = horarioLoja(entry);
  if (!h?.ativo) return null;
  const motivo = lojaFechadaPor(entry);
  if (motivo === "folga") return { aberta: false, texto: T("Comum.FolgaHoje") };
  if (motivo === "horario") return { aberta: false, texto: `${T("Calendario.FechadaAbreAs")} ${minParaHora(h.abre)}` };
  return { aberta: true, texto: h.abre === h.fecha ? T("Calendario.Aberta") : `${T("Calendario.AbertaFechaAs")} ${minParaHora(h.fecha)}` };
}

/** Jogador tentando usar loja fechada? (o mestre sempre pode) */
const lojaBloqueada = (e, userId) => !game.users.get(userId)?.isGM && analisar(e).tipo === "shop" && lojaFechadaPor(e) !== null;

/** Texto do prazo de uma missão. */
function textoPrazo(td) {
  const d = td - Tempo.hoje();
  const quando = d === 0 ? T("Calendario.VenceHoje") : d === 1 ? T("Calendario.VenceAmanha") : d > 0 ? TF("Calendario.FaltamNDias", { n: d }) : d === -1 ? TF("Calendario.VenceuHa1Dia") : TF("Calendario.VenceuHaNDias", { n: -d });
  return { quando, classe: d < 0 ? "vencido" : d <= 2 ? "urgente" : "" };
}

/** Dias sagrados de uma divindade: notas do calendário com nota.divindade = endereço (uuid) dela,
 *  o mesmo campo que o "Dia sagrado" do Calendário da Mesa usa. */
const festasDe = (deus) => game.journal.filter((j) => j.flags?.[CAL]?.nota?.divindade === deus.uuid);
const deusDaFesta = (entry) => {
  const u = entry?.flags?.[CAL]?.nota?.divindade;
  return typeof u === "string" && u.startsWith("JournalEntry.") ? game.journal.get(u.split(".")[1]) ?? null : null;
};

export { CAL, CAL_ANTIGOS, CAL_AVISOS, CAL_CORES_ELEMENTO, CAL_FIM, CAL_ICONES, CAL_ICONES_GRUPOS, CAL_MODOS_MES, CAL_REPETIR, Tempo, calApi, calNota, deusDaFesta, doCalendarioAtual, festasDe, historicoCal, historicoCalVisivel, horaParaMin, horarioLoja, iconeSeguro, listaCal, lojaBloqueada, lojaFechadaPor, minParaHora, textoHorarioLoja, textoPrazo };
