/* Ícones do calendário (Node puro): cada ícone é ["fa-nome", "Rótulo"], sem repetidos, e todo rótulo tem tradução.
 * Rodar na pasta do módulo:  node tests/icones.test.mjs
 * (a 5.7.1 saiu com os ícones novos aninhados dentro do último ícone de cada grupo; isto pega esse tipo de erro) */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
let passou = 0, falhou = 0;
const ok = (c, m) => { if (c) passou++; else { falhou++; console.log("FALHOU:", m); } };

const s = readFileSync(join(RAIZ, "scripts/partes/calendario.js"), "utf8");
const trecho = s.slice(s.indexOf("const CAL_ICONES_GRUPOS"), s.indexOf("const CAL_ICONES ="));
const grupos = (0, eval)(trecho.replace(/^const \w+ = /, "").trim().replace(/;$/, ""));
const mapa = readFileSync(join(RAIZ, "scripts/idioma-mapa.js"), "utf8");
const vistos = new Set();
for (const [nome, lista] of grupos) {
  ok(typeof nome === "string" && Array.isArray(lista) && lista.length > 0, `grupo inválido: ${nome}`);
  ok(mapa.includes(`"${nome}":`), `grupo sem tradução: ${nome}`);
  for (const item of lista) {
    ok(Array.isArray(item) && item.length === 2 && item.every((x) => typeof x === "string"), `ícone mal formado em "${nome}": ${JSON.stringify(item).slice(0, 80)}`);
    const [icone, rotulo] = item;
    ok(/^fa-[a-z0-9-]+$/.test(icone), `nome de ícone inválido: ${icone}`);
    ok(!vistos.has(icone), `ícone repetido: ${icone}`);
    vistos.add(icone);
    ok(mapa.includes(`"${rotulo}":`), `rótulo sem tradução: ${rotulo}`);
  }
}
ok(vistos.size >= 100, `poucos ícones (${vistos.size})`);
console.log(`ícones do calendário: ${passou} ok, ${falhou} falhas (${vistos.size} ícones)`);
if (falhou) process.exit(1);
