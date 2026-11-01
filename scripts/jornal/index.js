/* Jornal de Notícias — Imprensa do Mundo.
 *   dados.js       publicações, edições e matérias (formato e leitura)
 *   redacao.js     veracidade e notas do mestre (fora das páginas que os jogadores leem)
 *   publicacao.js  rascunho → programada → publicada → arquivada; publicação automática; apresentar
 *   leitura.js     páginas da edição como jornal impresso (3 estilos, várias páginas)
 *   leitor.js      janela de LEITURA (jogadores e mestre)
 *   visual.js      página da publicação no Journal, aba, relacionadas, Linha do tempo
 *   editor.js      janela de EDIÇÃO (só o mestre); vinculos.js escolhe os documentos ligados
 *   i18n.js        textos em lang/pt-BR.json e lang/en.json
 * Este arquivo liga tudo ao Journal: ações dos botões, ouvintes, configurações, ganchos e API. */
import { J, instalarContexto } from "./contexto.js";
import { ehJornal, ehEdicao, jornais, edicoes, lerEdicao, criarJornal, criarEdicao, identidade, publicaEstado, dataDaEdicao, podeLerEdicao, SECOES, rotSecao } from "./dados.js";
import { t, garantirIdioma } from "./i18n.js";
import { LeitorJornal, atualizarLeitores } from "./leitor.js";
import { registrarSegredos, esquecerSegredos } from "./redacao.js";
import { publicar, programar, voltarRascunho, arquivar, verificarProgramadas, apresentar, aoApresentar } from "./publicacao.js";
import { corpoJornal, painelJornais, secaoRelacionadas, itensLinha } from "./visual.js";
import { EditorJornal, fecharEditoresDe } from "./editor.js";
import { exportarEdicao, dialogoImportar, importarNoJornal, novaAPartirDe, mostrarRelatorio } from "./json.js";

export { caminhoSeguro } from "./dados.js";
export { instalarContexto, ehJornal, corpoJornal, painelJornais, secaoRelacionadas, itensLinha, verificarProgramadas, aoApresentar, identidade, criarJornal, edicoes, publicaEstado, t, LeitorJornal };

import { esc as e } from "../nucleo.js";
const pagina = (el) => game.journal.get(el.dataset.id)?.pages.get(el.dataset.page) ?? null;

export function registrarConfiguracoes() {
  registrarSegredos();
  game.settings.register(J.MOD, "jornalNaLinha", {
    name: "JMESA.Config.jornalNaLinha.nome",
    hint: "JMESA.Config.jornalNaLinha.dica",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => J.atualizarTudo()
  });
}
export const naLinha = () => game.settings.get(J.MOD, "jornalNaLinha") !== false;

/** Abre a edição para LER (janela de jornal). Rascunho/programada (só o mestre chega nelas) também abrem. */
export function lerEdicaoJanela(entryId, pageId) { return LeitorJornal.abrir(entryId, pageId); }

/** Abre o Journal numa edição (página do jornal, com os controles do mestre). */
export function abrirEdicao(entryId, pageId) {
  const app = J.abrirJournal();
  app.jornalSel ??= new Map();
  if (pageId) app.jornalSel.set(entryId, pageId);
  app.abrirPagina(entryId, { pagina: pageId });
  return app;
}

async function escolherJornal() {
  const lista = jornais();
  if (lista.length === 1) return lista[0];
  if (!lista.length) {
    const ok = await J.Dialogo().confirm({ window: { title: t("Jornal.NenhumJornalTitulo") }, content: `<p>${e(t("Jornal.CriarAgora"))}</p>` });
    return ok ? await novoJornal() : null;
  }
  const id = await J.Dialogo().prompt({
    window: { title: t("Jornal.NovaEdicao"), icon: "fa-solid fa-newspaper" },
    content: `<div class="jm-form-dialogo"><label>${e(t("Jornal.Jornal"))} <select name="j">${lista.map((j) => `<option value="${j.id}">${e(j.name)}</option>`).join("")}</select></label></div>`,
    ok: { label: t("Jornal.CriarEdicao"), icon: "fa-solid fa-plus", callback: (ev, b) => b.form.elements.j.value }
  }).catch(() => null);
  return id ? game.journal.get(id) : null;
}

async function novoJornal(app = null) {
  const en = await criarJornal(app?.pastaDestino ?? null);
  if (!en) return null;
  abrirEdicao(en.id, null);
  EditorJornal.abrir(en.id);
  return en;
}

async function dialogoPublicar(p) {
  const ed = lerEdicao(p);
  const leitores = game.users.filter((u) => !u.isGM && p.parent.testUserPermission(u, "OBSERVER"));
  const aviso = leitores.length ? "" : `<p class="jm-dica"><i class="fa-solid fa-triangle-exclamation"></i> ${e(t("Jornal.NaoCircula"))}</p>`;
  return J.Dialogo().prompt({
    window: { title: t("Jornal.PublicarTitulo", { n: ed.numero }), icon: "fa-solid fa-newspaper" },
    content: `<div class="jm-form-dialogo">${aviso}
      <p><b>${e(ed.titulo || t("Jornal.SemManchete"))}</b></p>
      <label class="jm-check"><input type="checkbox" name="anunciar" ${ed.anunciar ? "checked" : ""}> ${e(t("Jornal.AvisarChat"))}</label>
      <label class="jm-check"><input type="checkbox" name="apresentar"> ${e(t("Jornal.AbrirConectados"))}</label></div>`,
    ok: { label: t("Jornal.Publicar"), icon: "fa-solid fa-newspaper", callback: (ev, b) => ({ anunciarNoChat: b.form.elements.anunciar.checked, apresentarAgora: b.form.elements.apresentar.checked }) }
  }).catch(() => null);
}

async function dialogoProgramar(p) {
  if (!J.Tempo.ok()) { ui.notifications.warn(t("Jornal.SemCalendario")); return null; }
  const ed = lerEdicao(p);
  const td0 = ed.publicarEm ?? J.Tempo.hoje() + 1;
  const pt = J.Tempo.partes(td0);
  const meses = J.Tempo.meses(pt.ano);
  return J.Dialogo().prompt({
    window: { title: t("Jornal.ProgramarTitulo", { n: ed.numero }), icon: "fa-solid fa-clock" },
    content: `<div class="jm-form-dialogo">
      <label>${e(t("Jornal.PublicarEm"))} <span class="jm-data"><input type="number" name="dia" min="1" value="${pt.dia}">
        <select name="mes">${meses.map((m) => `<option value="${m.i}" ${m.i === pt.mes ? "selected" : ""}>${e(m.nome)}</option>`).join("")}</select>
        <input type="number" name="ano" value="${pt.ano}"></span></label>
      <label class="jm-check"><input type="checkbox" name="auto" ${ed.auto ? "checked" : ""}> ${e(t("Jornal.PublicarSozinha"))}</label>
      <label class="jm-check"><input type="checkbox" name="anunciar" ${ed.anunciar ? "checked" : ""}> ${e(t("Jornal.AvisarAoPublicar"))}</label>
      <p class="jm-dica">${e(t("Jornal.HojeE", { hoje: J.Tempo.texto(J.Tempo.hoje()) }))}</p></div>`,
    ok: { label: t("Jornal.Programar"), icon: "fa-solid fa-clock", callback: (ev, b) => {
      const f = b.form.elements;
      return { td: J.Tempo.tdDe(Number(f.ano.value), Number(f.mes.value), Number(f.dia.value)), auto: f.auto.checked, anunciarNoChat: f.anunciar.checked };
    } }
  }).catch(() => null);
}

/** Botões com data-action="jornal" data-op="...". */
export async function acao(app, op, el) {
  const gm = game.user.isGM;
  try {
    switch (op) {
      case "ver": { const p = pagina(el); if (p) abrirEdicao(p.parent.id, p.id); else if (el.dataset.id) app.abrirPagina(el.dataset.id); return; }
      case "ler": { const p = pagina(el); if (p) lerEdicaoJanela(p.parent.id, p.id); return; }
      case "filtro": app.jornaisFiltro = el.dataset.filtro; return app.render();
    }
    if (!gm) return;
    switch (op) {
      case "criarJornal": return novoJornal(app);
      case "identidade": return EditorJornal.abrir(el.dataset.id);
      case "novaEdicao": {
        const en = el.dataset.id ? game.journal.get(el.dataset.id) : await escolherJornal();
        if (!ehJornal(en)) return;
        const p = await criarEdicao(en);
        if (!p) return;
        abrirEdicao(en.id, p.id);
        return EditorJornal.abrir(en.id, p.id);
      }
      case "editarEdicao": { const p = pagina(el); if (p) EditorJornal.abrir(p.parent.id, p.id); return; }
      case "publicar": {
        const p = pagina(el); if (!p) return;
        const r = await dialogoPublicar(p); if (!r) return;
        if (await publicar(p, r)) ui.notifications.info(t("Jornal.Publicada"));
        return;
      }
      case "programar": {
        const p = pagina(el); if (!p) return;
        const r = await dialogoProgramar(p); if (!r) return;
        if (r.td == null) return ui.notifications.warn(t("Jornal.DataNaoExiste"));
        await programar(p, r.td, r);
        return;
      }
      case "rascunho": {
        const p = pagina(el); if (!p) return;
        const ed = lerEdicao(p);
        if (publicaEstado(ed.estado)) {
          const ok = await J.Dialogo().confirm({ window: { title: t("Jornal.Despublicar") }, content: `<p>${e(t("Jornal.DespublicarPergunta", { n: ed.numero }))}</p>` });
          if (!ok) return;
        }
        return voltarRascunho(p);
      }
      case "arquivar": { const p = pagina(el); if (p) await arquivar(p, true); return; }
      case "desarquivar": { const p = pagina(el); if (p) await arquivar(p, false); return; }
      case "apresentar": { const p = pagina(el); if (p) apresentar(p); return; }
      case "exportar": { const p = pagina(el); if (p) exportarEdicao(p); return; }
      case "novaAPartir": {
        const p = pagina(el); if (!p) return;
        const nova = await novaAPartirDe(p);
        if (nova) { abrirEdicao(nova.parent.id, nova.id); EditorJornal.abrir(nova.parent.id, nova.id); }
        return;
      }
      case "importar": {
        const en = el.dataset.id ? game.journal.get(el.dataset.id) : await escolherJornal();
        if (!ehJornal(en)) return;
        const texto = await dialogoImportar(en);
        if (!texto) return;
        try {
          const { paginas, relatorio } = await importarNoJornal(en, texto);
          mostrarRelatorio(relatorio);
          if (!paginas.length) return;
          ui.notifications.info(t("Jornal.Json.Importadas", { n: paginas.length }));
          abrirEdicao(en.id, paginas[0].id);
          EditorJornal.abrir(en.id, paginas[0].id);
        } catch (err) { console.warn("Journal da Mesa | importar edição", err); ui.notifications.error(String(err?.message ?? err)); }
        return;
      }
      case "apagarEdicao": {
        const p = pagina(el); if (!p) return;
        const ed = lerEdicao(p);
        const ok = await J.Dialogo().confirm({ window: { title: t("Jornal.ApagarEdicao") }, content: `<p>${e(t("Jornal.ApagarPergunta", { n: ed.numero, titulo: ed.titulo || t("Jornal.SemManchete") }))}</p>` });
        if (ok) await p.delete();
        return;
      }
    }
  } catch (err) { J.relatarErro(t("Jornal.ErroAcao", { op }), err); }
}

/** Busca da aba Jornais e Notícias (filtra sem redesenhar). */
export function ouvintes(app, root) {
  const busca = root.querySelector("[data-jornal-busca]");
  if (!busca) return;
  const filtrar = () => {
    const q = busca.value.trim().toLowerCase();
    app.jornaisBusca = busca.value;
    let algum = false;
    root.querySelectorAll("[data-jornal-busca-item]").forEach((c) => { c.hidden = !!q && !c.dataset.jornalBuscaItem.includes(q); if (!c.hidden) algum = true; });
    const nada = root.querySelector(".jmj-nada-busca");
    if (nada) nada.hidden = algum || !q;
  };
  busca.addEventListener("input", filtrar);
  filtrar();
}

/** O Foundry só lê os estilos do module.json ao iniciar o mundo: quem atualizou o módulo e só recarregou
 *  a página ficaria sem o visual do jornal. Carrega o jornal.css se ele ainda não estiver na página. */
function garantirEstilo() {
  try {
    if ([...document.querySelectorAll("link[rel=stylesheet]")].some((l) => String(l.href).includes("journal-mesa/styles/jornal.css"))) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = new URL("../../styles/jornal.css", import.meta.url).href;
    document.head.appendChild(l);
  } catch { /* sem documento (testes) */ }
}

/** Ganchos próprios do jornal. */
export function registrarGanchos() {
  J.lerEdicao = lerEdicaoJanela;
  J.abrirEdicaoNoJournal = abrirEdicao;
  Hooks.once("ready", () => { garantirEstilo(); garantirIdioma(); });
  // "Ler a edição" no aviso do chat
  document.addEventListener("click", (ev) => {
    const a = ev.target?.closest?.("[data-jornal-ler]");
    if (!a) return;
    ev.preventDefault();
    const p = game.journal.get(a.dataset.jornalLer)?.pages.get(a.dataset.jornalPagina);
    if (p && podeLerEdicao(p)) lerEdicaoJanela(p.parent.id, p.id);
    else ui.notifications.warn(t("Jornal.SemAcesso"));
  });
  // edição alterada, despublicada ou apagada: a leitura aberta acompanha
  for (const h of ["updateJournalEntryPage", "deleteJournalEntryPage"]) {
    Hooks.on(h, (p) => { if (p.flags?.[J.MOD]?.edicao) atualizarLeitores(p.parent?.id); });
  }
  Hooks.on("updateJournalEntry", (j) => { if (ehJornal(j)) atualizarLeitores(j.id); });
  Hooks.on("deleteJournalEntryPage", (p) => {
    if (p.flags?.[J.MOD]?.edicao) { esquecerSegredos([p.id]); fecharEditoresDe(p.parent?.id, p.id); }
  });
  Hooks.on("deleteJournalEntry", (j) => {
    if (!ehJornal(j)) return;
    esquecerSegredos(j.pages.contents.map((p) => p.id));
    fecharEditoresDe(j.id);
  });
}

/** API pública (game.modules.get("journal-mesa").api.jornais): só o que o usuário pode ler — jornais com
 *  permissão Limitado ou mais, edições publicadas ou arquivadas (o mestre vê todas). Nunca devolve
 *  veracidade nem notas do mestre. Documentada no README ("API para macros") e em scripts/api.js. */
export const apiJornais = {
  /**
   * Jornais que o usuário pode ler.
   * @returns {Array<{id: string, uuid: string, nome: string, subtitulo: string, regiao: string, estilo: string}>}
   * @example game.modules.get("journal-mesa").api.jornais.lista().map((j) => j.nome);
   */
  lista: () => jornais().map((j) => ({ id: j.id, uuid: j.uuid, nome: j.name, ...(({ subtitulo, regiao, estilo }) => ({ subtitulo, regiao, estilo }))(identidade(j)) })),
  /**
   * Edições de um jornal: as publicadas e arquivadas para jogadores; todas (rascunho, programada...) para o mestre.
   * @param {string} id  ID do JournalEntry do jornal (ver `lista()`).
   * @returns {Array<{id: string, uuid: string, numero: number, estado: "rascunho"|"programado"|"publicado"|"arquivado", data: string, td: number|null, titulo: string, materias: Array<{id: string, secao: string, titulo: string, categoria: string}>}>}  Vazio se não for jornal ou o usuário não puder ler.
   * @example const j = game.modules.get("journal-mesa").api.jornais.lista()[0]; game.modules.get("journal-mesa").api.jornais.edicoes(j.id);
   */
  edicoes: (id) => {
    const j = game.journal.get(id);
    if (!ehJornal(j) || !(game.user.isGM || j.testUserPermission(game.user, "LIMITED"))) return [];
    return edicoes(j).filter(({ ed }) => game.user.isGM || publicaEstado(ed.estado)).map(({ p, ed }) => ({
      id: p.id, uuid: p.uuid, numero: ed.numero, estado: ed.estado, data: dataDaEdicao(ed), td: ed.td, titulo: ed.titulo,
      materias: ed.materias.map((m) => ({ id: m.id, secao: m.secao, titulo: m.titulo, categoria: m.categoria }))
    }));
  },
  /**
   * Abre o jornal na janela do Journal da Mesa (página do jornal, com os controles do mestre), numa edição se `pageId` vier.
   * @param {string} id  ID do JournalEntry do jornal.
   * @param {string|null} [pageId=null]  ID da página da edição (ver `edicoes()`).
   * @returns {JournalApp}
   * @example game.modules.get("journal-mesa").api.jornais.abrir(idDoJornal);
   */
  abrir: (id, pageId = null) => abrirEdicao(id, pageId),
  /**
   * Abre uma edição para LER, na janela de jornal (a folha impressa). Rascunho e programada só abrem para o mestre.
   * @param {string} id  ID do JournalEntry do jornal.
   * @param {string} pageId  ID da página da edição.
   * @returns {LeitorJornal|null}  null (com aviso) se a edição não existir ou o usuário não puder ler.
   * @example const [ed] = game.modules.get("journal-mesa").api.jornais.edicoes(idDoJornal); game.modules.get("journal-mesa").api.jornais.ler(idDoJornal, ed.id);
   */
  ler: (id, pageId) => lerEdicaoJanela(id, pageId),
  /**
   * Publica agora as edições programadas cuja data já passou (ou só avisa, se a publicação automática
   * da edição estiver desligada). Só faz algo no mestre principal e com um calendário ativo.
   * @returns {Promise<number>}  Quantas edições foram publicadas.
   * @example await game.modules.get("journal-mesa").api.jornais.verificarProgramadas();
   */
  verificarProgramadas: () => verificarProgramadas(),
  /**
   * Seções das matérias com o rótulo no idioma atual ({ noticia, rumor, aviso, classificado }).
   * @returns {Record<string, string>}
   * @example game.modules.get("journal-mesa").api.jornais.secoes();
   */
  secoes: () => Object.fromEntries(Object.keys(SECOES).map((k) => [k, rotSecao(k)]))
};

export { ehEdicao, EditorJornal };
