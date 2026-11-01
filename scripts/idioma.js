/* Journal — idioma dos textos da interface.
 * Os textos ficam em lang/pt-BR.json e lang/en.json, sob "JMESA", com chaves legíveis por área
 * ("JMESA.Janela.Fechar", "JMESA.Nucleo.Npc"...). No código, T("Janela.Fechar") devolve o texto no idioma do
 * Foundry; TF("Tempo.FaltamNDias", { n: 3 }) troca os {campos}. Sem a chave (idioma ainda não carregado ou
 * tradução faltando), aparece a própria chave — assim a falta fica visível em vez de passar despercebida.
 * Textos que ficam em constantes (tipos, status, ícones, configurações) são escritos em português e traduzidos
 * depois, quando o idioma carrega, por traduzirNoLugar() e TD(), usando o mapa texto → chave de idioma-mapa.js
 * (gerado por tools/i18n-migrar.mjs). Nomes criados pelo mestre nunca passam por aqui: dado de usuário não se traduz.
 * O Jornal de Notícias usa as chaves "JMESA.Jornal..." pelo t() de jornal/i18n.js.
 * Separado do journal.js para que outras partes possam ser extraídas dele importando só isto. */
import { MAPA_PT } from "./idioma-mapa.js";

const PREFIXO = "JMESA";

/** Texto da chave ("Area.Nome") no idioma do Foundry; com dados, troca os {campos}. */
export function T(chave, dados) {
  const c = String(chave ?? "");
  let s = c;
  try { const k = `${PREFIXO}.${c}`; if (game.i18n?.has?.(k)) s = game.i18n.localize(k); } catch { /* idioma ainda não carregado */ }
  if (dados) s = s.replace(/\{(\w+)\}/g, (m, n) => (dados[n] !== undefined ? String(dados[n]) : m));
  return s;
}
/** T() com campos: TF("Tempo.FaltamNDias", { n: 3 }). */
export function TF(chave, dados) { return T(chave, dados); }
/** Traduz um texto escrito em português no código (constantes, configurações) pelo mapa; sem chave, devolve como veio. */
export function TD(pt) {
  const s = String(pt ?? "");
  const chave = MAPA_PT[s];
  return chave ? T(chave) : s;
}
/** Traduz no lugar os textos de objetos e listas (só valores de texto com tradução; chaves e ids ficam). */
export function traduzirNoLugar(obj, vistos = new Set()) {
  if (!obj || typeof obj !== "object" || vistos.has(obj)) return;
  vistos.add(obj);
  for (const k of Object.keys(obj)) {
    const d = Object.getOwnPropertyDescriptor(obj, k);
    if (!d || !("value" in d)) continue;   // getters (ex.: o tipo Jornal) já se traduzem sozinhos
    if (typeof d.value === "string") { const t = TD(d.value); if (t !== d.value && d.writable) obj[k] = t; }
    else traduzirNoLugar(d.value, vistos);
  }
}
