/* Journal — passagem do tempo: prazos de missão, dias no diário de sessão, lojas abrindo e fechando; ganchos de atualização.
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T, TF } from "../idioma.js";
import * as Jornal from "../jornal/index.js";
import { CAL, Tempo, calApi, horarioLoja, lojaFechadaPor } from "./calendario.js";
import { ligarCartaoNegocio } from "./pechincha.js";
import { Sessao, souGMPrincipal } from "./sessao.js";
import { Dialogo, FichaJournalClasse, MOD, analisar, atualizarTudo, avisoUmaVez, chat, criarBauDoCombate, derrotadosDo, ehGM, esc, idsGM, janela, dadosSet, obterJanela, podeVer, relatarErro } from "../nucleo.js";

/* ---------------- passagem do tempo: prazos de missão, dias no diário de sessão, lojas abrindo/fechando ---------------- */

let ultimoDia = null;
let sessaoEstava = false;
let ultimoEstadoLoja = null;
/** Ao entrar no mundo: o dia e o estado da sessão de agora (chamado no "ready"). */
function lembrarEstadoInicial() { ultimoDia = Tempo.hoje(); sessaoEstava = Sessao.ativa(); }
/** A sessão começou ou terminou? (true só quando o estado muda) */
function sessaoMudou(ativa) { if (ativa === sessaoEstava) return false; sessaoEstava = ativa; return true; }

/** Missões em andamento cujo prazo passou. */
async function verificarPrazos(hoje) {
  for (const j of game.journal) {
    const a = analisar(j);
    if (a.tipo !== "quest" || !a.page || a.x.prazo == null || a.x.prazoAvisado) continue;
    if (["completed", "failed"].includes(a.m.status)) continue;
    const prazo = Number(a.x.prazo);
    if (!Number.isFinite(prazo) || hoje <= prazo) continue;
    const falhar = a.x.aoVencer === "falhar";
    await a.page.update({ [`flags.${MOD}.prazoAvisado`]: true, ...(falhar ? { [`flags.${MOD}.concluidaEm`]: hoje } : {}) });
    if (falhar) await dadosSet(a.page, "status", "failed");
    const texto = `${T("Prazo da missão")} <b>${esc(j.name)}</b> venceu${falhar ? ` — ${T("marcada como")} <b>falhou</b>` : ""}.`;
    await chat(`<i class="fa-solid fa-hourglass-end"></i> ${texto}`, { whisper: idsGM() });
    Sessao.registrar("missao", texto);
    try { await calApi()?.registrar?.(`${T("Prazo vencido")}: ${j.name}`, "fa-hourglass-end"); } catch (err) { avisoUmaVez(T("histórico do Calendário"), err); }
  }
}

Hooks.on("updateWorldTime", async () => {
  const hoje = Tempo.hoje();
  if (ultimoDia == null) ultimoDia = hoje;
  if (hoje !== ultimoDia) {
    const antes = ultimoDia;
    ultimoDia = hoje;
    if (souGMPrincipal()) {
      if (hoje > antes) {
        let eventos = [];
        try { eventos = calApi()?.notasDoDia?.(hoje) ?? []; } catch (err) { avisoUmaVez(T("eventos do dia pelo Calendário"), err); }
        Sessao.registrar("dia", `${T("Chegou")} <b>${esc(Tempo.texto(hoje))}</b>${hoje - antes > 1 ? ` (passaram ${hoje - antes} dias)` : ""}.${eventos.length ? ` ${T("Eventos")}: ${eventos.map((j) => esc(j.name)).join(", ")}.` : ""}`);
      }
      await verificarPrazos(hoje);
      await Jornal.verificarProgramadas().catch((err) => relatarErro(T("edições programadas"), err));
    }
    return atualizarTudo();
  }
  /* mesma data: só redesenha se a loja aberta mudou de aberta para fechada (ou o contrário) */
  if (!janela?.rendered || !janela.ativa || janela.ativa.startsWith("__")) return;
  const e = game.journal.get(janela.ativa);
  if (!e || analisar(e).tipo !== "shop" || !horarioLoja(e).ativo) return;
  const estado = `${e.id}:${lojaFechadaPor(e) ?? "aberta"}`;
  if (estado !== ultimoEstadoLoja) { ultimoEstadoLoja = estado; atualizarTudo(); }
});

for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry", "createJournalEntryPage", "deleteJournalEntryPage", "createCombat", "deleteCombat"]) {
  Hooks.on(h, () => atualizarTudo());
}
Hooks.on("updateJournalEntryPage", (page, changes) => {
  const soTexto = Object.keys(changes).every((k) => ["text", "_id", "_stats"].includes(k));
  if (janela?.editorAtivo && soTexto && page.parent?.id === janela.ativa) return;
  atualizarTudo();
});
Hooks.on("calendarioMesa.novoDia", () => atualizarTudo());
/* histórico, contadores, anomalias ou calendários mudaram no Calendário: só a Linha do tempo e o Nexus dependem disso */
const CAL_CHAVES = new Set(["historico", "contadores", "climaTipos", "climaZonas", "calendarios", "anomaliasAtivas", "anomaliaRegiaoInteira"].map((k) => `${CAL}.${k}`));
for (const h of ["createSetting", "updateSetting"]) {
  Hooks.on(h, (doc) => { if (CAL_CHAVES.has(doc?.key) && ["__linha", "__nexus"].includes(janela?.ativa)) atualizarTudo(); });
}

for (const h of ["createItem", "updateItem", "deleteItem", "updateActor"]) {
  Hooks.on(h, () => { if (janela?.rendered && janela.subLoja === "vender") atualizarTudo(); });
}
for (const h of ["createFolder", "updateFolder", "deleteFolder"]) {
  Hooks.on(h, (f) => { if (f.type === "JournalEntry") atualizarTudo(); });
}

/* combate no diário de sessão */
Hooks.on("deleteCombat", (combat) => {
  if (!souGMPrincipal() || (!combat.started && !combat.round)) return;
  const caidos = derrotadosDo(combat).map((c) => esc(c.name ?? c.actor?.name)).filter(Boolean);
  Sessao.registrar("combate", `${T("Combate encerrado")}${combat.round ? ` em ${combat.round} rodada(s)` : ""}.${caidos.length ? ` ${T("Derrotados")}: ${caidos.join(", ")}.` : ""}`);
});

/* baú de saque ao encerrar o combate */
Hooks.on("deleteCombat", async (combat, options, userId) => {
  if (userId !== game.user.id || !ehGM() || !game.settings.get(MOD, "bauFimCombate")) return;
  if (!combat.started && !combat.round) return;
  if (!derrotadosDo(combat).length) return;
  const ok = await Dialogo().confirm({
    window: { title: T("Saque do combate"), icon: "fa-solid fa-box-open" },
    content: `<p>${T("Criar um")} <b>${T("Baú")}</b> ${T("no Journal da Mesa com os itens e moedas dos inimigos derrotados?")}</p>`
  });
  if (ok) criarBauDoCombate(combat);
});

/* links para diários/páginas abrem no Journal, numa aba */
/**
 * O Journal só "pega" o clique quando o diário usa a ficha padrão (do Foundry ou do sistema)
 * ou a ficha "Journal". Se o diário usa a ficha de outro módulo (Heavy Lore, Monk's, etc.),
 * escolhida no próprio diário ou como padrão do mundo, o clique segue para esse módulo.
 */
function abreNoJournal(entry) {
  if (!entry) return false;
  let Cls = null;
  try { Cls = entry._getSheetClass?.() ?? null; } catch { Cls = null; }
  if (!Cls) return false;
  if (FichaJournalClasse && (Cls === FichaJournalClasse || Cls.prototype instanceof FichaJournalClasse)) return true;
  const tipo = entry.type ?? CONST.BASE_DOCUMENT_TYPE ?? "base";
  const registro = CONFIG.JournalEntry?.sheetClasses?.[tipo] ?? CONFIG.JournalEntry?.sheetClasses?.base ?? {};
  const chave = Object.entries(registro).find(([, r]) => r?.cls === Cls)?.[0];
  if (!chave) return Cls === foundry.applications?.sheets?.journal?.JournalEntrySheet;
  const escopo = chave.split(".")[0];
  return escopo === "core" || escopo === game.system.id || escopo === MOD;
}

function cliqueEmLink(ev) {
  const a = ev.target.closest?.("a");
  if (!a) return;
  const dentro = !!janela?.element?.contains(a);
  if (!dentro && !game.settings.get(MOD, "abrirAqui")) return;

  if (a.classList.contains("content-link") && a.dataset.uuid) {
    const doc = fromUuidSync(a.dataset.uuid);
    let entry = null, pagina = null;
    if (doc?.documentName === "JournalEntry") entry = doc;
    else if (doc?.documentName === "JournalEntryPage") { entry = doc.parent; pagina = doc.id; }
    if (!entry || entry.pack || !game.journal.get(entry.id) || !podeVer(entry)) return;
    if (!abreNoJournal(entry)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    obterJanela();
    janela.abrirPagina(entry.id, { pagina, ancora: a.dataset.hash ?? null });
    return;
  }

  if (!dentro || a.dataset.action || a.classList.contains("content-link")) return;
  const href = a.getAttribute("href");
  if (!href) return;
  if (href.startsWith("#")) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    janela._rolar({ ancora: decodeURIComponent(href.slice(1)) });
    return;
  }
  if (!/^(https?:|mailto:)/i.test(href)) {
    // link relativo (comum em texto colado da internet): no Foundry ele abre uma aba quebrada
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const ancora = href.split("#")[1];
    if (ancora) janela._rolar({ ancora: decodeURIComponent(ancora) });
    else ui.notifications.warn(`${T("Este link aponta para")} "${href}", ${T("que não existe no Foundry. Edite o texto e troque por um link do Foundry (arraste a página para o texto).")}`);
  }
}

/* cartão de pechincha no chat */
Hooks.on("renderChatMessageHTML", (msg, html) => ligarCartaoNegocio(msg, html));

export { abreNoJournal, cliqueEmLink, lembrarEstadoInicial, sessaoMudou };
