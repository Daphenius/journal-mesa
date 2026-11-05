/* Journal — lojas ligadas à economia do módulo Monetização (opcional).
 * Cada loja pode dizer em que cidade da Monetização fica (aba Configurar). A partir daí:
 *   - o preço dos itens segue a economia daquela cidade (multiplicador sobre o preço da loja);
 *   - itens cuja mercadoria está em falta na cidade aparecem como "em falta" e não podem ser comprados;
 *   - compras e vendas dos jogadores entram na economia (mexem no estoque e no preço da cidade);
 *   - a renovação semanal do estoque puxa o que a região produz.
 * Sem a Monetização ativa, ou sem cidade escolhida, nada disso acontece e a loja funciona como sempre.
 * Tudo aqui só lê a API pública da Monetização (game.modules.get("monetizacao").api). */

const MON = "monetizacao";
export const ECONOMIA_PADRAO = { local: "", precos: true, falta: true, registrar: true, rotacao: true };

/** API da Monetização, se o módulo estiver ativo. */
export function apiEco() {
  const m = game.modules.get(MON);
  return m?.active && m.api ? m.api : null;
}

/** Cidades da Monetização, para o seletor da loja. */
export const locaisEco = () => {
  try { return apiEco()?.locais?.() ?? []; } catch { return []; }
};

/** Ligação da loja com a economia, ou null (sem módulo, sem cidade ou cidade apagada). */
export function ecoDaLoja(x) {
  const api = apiEco();
  const id = x?.economia?.local;
  if (!api || !id) return null;
  let local = null;
  try { local = api.local(id); } catch { local = null; }
  if (!local) return null;
  return { api, id, nome: local.nome, cfg: { ...ECONOMIA_PADRAO, ...(x.economia ?? {}) } };
}

/** Multiplicador de preço da economia para um item da loja (1 = normal). */
export function multEco(x, item) {
  const e = ecoDaLoja(x);
  if (!e || !e.cfg.precos || !item) return 1;
  try {
    const m = Number(e.api.multiplicadorItem(item, e.id));
    return Number.isFinite(m) && m > 0 ? m : 1;
  } catch { return 1; }
}

/** O item está em falta na cidade da loja? */
export function emFalta(x, item) {
  const e = ecoDaLoja(x);
  if (!e || !e.cfg.falta || !item) return false;
  try { return e.api.disponivel(item, e.id) === false; } catch { return false; }
}

/** Registra na economia que os jogadores compraram ("compra") ou venderam ("venda") um item. Só o mestre. */
export async function registrarEco(x, item, quantidade, tipo) {
  const e = ecoDaLoja(x);
  if (!e || !e.cfg.registrar || !item || !game.user.isGM) return;
  try { await e.api.registrarItem(item, e.id, quantidade, tipo); }
  catch (err) { console.warn("Journal da Mesa | não consegui registrar a transação na Monetização", err); }
}

/** Peso de um item na renovação do estoque: mais para o que a região produz, quase nada para o que está em falta. */
export function pesoRotacao(x, item) {
  const e = ecoDaLoja(x);
  if (!e || !e.cfg.rotacao || !item) return 1;
  try {
    const cat = e.api.categoriaItem?.(item);
    let w = Number(e.api.abundancia(e.id)?.[cat]) || 1;
    if (e.api.disponivel(item, e.id) === false) w *= 0.1;
    return Math.max(0.05, w);
  } catch { return 1; }
}

/** Sorteia `n` candidatos sem repetir posição, pelo peso de cada um. */
export function escolherPorPeso(candidatos, pesos, n) {
  const restantes = candidatos.map((c, i) => ({ c, w: Math.max(0, pesos[i] ?? 1) }));
  const saida = [];
  while (saida.length < n && restantes.length) {
    const total = restantes.reduce((s, r) => s + r.w, 0);
    let alvo = Math.random() * (total || 1);
    let i = 0;
    for (; i < restantes.length - 1; i++) { alvo -= restantes[i].w; if (alvo <= 0) break; }
    saida.push(restantes.splice(i, 1)[0].c);
  }
  return saida;
}
