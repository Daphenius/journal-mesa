/* Testes dos arquivos de idioma (Node puro, sem Foundry). Rodar na pasta do módulo:  node tests/i18n.test.mjs
 *  (a) lang/pt-BR.json e lang/en.json têm exatamente as mesmas chaves;
 *  (b) toda chamada T("…")/TF("…")/C.T("…")/t("…") com texto literal no código tem chave nos dois arquivos;
 *  (c) os {campos} de cada chave são os mesmos nos dois idiomas;
 *  (d) não sobrou chave do esquema antigo por código ("JMESA.t…");
 *  (e) scripts/idioma-mapa.js (texto em português → chave) bate com lang/pt-BR.json. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
let passou = 0, falhou = 0;
function ok(cond, msg) { if (cond) passou++; else { falhou++; console.log("FALHOU:", msg); } }

function achatar(obj, prefixo = "", saida = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) achatar(v, p, saida); else saida[p] = v;
  }
  return saida;
}
function listarJs(dir, saida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) listarJs(p, saida); else if (n.endsWith(".js")) saida.push(p);
  }
  return saida.sort();
}
const pt = achatar(JSON.parse(readFileSync(join(RAIZ, "lang/pt-BR.json"), "utf8")));
const en = achatar(JSON.parse(readFileSync(join(RAIZ, "lang/en.json"), "utf8")));

/* (a) mesmas chaves */
const soPt = Object.keys(pt).filter((k) => !(k in en)), soEn = Object.keys(en).filter((k) => !(k in pt));
ok(soPt.length === 0, `chaves só em pt-BR.json: ${soPt.join(", ")}`);
ok(soEn.length === 0, `chaves só em en.json: ${soEn.join(", ")}`);
ok(Object.keys(pt).length > 1000, `poucas chaves em pt-BR.json (${Object.keys(pt).length})`);
for (const k of Object.keys(pt)) {
  ok(typeof pt[k] === "string" && pt[k].length > 0, `valor vazio ou não-texto em pt-BR: ${k}`);
  ok(typeof en[k] === "string" && en[k].length > 0, `valor vazio ou não-texto em en: ${k}`);
}

/* (b) toda chamada literal no código tem chave */
const RE_LITERAL = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\$]|\\\\[^]|\\$(?!\\{))*`";
const RE_CHAMADA = new RegExp(String.raw`(?<![\w$.])(?:C\.)?(?:TF?|t)\(\s*(${RE_LITERAL})`, "g");
const comentario = (txt, pos) => /^\s*(\*|\/\/|\/\*)/.test(txt.slice(txt.lastIndexOf("\n", pos - 1) + 1, pos));
const arquivos = listarJs(join(RAIZ, "scripts")).filter((p) => !/idioma(-mapa)?\.js$/.test(p));
let chamadas = 0;
const chavesUsadas = new Set();
for (const arq of arquivos) {
  const src = readFileSync(arq, "utf8");
  for (const m of src.matchAll(RE_CHAMADA)) {
    if (comentario(src, m.index)) continue;
    const texto = m[1].slice(1, -1);
    const linha = src.slice(0, m.index).split("\n").length;
    const onde = `${relative(RAIZ, arq)}:${linha}`;
    chamadas++;
    ok(/^[A-Z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/.test(texto), `${onde}: texto em vez de chave: ${m[1]}`);
    ok(`JMESA.${texto}` in pt, `${onde}: chave sem texto em pt-BR.json: ${texto}`);
    ok(`JMESA.${texto}` in en, `${onde}: chave sem texto em en.json: ${texto}`);
    chavesUsadas.add(`JMESA.${texto}`);
  }
}
ok(chamadas > 1000, `poucas chamadas T()/TF() encontradas (${chamadas})`);
/* chaves completas escritas direto no código ("JMESA.Nucleo...": configurações, menus, ficha, temas) */
for (const arq of arquivos) {
  const src = readFileSync(arq, "utf8");
  for (const m of src.matchAll(/["'`](JMESA\.[A-Za-z0-9.]+)["'`]/g)) {
    if (comentario(src, m.index)) continue;
    const onde = `${relative(RAIZ, arq)}:${src.slice(0, m.index).split("\n").length}`;
    ok(m[1] in pt && m[1] in en, `${onde}: chave completa sem texto nos dois idiomas: ${m[1]}`);
  }
}

/* (c) mesmos {campos} nos dois idiomas */
const campos = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const k of Object.keys(pt)) if (k in en) ok(campos(pt[k]) === campos(en[k]), `{campos} diferentes em ${k}: pt "${campos(pt[k])}" × en "${campos(en[k])}"`);

/* (d) nada do esquema antigo */
for (const [nome, d] of [["pt-BR", pt], ["en", en]]) {
  const velhas = Object.keys(d).filter((k) => /^JMESA\.t[0-9a-z]+$/.test(k));
  ok(velhas.length === 0, `${nome}.json ainda tem chaves por código: ${velhas.slice(0, 5).join(", ")}…`);
}
for (const arq of [...arquivos, join(RAIZ, "scripts/idioma.js")]) {
  const src = readFileSync(arq, "utf8");
  ok(!/JMESA\.t[0-9a-z]/.test(src) && !/chaveI18n/.test(src), `${relative(RAIZ, arq)} ainda usa o esquema antigo`);
}

/* (e) mapa texto -> chave bate com pt-BR.json */
const { MAPA_PT } = await import("../scripts/idioma-mapa.js");
for (const [texto, chave] of Object.entries(MAPA_PT)) ok(pt[`JMESA.${chave}`] === texto, `idioma-mapa.js: "${chave}" não bate com pt-BR.json`);
const geradas = Object.keys(pt).filter((k) => !/^JMESA\.(Tema|Config|Jornal)\./.test(k));
const faltamNoMapa = geradas.filter((k) => MAPA_PT[pt[k]] === undefined);
ok(faltamNoMapa.length === 0, `textos sem entrada em idioma-mapa.js (rode node tools/i18n-migrar.mjs): ${faltamNoMapa.slice(0, 5).join(", ")}`);

console.log(`\n${passou} passaram, ${falhou} falharam (${Object.keys(pt).length} chaves, ${chamadas} chamadas no código)`);
process.exit(falhou ? 1 : 0);
