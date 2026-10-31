/* Jornal de Notícias — publicação.
 *
 * Quem publica: só o mestre. Não existe pedido de jogador para publicar: o socket do Journal não tem
 * ação de publicação, e o próprio servidor do Foundry recusa a alteração de uma página por quem não é
 * dono dela. A única mensagem do jornal pelo socket é "jornalApresentar", e quem recebe só abre uma
 * edição que já pode ler (um pedido forjado não mostra nada novo a ninguém).
 *
 * Programadas: a data é um dia do calendário (td, o mesmo número do Calendário da Mesa; sem ele, o
 * calendário nativo do Foundry). O mestre principal confere ao entrar no mundo e a cada virada de dia
 * (gancho "updateWorldTime", o mesmo que o Journal já usa para os prazos), publica tudo que venceu —
 * inclusive depois de um pulo grande de tempo — numa fila, relendo o estado de cada edição antes:
 * uma edição já publicada nunca é publicada de novo. O estado fica na própria página, então nada se
 * perde ao recarregar. Voltar o tempo (Desfazer do Calendário) não despublica nada. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { lerEdicao, ehEdicao, podeLerEdicao, dataDaEdicao, jornais, publicaEstado } from "./dados.js";

const FILA = "jornalPublicar";
const nivel = () => J.LV();
const INHERIT = () => nivel().INHERIT ?? -1;

/** Muda estado e permissão da página numa só gravação. */
async function gravarEstado(p, mudancas, padraoPermissao) {
  const upd = {};
  for (const [k, v] of Object.entries(mudancas)) upd[`flags.${J.MOD}.edicao.${k}`] = v;
  if (padraoPermissao !== undefined) upd["ownership.default"] = padraoPermissao;
  await p.update(upd);
}

/** Usuários (não mestres) que podem ler a edição. */
const leitores = (p) => game.users.filter((u) => !u.isGM && podeLerEdicao(p, u));

async function anunciar(p, ed) {
  const quem = leitores(p);
  const todosLeem = game.users.filter((u) => !u.isGM).every((u) => quem.includes(u));
  const e = J.esc;
  const conteudo = `<i class="fa-solid fa-newspaper"></i> <b>${e(p.parent.name)}</b> — ${e(t("Jornal.EdicaoN", { n: ed.numero }))}${dataDaEdicao(ed) ? ` <small>(${e(dataDaEdicao(ed))})</small>` : ""}
    <br><b>${e(ed.titulo || t("Jornal.NovaEdicao"))}</b>${ed.subtitulo ? `<br><i>${e(ed.subtitulo)}</i>` : ""}
    <br><a class="jmj-chat-ler" data-jornal-ler="${p.parent.id}" data-jornal-pagina="${p.id}"><i class="fa-solid fa-book-open-reader"></i> ${e(t("Jornal.LerEdicao"))}</a> · @UUID[${p.uuid}]{${t("Jornal.AbrirNoJournal")}}`;
  // só quem pode ler recebe o aviso (circulação restrita não vaza a manchete)
  await J.chat(conteudo, todosLeem ? {} : { whisper: [...J.idsGM(), ...quem.map((u) => u.id)] });
}

/** Publica sem fila (chamado já dentro da fila). Devolve true se publicou agora. */
async function publicarAgora(p, { anunciarNoChat = null, apresentarAgora = false } = {}) {
  const ed = lerEdicao(p);
  if (!ed || publicaEstado(ed.estado)) return false;          // já publicada: nunca duas vezes
  const hoje = J.Tempo.ok() ? J.Tempo.hoje() : null;
  await gravarEstado(p, { estado: "publicado", publicadoEm: hoje, avisado: false, ...(ed.td == null && hoje != null && !ed.dataTexto ? { td: hoje } : {}) }, INHERIT());
  const final = lerEdicao(p);
  if (anunciarNoChat ?? ed.anunciar) await anunciar(p, final);
  if (apresentarAgora) apresentar(p);
  J.Sessao?.registrar?.("jornal", J.esc(t("Jornal.SessaoPublicou", { jornal: p.parent.name, n: final.numero, titulo: final.titulo || t("Jornal.SemManchete") })));
  return true;
}

export function publicar(p, opcoes = {}) {
  if (!game.user.isGM || !ehEdicao(p)) return Promise.resolve(false);
  return J.naFila(FILA, () => publicarAgora(p, opcoes));
}

export function programar(p, td, { auto = true, anunciarNoChat = true } = {}) {
  if (!game.user.isGM || !ehEdicao(p)) return Promise.resolve(false);
  const dia = Number.isFinite(Number(td)) ? Math.trunc(Number(td)) : null;
  if (dia == null) return Promise.resolve(false);
  return J.naFila(FILA, async () => {
    const ed = lerEdicao(p);
    if (publicaEstado(ed.estado)) return false;
    await gravarEstado(p, { estado: "programado", publicarEm: dia, auto: !!auto, anunciar: !!anunciarNoChat, avisado: false }, nivel().NONE);
    return true;
  }).then(async (ok) => { if (ok) await verificarProgramadas(); return ok; });
}

/** Volta para rascunho (sai da vista dos jogadores; nada é apagado). */
export function voltarRascunho(p) {
  if (!game.user.isGM || !ehEdicao(p)) return Promise.resolve(false);
  return J.naFila(FILA, async () => {
    await gravarEstado(p, { estado: "rascunho", publicarEm: null, avisado: false }, nivel().NONE);
    return true;
  });
}

/** Arquivar mantém quem lê (a permissão continua a do jornal); só muda onde a edição aparece. */
export function arquivar(p, sim = true) {
  if (!game.user.isGM || !ehEdicao(p)) return Promise.resolve(false);
  return J.naFila(FILA, async () => {
    const ed = lerEdicao(p);
    if (sim && ed.estado !== "publicado") return false;
    if (!sim && ed.estado !== "arquivado") return false;
    await gravarEstado(p, { estado: sim ? "arquivado" : "publicado", arquivadoEm: sim && J.Tempo.ok() ? J.Tempo.hoje() : null });
    return true;
  });
}

/** Mestre principal: publica as programadas que venceram (ou avisa, se a publicação automática estiver desligada). */
export function verificarProgramadas() {
  if (!J.souGMPrincipal() || !J.Tempo.ok()) return Promise.resolve(0);
  return J.naFila(FILA, async () => {
    const hoje = J.Tempo.hoje();
    const pend = [];
    for (const j of jornais()) for (const p of j.pages.contents) {
      const ed = lerEdicao(p);
      if (ed?.estado === "programado" && ed.publicarEm != null && ed.publicarEm <= hoje) pend.push({ p, ed });
    }
    pend.sort((a, b) => (a.ed.publicarEm - b.ed.publicarEm) || (a.ed.numero - b.ed.numero));
    let n = 0;
    for (const { p, ed } of pend) {
      try {
        if (ed.auto) { if (await publicarAgora(p)) n++; }
        else if (!ed.avisado) {
          await gravarEstado(p, { avisado: true });
          await J.chat(`<i class="fa-solid fa-clock"></i> ${J.esc(t("Jornal.ChegouData", { n: ed.numero, jornal: p.parent.name }))}`, { whisper: J.idsGM() });
        }
      } catch (err) { J.relatarErro(t("Jornal.ErroProgramada", { nome: p.name }), err); }
    }
    return n;
  });
}

/** Abre a edição na tela dos jogadores conectados que podem lê-la. */
export function apresentar(p) {
  if (!game.user.isGM || !ehEdicao(p)) return [];
  const quem = leitores(p).filter((u) => u.active);
  if (!quem.length) { ui.notifications.warn(t("Jornal.NinguemConectado")); return []; }
  game.socket.emit(J.CANAL, { acao: "jornalApresentar", entryId: p.parent.id, pageId: p.id, userIds: quem.map((u) => u.id) });
  ui.notifications.info(t("Jornal.AbertaPara", { nomes: quem.map((u) => u.name).join(", ") }));
  return quem;
}

/** Recebido pelo socket: só abre o que este usuário já pode ler. */
export function aoApresentar(msg) {
  if (!msg || typeof msg.entryId !== "string" || typeof msg.pageId !== "string") return;
  if (Array.isArray(msg.userIds) && !msg.userIds.includes(game.user.id)) return;
  const p = game.journal.get(msg.entryId)?.pages.get(msg.pageId);
  if (!p || !podeLerEdicao(p) || !publicaEstado(lerEdicao(p).estado)) return;
  J.lerEdicao(p.parent.id, p.id);
}
