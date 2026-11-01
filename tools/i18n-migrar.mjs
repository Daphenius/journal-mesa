#!/usr/bin/env node
/* Journal da Mesa — ferramenta de idioma (chaves nomeadas).
 *
 * O que faz (rodar na pasta do módulo:  node tools/i18n-migrar.mjs  [--so-conferir]):
 *  1. Varre scripts/**\/*.js e acha toda chamada T("…") / TF("…", …) / C.T("…") com texto literal.
 *  2. Texto em português ainda sem chave ganha uma chave legível "JMESA.<Area>.<Slug>" (Area vem do arquivo;
 *     texto usado em vários arquivos vai para "Comum"). A chamada no código passa a usar a chave.
 *  3. lang/pt-BR.json recebe o texto; lang/en.json recebe a tradução antiga (chave por código "JMESA.t…",
 *     do esquema anterior) ou, se não houver, o próprio texto em português (listado no relatório).
 *     As chaves "JMESA.t…" são removidas; as já legíveis (Jornal, Tema, Config…) ficam como estão.
 *  4. Gera scripts/idioma-mapa.js (texto em português → chave) para os textos que ficam em constantes
 *     e só são traduzidos depois, por traduzirNoLugar() e TD() de idioma.js.
 *  5. Relata as chamadas T( com algo que não é texto literal (variável, template com ${}), que precisam
 *     de tratamento à mão.
 * Rodar duas vezes não muda nada. Com --so-conferir não grava, só relata. */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SO_CONFERIR = process.argv.includes("--so-conferir");
const PREFIXO = "JMESA";
const ARQ_PT = join(RAIZ, "lang/pt-BR.json");
const ARQ_EN = join(RAIZ, "lang/en.json");
const ARQ_MAPA = join(RAIZ, "scripts/idioma-mapa.js");
const IGNORAR = new Set(["scripts/idioma.js", "scripts/idioma-mapa.js"]);
const RE_HASH = /^t[0-9a-z]+$/;                               // chave do esquema antigo (código do texto)
const RE_CHAVE = /^[A-Z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;      // "Area.Slug" (o Jornal tem níveis a mais: "Jornal.Campo.titulo")

/* ---------- área pelo arquivo ---------- */
const AREAS = [
  [/^scripts\/nucleo\.js$/, "Nucleo"], [/^scripts\/journal\.js$/, "Geral"], [/^scripts\/jornal\//, "Jornal"],
  [/^scripts\/lojas\/tabelas\.js$/, "Tabelas"], [/^scripts\/partes\/([a-z]+)\.js$/, (m) => capitalizar(m[1])]
];
function areaDoArquivo(arq) {
  for (const [re, a] of AREAS) { const m = arq.match(re); if (m) return typeof a === "function" ? a(m) : a; }
  return "Geral";
}
function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function semAcento(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function slugDe(texto) {
  const palavras = semAcento(texto.replace(/\{(\w+)\}/g, " $1 ")).split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 5)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  let s = palavras.join("");
  if (!s) s = "Texto";
  if (/^[0-9]/.test(s)) s = `N${s}`;
  return s;
}

/* ---------- JSON aninhado <-> plano ---------- */
function achatar(obj, prefixo = "", saida = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) achatar(v, p, saida); else saida[p] = v;
  }
  return saida;
}
function aninhar(plano) {
  const r = {};
  for (const [k, v] of Object.entries(plano)) {
    const partes = k.split("."); const ultimo = partes.pop();
    let c = r;
    for (const p of partes) { if (typeof c[p] !== "object" || c[p] === null) c[p] = {}; c = c[p]; }
    c[ultimo] = v;
  }
  return r;
}
function lerJson(arq) { return JSON.parse(readFileSync(arq, "utf8")); }

/* ---------- varredura dos scripts ---------- */
function listarJs(dir, saida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) listarJs(p, saida); else if (n.endsWith(".js")) saida.push(p);
  }
  return saida.sort();
}
/** Devolve o texto de um literal JS ("…", '…' ou `…` sem ${}). */
function decodificar(lit) {
  const corpo = lit.slice(1, -1);
  return corpo.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r?\n|.)/gs, (m, c, u1, u2, x) => {
    if (u1) return String.fromCodePoint(parseInt(u1, 16));
    if (u2) return String.fromCharCode(parseInt(u2, 16));
    if (x) return String.fromCharCode(parseInt(x, 16));
    if (/^\r?\n$/.test(c)) return "";
    return { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" }[c] ?? c;
  });
}
function codificar(texto, aspas) {
  const esc = texto.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  if (aspas === "`") return "`" + esc.replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
  return aspas + esc.replace(new RegExp(aspas, "g"), "\\" + aspas) + aspas;
}
const RE_LITERAL = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\$]|\\\\[^]|\\$(?!\\{))*`";
const RE_CHAMADA = new RegExp(String.raw`(?<![\w$.])(?:C\.)?(TF?)\(\s*(${RE_LITERAL})`, "g");
const RE_NAO_LITERAL = new RegExp(String.raw`(?<![\w$.])(?:C\.)?(TF?)\(\s*(?!["'\x60])([^)\n]{0,60})`, "g");
const RE_TEMPLATE_DINAMICO = new RegExp(String.raw`(?<![\w$.])(?:C\.)?(TF?)\(\s*\x60(?:[^\x60\\]|\\[^])*?\$\{`, "g");
function linhaDe(txt, pos) { return txt.slice(0, pos).split("\n").length; }
/** linha de comentário (" * T("…")" ou "// T("…")" explicando o código): não é chamada */
function emComentario(txt, pos) { return /^\s*(\*|\/\/|\/\*)/.test(txt.slice(txt.lastIndexOf("\n", pos - 1) + 1, pos)); }

/* ================= 1. ler o que existe ================= */
const ptNest = lerJson(ARQ_PT), enNest = lerJson(ARQ_EN);
const ptPlano = achatar(ptNest[PREFIXO] ?? {}), enPlano = achatar(enNest[PREFIXO] ?? {});
const ehHash = (k) => RE_HASH.test(k);
const hashPt = Object.fromEntries(Object.entries(ptPlano).filter(([k]) => ehHash(k)));
const hashEn = Object.fromEntries(Object.entries(enPlano).filter(([k]) => ehHash(k)));
const legiveisPt = Object.fromEntries(Object.entries(ptPlano).filter(([k]) => !ehHash(k)));
const legiveisEn = Object.fromEntries(Object.entries(enPlano).filter(([k]) => !ehHash(k)));
/** tradução antiga pelo texto em português */
const enPorTexto = new Map();
for (const [k, v] of Object.entries(hashPt)) if (hashEn[k] !== undefined) enPorTexto.set(v, hashEn[k]);
/** chave gerada já existente pelo texto em português (para não duplicar). As chaves escritas à mão do Jornal
 *  (Tema, Config, Jornal) NÃO são reaproveitadas: o mesmo texto pode ter outro sentido lá ("Ligar" = vincular). */
const GRUPOS_MANUAIS = ["Tema", "Config", "Jornal"];
const chavePorTexto = new Map();
for (const [k, v] of Object.entries(legiveisPt)) if (!GRUPOS_MANUAIS.includes(k.split(".")[0]) && !chavePorTexto.has(v)) chavePorTexto.set(v, k);

/* ================= 2. varrer o código ================= */
const arquivos = listarJs(join(RAIZ, "scripts")).map((p) => relative(RAIZ, p).replace(/\\/g, "/")).filter((a) => !IGNORAR.has(a));
const fontes = Object.fromEntries(arquivos.map((a) => [a, readFileSync(join(RAIZ, a), "utf8")]));
const usos = new Map();          // texto PT -> Set(arquivo)
const chavesUsadas = new Set();  // chaves "Area.Slug" já no código
const naoLiterais = [];
for (const arq of arquivos) {
  const src = fontes[arq];
  for (const m of src.matchAll(RE_CHAMADA)) {
    if (emComentario(src, m.index)) continue;
    const texto = decodificar(m[2]);
    if (RE_CHAVE.test(texto) && legiveisPt[texto] !== undefined) { chavesUsadas.add(texto); continue; }
    if (!usos.has(texto)) usos.set(texto, new Set());
    usos.get(texto).add(arq);
  }
  for (const m of src.matchAll(RE_NAO_LITERAL)) if (!emComentario(src, m.index)) naoLiterais.push(`${arq}:${linhaDe(src, m.index)}  ${m[1]}(${m[2].trim()}`);
  for (const m of src.matchAll(RE_TEMPLATE_DINAMICO)) naoLiterais.push(`${arq}:${linhaDe(src, m.index)}  ${m[1]}(\`…\${…}\` (template com variável)`);
}

/* textos do esquema antigo que não aparecem em T("…"): ficam em constantes (traduzirNoLugar/TD) ou sobraram de
 * versões antigas (não aparecem em lugar nenhum: são descartados e listados) */
const soDados = [], descartados = [];
for (const texto of Object.values(hashPt)) {
  if (usos.has(texto) || chavePorTexto.has(texto)) continue;
  const onde = new Set();
  for (const arq of arquivos) for (const q of ['"', "'", "`"]) if (fontes[arq].includes(codificar(texto, q))) onde.add(arq);
  if (!onde.size) { descartados.push(texto); continue; }
  usos.set(texto, onde);
  soDados.push(texto);
}

/* ================= 3. gerar chaves novas ================= */
const reservadas = new Set(Object.keys(legiveisPt));
const novas = [];                  // { texto, chave, en, semEn }
const semTraducao = [];
for (const texto of [...usos.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
  if (chavePorTexto.has(texto)) continue;   // já migrado (idempotência)
  const arqs = [...usos.get(texto)];
  const areas = new Set(arqs.map(areaDoArquivo));
  const area = areas.size === 1 ? [...areas][0] : (areas.size === 0 ? "Dados" : "Comum");
  const base = `${area}.${slugDe(texto)}`;
  let chave = base, n = 2;
  while (reservadas.has(chave)) chave = `${base}${n++}`;
  reservadas.add(chave);
  chavePorTexto.set(texto, chave);
  const en = enPorTexto.get(texto);
  if (en === undefined) semTraducao.push(`${chave}  ←  ${JSON.stringify(texto)}`);
  novas.push({ texto, chave, en: en ?? texto });
}

/* ================= 4. montar os JSON novos ================= */
const ptNovo = { ...legiveisPt }, enNovo = { ...legiveisEn };
for (const { texto, chave, en } of novas) { ptNovo[chave] = texto; enNovo[chave] = en; }
for (const k of Object.keys(ptNovo)) if (enNovo[k] === undefined) enNovo[k] = ptNovo[k];
/** ordem: grupos escritos à mão (Tema, Config, Jornal: usados por chave direta no código, na ordem do arquivo),
 *  depois as áreas geradas, em ordem alfabética (chaves em ordem alfabética dentro de cada área) */
const gruposAntigos = Object.keys(ptNest[PREFIXO] ?? {}).filter((g) => GRUPOS_MANUAIS.includes(g));
function ordenar(plano) {
  const chaves = Object.keys(plano);
  const posOriginal = new Map(chaves.map((k, i) => [k, i]));
  const grupo = (k) => k.split(".")[0];
  const posGrupo = (g) => { const i = gruposAntigos.indexOf(g); return i >= 0 ? i : gruposAntigos.length; };
  chaves.sort((a, b) => {
    const ga = grupo(a), gb = grupo(b);
    if (ga !== gb) return (posGrupo(ga) - posGrupo(gb)) || ga.localeCompare(gb, "en");
    return posGrupo(ga) < gruposAntigos.length ? posOriginal.get(a) - posOriginal.get(b) : a.localeCompare(b, "en");
  });
  return Object.fromEntries(chaves.map((k) => [k, plano[k]]));
}
const ptSaida = { [PREFIXO]: aninhar(ordenar(ptNovo)) }, enSaida = { [PREFIXO]: aninhar(ordenar(enNovo)) };

/* ================= 5. reescrever as chamadas ================= */
const alterados = [];
let chamadasTrocadas = 0;
for (const arq of arquivos) {
  const novo = fontes[arq].replace(RE_CHAMADA, (m, fn, lit, pos) => {
    if (emComentario(fontes[arq], pos)) return m;
    const texto = decodificar(lit);
    if (RE_CHAVE.test(texto) && legiveisPt[texto] !== undefined) return m;
    const chave = chavePorTexto.get(texto);
    if (!chave) return m;
    chamadasTrocadas++;
    return m.slice(0, m.length - lit.length) + codificar(chave, lit[0]);
  });
  if (novo !== fontes[arq]) { alterados.push(arq); fontes[arq] = novo; }
}

/* ================= 6. mapa texto -> chave (constantes traduzidas depois) ================= */
const mapa = {};
for (const k of Object.keys(ptNovo)) {
  if (gruposAntigos.includes(k.split(".")[0])) continue;   // Jornal, Tema, Config: já são chaves no código
  const texto = ptNovo[k];
  if (mapa[texto] === undefined) mapa[texto] = k;
}
const mapaOrdenado = Object.fromEntries(Object.keys(mapa).sort((a, b) => a.localeCompare(b, "pt-BR")).map((t) => [t, mapa[t]]));
const mapaJs = `/* Journal — gerado por tools/i18n-migrar.mjs; NÃO editar à mão (rode a ferramenta).
 * Texto em português -> chave em lang/. Usado por traduzirNoLugar() e TD() de idioma.js para traduzir
 * os textos que ficam em constantes (tipos, status, ícones, configurações) e só são lidos depois do idioma carregar. */
export const MAPA_PT = ${JSON.stringify(mapaOrdenado, null, 2)};
`;

/* ================= 7. gravar e relatar ================= */
const json = (o) => JSON.stringify(o, null, 2) + "\n";
const mudouPt = json(ptSaida) !== readFileSync(ARQ_PT, "utf8");
const mudouEn = json(enSaida) !== readFileSync(ARQ_EN, "utf8");
const mudouMapa = !existsSync(ARQ_MAPA) || mapaJs !== readFileSync(ARQ_MAPA, "utf8");
if (!SO_CONFERIR) {
  if (mudouPt) writeFileSync(ARQ_PT, json(ptSaida));
  if (mudouEn) writeFileSync(ARQ_EN, json(enSaida));
  if (mudouMapa) writeFileSync(ARQ_MAPA, mapaJs);
  for (const arq of alterados) writeFileSync(join(RAIZ, arq), fontes[arq]);
}

const total = Object.keys(ptNovo).filter((k) => !gruposAntigos.includes(k.split(".")[0])).length;
console.log(`${SO_CONFERIR ? "(só conferindo) " : ""}Journal da Mesa — idioma`);
console.log(`- chaves por código (JMESA.t…) encontradas: ${Object.keys(hashPt).length} (pt-BR), ${Object.keys(hashEn).length} (en)`);
console.log(`- chaves nomeadas novas: ${novas.length} (${soDados.length} delas só em constantes); total de chaves geradas: ${total}`);
console.log(`- chamadas T()/TF() trocadas: ${chamadasTrocadas} em ${alterados.length} arquivo(s)${alterados.length ? ": " + alterados.join(", ") : ""}`);
console.log(`- arquivos ${SO_CONFERIR ? "que mudariam" : "gravados"}: ${[mudouPt && "lang/pt-BR.json", mudouEn && "lang/en.json", mudouMapa && "scripts/idioma-mapa.js", ...alterados].filter(Boolean).join(", ") || "nenhum (nada a fazer)"}`);
if (semTraducao.length) { console.log(`\nSEM tradução em inglês (ficou o português; traduza em lang/en.json): ${semTraducao.length}`); for (const s of semTraducao) console.log("  " + s); }
if (naoLiterais.length) { console.log(`\nChamadas T()/TF() sem texto literal (conferir à mão): ${naoLiterais.length}`); for (const s of naoLiterais) console.log("  " + s); }
if (descartados.length) { console.log(`\nTextos do esquema antigo que não aparecem mais no código (descartados): ${descartados.length}`); for (const t of descartados) console.log("  " + JSON.stringify(t)); }
if (soDados.length && novas.length) { console.log(`\nTextos que estavam só em constantes (traduzidos pelo mapa): ${soDados.length}`); for (const t of soDados) console.log("  " + JSON.stringify(t) + " -> " + chavePorTexto.get(t)); }
