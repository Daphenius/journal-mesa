/* Jornal de Notícias — limpeza do HTML das matérias.
 *
 * O texto das edições fica nas flags da página (o servidor do Foundry não limpa flags) e chega ao leitor
 * por innerHTML. Por isso o Jornal limpa o HTML sempre, com ou sem o limpador do Foundry:
 *   1. foundry.utils.cleanHTML, quando existe (o mesmo que o Foundry usa nos próprios textos);
 *   2. depois, sempre, a limpeza abaixo: tira as tags que executam ou embutem coisas (script, iframe,
 *      object, form, svg...), os atributos on*, srcdoc e links javascript:/vbscript:/data: (só imagens
 *      em data: ficam). A formatação do editor (títulos, listas, tabelas, negrito, imagens, links,
 *      seções secretas, @UUID) continua igual.
 * No navegador a limpeza usa um <template> (conteúdo inerte: nada carrega nem executa enquanto limpa);
 * sem DOM (testes em node) usa expressões regulares equivalentes. Este arquivo não importa nada. */

const PROIBIDAS = ["script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "link", "meta", "base",
  "form", "input", "button", "textarea", "select", "option", "noscript", "template", "svg", "math", "portal"];
const ATRIB_URL = new Set(["href", "src", "xlink:href", "action", "formaction", "poster", "background", "cite", "data"]);
const URL_RUIM = /^\s*(javascript|vbscript|data)\s*:/i;
const URL_IMAGEM = /^\s*data:image\/(png|jpe?g|gif|webp|avif);/i;
const ESTILO_RUIM = /expression\s*\(|javascript\s*:|url\s*\(|@import|behavior\s*:/i;

/** Valor de atributo de URL aceitável? (data:image só em src de imagem) */
function urlOk(nome, valor, tag) {
  const v = String(valor ?? "").replace(/[\u0000- \u007f]+/g, "");
  if (!URL_RUIM.test(v)) return true;
  return nome === "src" && tag === "img" && URL_IMAGEM.test(valor);
}

function limparDom(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const raiz = tpl.content;
  raiz.querySelectorAll(PROIBIDAS.join(",")).forEach((el) => el.remove());
  for (const el of raiz.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "srcdoc" || n === "formaction") el.removeAttribute(a.name);
      else if (ATRIB_URL.has(n) && !urlOk(n, a.value, tag)) el.removeAttribute(a.name);
      else if (n === "style" && ESTILO_RUIM.test(a.value)) el.removeAttribute(a.name);
    }
  }
  return tpl.innerHTML;
}

function limparTexto(html) {
  let s = String(html);
  for (const tag of PROIBIDAS) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");   // bloco inteiro
    s = s.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");                // tag solta
  }
  // atributos: on*, srcdoc; URLs perigosas; estilos perigosos
  s = s.replace(/\s(on[a-z0-9_-]*|srcdoc|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi, (m, tag, attrs) => {
    const limpo = attrs.replace(/\s([a-z:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (am, nome, val) => {
      const n = nome.toLowerCase();
      const v = val.replace(/^["']|["']$/g, "").replace(/&#(x?)([0-9a-f]+);?/gi, (e, x, d) => String.fromCodePoint(parseInt(d, x ? 16 : 10) || 32));
      if (ATRIB_URL.has(n) && !urlOk(n, v, tag.toLowerCase())) return "";
      if (n === "style" && ESTILO_RUIM.test(v)) return "";
      return am;
    });
    return `<${tag}${limpo}>`;
  });
  return s;
}

const temDom = () => typeof document !== "undefined" && typeof HTMLTemplateElement !== "undefined";

/* o mesmo texto é limpo muitas vezes (cada leitura de edição normaliza tudo): guarda os últimos */
const CACHE = new Map();
const CACHE_MAX = 400;

/** HTML rico seguro para innerHTML. Nunca devolve a entrada original sem limpar. */
export function limparHtml(v) {
  const s = String(v ?? "");
  if (!s || !/[<&]/.test(s)) return s;
  const guardado = CACHE.get(s);
  if (guardado !== undefined) return guardado;
  let r = s;
  try { const f = globalThis.foundry?.utils?.cleanHTML; if (typeof f === "function") r = String(f(r) ?? ""); }
  catch (err) { avisarUmaVez(err); }
  r = temDom() ? limparDom(r) : limparTexto(r);
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(s, r);
  return r;
}

let avisado = false;
function avisarUmaVez(err) {
  if (avisado) return;
  avisado = true;
  console.warn("Journal da Mesa | foundry.utils.cleanHTML falhou; usando só a limpeza do Journal.", err);
}

export const _teste = { limparDom, limparTexto, temDom };
