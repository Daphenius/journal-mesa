/* Journal — idioma dos textos escritos em português no código.
 * Os textos passam por T(): a chave é um código curto calculado do texto ("JMESA.t<código>", o mesmo
 * esquema do Calendário da Mesa), e lang/pt-BR.json e lang/en.json trazem cada texto nos dois idiomas.
 * Texto sem tradução (nomes criados pelo mestre, por exemplo) aparece como foi escrito.
 * O Jornal de Notícias usa chaves legíveis ("JMESA.Jornal...") pelo t() de jornal/i18n.js.
 * Separado do journal.js para que outras partes possam ser extraídas dele importando só isto. */
export function chaveI18n(pt) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pt.length; i++) { h ^= pt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `JMESA.t${h.toString(36)}`;
}
export function T(pt) {
  const s = String(pt ?? "");
  try { const k = chaveI18n(s); if (game.i18n?.has?.(k)) return game.i18n.localize(k); } catch { /* idioma ainda não carregado: português */ }
  return s;
}
/** T() com campos: TF("faltam {n} dias", { n: 3 }). */
export function TF(pt, dados) {
  let s = T(pt);
  if (dados) s = s.replace(/\{(\w+)\}/g, (m, n) => (dados[n] !== undefined ? String(dados[n]) : m));
  return s;
}
/** Traduz no lugar os textos de objetos e listas (só valores de texto com tradução; chaves e ids ficam). */
export function traduzirNoLugar(obj, vistos = new Set()) {
  if (!obj || typeof obj !== "object" || vistos.has(obj)) return;
  vistos.add(obj);
  for (const k of Object.keys(obj)) {
    const d = Object.getOwnPropertyDescriptor(obj, k);
    if (!d || !("value" in d)) continue;   // getters (ex.: o tipo Jornal) já se traduzem sozinhos
    if (typeof d.value === "string") { const t = T(d.value); if (t !== d.value && d.writable) obj[k] = t; }
    else traduzirNoLugar(d.value, vistos);
  }
}
