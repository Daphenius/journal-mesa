/* Jornal de Notícias — redação (o que só o mestre sabe).
 *
 * Veracidade das matérias e notas do mestre NUNCA ficam na página da edição (que os jogadores
 * passam a ler quando ela é publicada). Ficam no setting de mundo "jornalSegredos", oculto da
 * interface, gravado e lido só pelo mestre:
 *   { [idDaPágina]: { nota: "", materias: { [idDaMatéria]: { verdade, nota } } } }
 *
 * Limite do Foundry (documentado no README): o Foundry envia todos os documentos e settings do
 * mundo para todos os clientes; um jogador que abra o console (F12) consegue ler qualquer dado,
 * de qualquer módulo. A redação garante que nada disso aparece na interface, na ficha, no chat,
 * na exportação da edição ou na API do Journal — e que a página publicada não carrega segredos. */
import { J } from "./contexto.js";
import { VERACIDADE } from "./dados.js";

const CHAVE = "jornalSegredos";
const todos = () => { const s = game.settings.get(J.MOD, CHAVE); return s && typeof s === "object" ? s : {}; };

/** Segredos de uma edição (vazio para quem não é mestre). */
export function segredosDe(pageId) {
  if (!game.user.isGM) return { nota: "", materias: {} };
  const s = todos()[pageId];
  return { nota: String(s?.nota ?? ""), materias: { ...(s?.materias ?? {}) } };
}
export function normalizarSegredos(s, idsMaterias) {
  const materias = {};
  for (const id of idsMaterias) {
    const m = s?.materias?.[id];
    if (!m) continue;
    const verdade = VERACIDADE[m.verdade] ? m.verdade : "";
    const nota = String(m.nota ?? "").slice(0, 4000);
    if (verdade || nota) materias[id] = { verdade, nota };
  }
  return { nota: String(s?.nota ?? "").slice(0, 4000), materias };
}
/** Grava os segredos de uma edição (na fila: duas janelas salvando juntas não se apagam). */
export function gravarSegredos(pageId, s, idsMaterias) {
  if (!game.user.isGM) return Promise.resolve();
  return J.naFila("jornalSegredos", async () => {
    const tudo = J.dup(todos());
    const n = normalizarSegredos(s, idsMaterias);
    if (!n.nota && !Object.keys(n.materias).length) delete tudo[pageId];
    else tudo[pageId] = n;
    await game.settings.set(J.MOD, CHAVE, tudo);
  });
}
/** Edição apagada: os segredos dela saem junto (só o mestre principal grava). */
export function esquecerSegredos(pageIds) {
  if (!J.souGMPrincipal()) return Promise.resolve();
  const tudo0 = todos();
  if (!pageIds.some((id) => id in tudo0)) return Promise.resolve();
  return J.naFila("jornalSegredos", async () => {
    const tudo = J.dup(todos());
    for (const id of pageIds) delete tudo[id];
    await game.settings.set(J.MOD, CHAVE, tudo);
  });
}
export function registrarSegredos() {
  game.settings.register(J.MOD, CHAVE, { scope: "world", config: false, type: Object, default: {} });
}
