/* Jornal de Notícias — edições automáticas.
 *
 * Cada jornal pode ter "Edição automática" ligada (configurada na página da publicação, só o mestre).
 * Na virada do dia do calendário, o mestre principal confere os jornais ligados: quando já passou o
 * intervalo escolhido (todo dia, a cada 7 dias...), monta uma edição com o que aconteceu no mundo:
 *   - Monetização (se ativa): caravanas saqueadas, fome, eventos, mudança de estação, preços que
 *     dispararam, feitos do grupo (como boato) — opcionalmente só da facção/região do jornal;
 *   - Calendário da Mesa (se ativo): eventos do dia que os jogadores podem ver;
 *   - Missões visíveis aos jogadores com prazo nos próximos 7 dias (classificados "Procura-se").
 * A edição nasce como rascunho (o mestre revisa e publica) ou sai publicada direto, conforme o jornal.
 * Dia sem nada para contar não gera edição (opção). Um pulo grande de tempo gera UMA edição cobrindo
 * o período, não uma por dia. O que já foi coberto fica marcado no próprio jornal (flags.auto). */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { ehJornal, jornais, criarEdicao, materiaPadrao, proximoNumero } from "./dados.js";
import { publicar } from "./publicacao.js";

export const AUTO_PADRAO = {
  ativo: false, intervalo: 1, publicar: false, pularVazio: true,
  economia: true, faccao: "", calendario: true, missoes: true,
  ultimoTd: null, ultimoDiaEco: null
};
export const autoDe = (j) => ({ ...AUTO_PADRAO, ...(j?.flags?.[J.MOD]?.auto ?? {}) });

export function apiEco() {
  const m = game.modules.get("monetizacao");
  return m?.active && m.api ? m.api : null;
}

const MAX_ECONOMIA = 6;
const CAT_ECONOMIA = { perda: "crime", falta: "sociedade", evento: "comercio", status: "comercio", estacao: "natureza", grupo: "viagens" };
const TITULO_FIXO = { perda: "Jornal.Auto.TituloPerda", falta: "Jornal.Auto.TituloFalta", grupo: "Jornal.Auto.TituloGrupo" };
const semPonto = (s) => String(s ?? "").replace(/\.\s*$/, "");

/** Matérias vindas da Monetização desde o último dia coberto. */
function materiasEconomia(cfg) {
  const api = apiEco();
  if (!api || !cfg.economia) return { materias: [], diaEco: null };
  let lista = [];
  const diaEco = api.dia();
  try {
    const desde = cfg.ultimoDiaEco ?? diaEco - Math.max(1, cfg.intervalo);
    lista = api.noticias(desde, { faccao: cfg.faccao || "" }) ?? [];
  } catch (err) { J.avisoUmaVez(t("Jornal.Auto.Titulo"), err); }
  const e = J.esc;
  const vistos = new Set();
  const precos = [];
  const materias = [];
  for (const n of lista) {
    if (vistos.has(n.texto)) continue;
    vistos.add(n.texto);
    if (n.tipo === "alta" || n.tipo === "baixa") { precos.push(n); continue; }
    if (materias.length >= MAX_ECONOMIA) continue;
    const m = materiaPadrao(n.tipo === "grupo" ? "rumor" : "noticia");
    m.titulo = TITULO_FIXO[n.tipo] ? t(TITULO_FIXO[n.tipo]) : semPonto(n.texto);
    m.texto = `<p>${e(n.texto)}</p>${n.data ? `<p><em>${e(n.data)}</em></p>` : ""}`;
    m.categoria = t(`Jornal.Categoria.${CAT_ECONOMIA[n.tipo] ?? "comercio"}`);
    materias.push(m);
  }
  if (precos.length) {
    const m = materiaPadrao("noticia");
    m.titulo = t("Jornal.Auto.TituloPrecos");
    m.texto = `<ul>${precos.slice(-10).map((n) => `<li>${e(n.texto)}</li>`).join("")}</ul>`;
    m.categoria = t("Jornal.Categoria.comercio");
    materias.push(m);
  }
  return { materias, diaEco };
}

/** Eventos do calendário de hoje que os jogadores podem ver. */
function materiaCalendario(cfg, td) {
  if (!cfg.calendario) return null;
  let notas = [];
  try { notas = J.calApi?.()?.notasDoDia?.(td) ?? []; } catch { notas = []; }
  const visiveis = notas.filter((j) => j && J.estaVisivel?.(j));
  if (!visiveis.length) return null;
  const m = materiaPadrao("aviso");
  m.titulo = t("Jornal.Auto.TituloEventos");
  m.texto = `<ul>${visiveis.map((j) => `<li>${J.esc(j.name)}</li>`).join("")}</ul>`;
  m.vinculos = visiveis.map((j) => j.uuid).slice(0, 30);
  return m;
}

/** Missões visíveis aos jogadores, em andamento, com prazo nos próximos 7 dias. */
function materiaMissoes(cfg, td) {
  if (!cfg.missoes) return null;
  const lista = [];
  for (const j of game.journal) {
    const a = J.analisar(j);
    if (a.tipo !== "quest" || !a.page || a.x.prazo == null || !J.estaVisivel?.(j)) continue;
    if (["completed", "failed"].includes(a.m.status)) continue;
    const prazo = Number(a.x.prazo);
    if (!Number.isFinite(prazo) || prazo < td || prazo > td + 7) continue;
    lista.push({ j, prazo });
  }
  if (!lista.length) return null;
  lista.sort((a, b) => a.prazo - b.prazo);
  const m = materiaPadrao("classificado");
  m.titulo = t("Jornal.Auto.TituloMissoes");
  m.texto = `<ul>${lista.map(({ j, prazo }) => `<li><b>${J.esc(j.name)}</b> — ${J.esc(t("Jornal.Auto.Ate", { data: J.Tempo.ok() ? J.Tempo.texto(prazo) : String(prazo) }))}</li>`).join("")}</ul>`;
  m.vinculos = lista.map(({ j }) => j.uuid).slice(0, 30);
  return m;
}

/** Monta e cria (ou não) a edição de um jornal. Devolve a página criada, ou null. */
async function gerarPara(entry, td, { forcar = false } = {}) {
  const cfg = autoDe(entry);
  const { materias: eco, diaEco } = materiasEconomia(cfg);
  const materias = [...eco, materiaCalendario(cfg, td), materiaMissoes(cfg, td)].filter(Boolean);
  const marcar = { ultimoTd: td, ...(diaEco != null ? { ultimoDiaEco: diaEco } : {}) };
  if (!materias.length && cfg.pularVazio && !forcar) {
    await entry.update({ [`flags.${J.MOD}.auto`]: { ...cfg, ...marcar } });
    return null;
  }
  const principal = materias.find((m) => m.secao === "noticia") ?? materias[0];
  const p = await criarEdicao(entry, {
    numero: proximoNumero(entry), td,
    titulo: principal?.titulo || t("Jornal.Auto.SemNovidades"),
    subtitulo: materias.length ? "" : t("Jornal.Auto.DiaCalmo"),
    materias
  });
  await entry.update({ [`flags.${J.MOD}.auto`]: { ...cfg, ...marcar } });
  if (p && cfg.publicar) await publicar(p, { anunciarNoChat: true });
  return p;
}

/** Virada de dia (mestre principal): gera as edições dos jornais que chegaram no intervalo. */
export async function gerarEdicoesAutomaticas(hoje) {
  if (!game.user.isGM || hoje == null) return;
  for (const entry of jornais()) {
    const cfg = autoDe(entry);
    if (!cfg.ativo) continue;
    const passou = cfg.ultimoTd == null ? Infinity : hoje - cfg.ultimoTd;
    if (passou < Math.max(1, Number(cfg.intervalo) || 1)) continue;
    try { await gerarPara(entry, hoje); }
    catch (err) { J.relatarErro(t("Jornal.Auto.Titulo"), err); }
  }
}

/** Botão "Gerar edição agora" (ignora o intervalo e cria mesmo sem novidades). */
export async function gerarAgora(entry) {
  if (!game.user.isGM || !ehJornal(entry)) return null;
  return gerarPara(entry, J.Tempo.ok() ? J.Tempo.hoje() : null, { forcar: true });
}

/** Bloco da página do jornal (só o mestre): configurar a edição automática. */
export function painelAuto(entry) {
  const cfg = autoDe(entry);
  const e = J.esc;
  const api = apiEco();
  const cal = !!J.calApi?.();
  const id = entry.id;
  const caixa = (k, rot, extra = "") => `<label class="jm-check"><input type="checkbox" data-jornal-auto="${k}" data-id="${id}" ${cfg[k] ? "checked" : ""} ${extra}> ${e(rot)}</label>`;
  let faccoes = [];
  try { faccoes = api?.faccoes?.() ?? []; } catch { faccoes = []; }
  const ultima = cfg.ultimoTd != null && J.Tempo.ok() ? t("Jornal.Auto.Ultima", { data: J.Tempo.texto(cfg.ultimoTd) }) : "";
  return `<div class="jmj-auto ${cfg.ativo ? "" : "desligado"}">
    ${caixa("ativo", t("Jornal.Auto.Ligar"))}
    <div class="jm-sub-linha">
      <label class="jm-sub-campo">${e(t("Jornal.Auto.Intervalo"))} <input type="number" min="1" max="365" data-jornal-auto="intervalo" data-id="${id}" value="${Number(cfg.intervalo) || 1}"></label>
      <label class="jm-sub-campo">${e(t("Jornal.Auto.AoCriar"))} <select data-jornal-auto="publicar" data-id="${id}">
        <option value="0" ${cfg.publicar ? "" : "selected"}>${e(t("Jornal.Auto.Rascunho"))}</option>
        <option value="1" ${cfg.publicar ? "selected" : ""}>${e(t("Jornal.Auto.PublicarDireto"))}</option>
      </select></label>
    </div>
    <div class="jm-sub-linha">
      ${caixa("pularVazio", t("Jornal.Auto.PularVazio"))}
    </div>
    <div class="jm-sub-linha">
      <span class="jm-dica">${e(t("Jornal.Auto.Fontes"))}</span>
      ${api ? caixa("economia", t("Jornal.Auto.FonteEconomia")) : ""}
      ${api && faccoes.length ? `<label class="jm-sub-campo">${e(t("Jornal.Auto.Regiao"))} <select data-jornal-auto="faccao" data-id="${id}">
          <option value="">${e(t("Jornal.Auto.TodasRegioes"))}</option>
          ${faccoes.map((f) => `<option value="${e(f.id)}" ${f.id === cfg.faccao ? "selected" : ""}>${e(f.nome)}</option>`).join("")}
        </select></label>` : ""}
      ${cal ? caixa("calendario", t("Jornal.Auto.FonteCalendario")) : ""}
      ${caixa("missoes", t("Jornal.Auto.FonteMissoes"))}
    </div>
    <div class="jm-sub-linha">
      <button type="button" class="sec" data-action="jornal" data-op="gerarAuto" data-id="${id}"><i class="fa-solid fa-wand-magic-sparkles"></i> ${e(t("Jornal.Auto.GerarAgora"))}</button>
      ${ultima ? `<span class="jm-dica">${e(ultima)}</span>` : ""}
    </div>
    ${!api && !cal ? `<p class="jm-dica">${e(t("Jornal.Auto.SemFontes"))}</p>` : ""}
  </div>`;
}

/** Campos do painel: gravam em flags.auto do jornal. */
export function ouvintesAuto(root) {
  root.querySelectorAll("[data-jornal-auto]").forEach((el) => el.addEventListener("change", async () => {
    const entry = game.journal.get(el.dataset.id);
    if (!game.user.isGM || !ehJornal(entry)) return;
    const k = el.dataset.jornalAuto;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (k === "intervalo") v = Math.max(1, Math.min(365, Math.trunc(Number(v) || 1)));
    if (k === "publicar") v = v === "1";
    await entry.setFlag(J.MOD, `auto.${k}`, v);
  }));
}
