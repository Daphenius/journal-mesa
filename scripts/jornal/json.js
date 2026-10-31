/* Jornal de Notícias — exportar e importar edições em JSON (só o mestre).
 *
 * Formato (o mesmo na exportação e na importação; uma edição, uma lista ou { "edicoes": [...] }):
 * {
 *   "formato": "journal-mesa.edicao", "versao": 1,
 *   "numero": 3,                                  // opcional (sem número: o próximo do jornal)
 *   "data": { "dia": 30, "mes": 4, "ano": 742 },  // ou um texto livre: "30 de Ignis, Ano 742"
 *   "manchete": { "titulo": "", "subtitulo": "", "texto": "", "editor": "", "imagem": "" },
 *   "materias": [ { "secao": "noticia|rumor|aviso|classificado", "titulo": "", "texto": "",
 *                   "categoria": "", "autor": "", "imagem": "",
 *                   "vinculos": ["Capitão Orlen", "JournalEntry.abc..."],   // nome ou UUID
 *                   "segredo": { "veracidade": "manipulada", "nota": "" } } ],   // só o mestre
 *   "rodape": "", "notaDoMestre": ""
 * }
 * Texto pode ser texto simples (parágrafos separados por linha em branco) ou HTML.
 * Vínculos por nome são procurados nos Diários (NPCs, locais...) e nos atores; nome que não existe ou
 * que aparece em mais de um documento é avisado e fica de fora. */
import { J } from "./contexto.js";
import { t } from "./i18n.js";
import { ehJornal, ehEdicao, lerEdicao, normalizarEdicao, edicaoPadrao, materiaPadrao, proximoNumero, criarEdicao, uuidValido, docDe, VERACIDADE, SECOES, LIMITES } from "./dados.js";
import { segredosDe, gravarSegredos } from "./redacao.js";
import { fotoAutomatica } from "./leitura.js";

const SECAO_SINONIMOS = {
  noticia: "noticia", noticias: "noticia", "notícia": "noticia", "notícias": "noticia", news: "noticia", story: "noticia",
  rumor: "rumor", rumores: "rumor", rumors: "rumor", rumour: "rumor", boato: "rumor",
  aviso: "aviso", avisos: "aviso", notice: "aviso", comunicado: "aviso", decreto: "aviso",
  classificado: "classificado", classificados: "classificado", anuncio: "classificado", "anúncio": "classificado", anuncios: "classificado", ad: "classificado", ads: "classificado", classified: "classificado"
};
const VERDADE_SINONIMOS = { verdadeira: "verdadeira", verdade: "verdadeira", true: "verdadeira", rumor: "rumor", manipulada: "manipulada", manipulated: "manipulada", propaganda: "propaganda", "nao confirmada": "naoConfirmada", "não confirmada": "naoConfirmada", naoConfirmada: "naoConfirmada", unconfirmed: "naoConfirmada", oficial: "oficial", official: "oficial" };

const FORMATO = "journal-mesa.edicao";
const VERSAO = 1;
/* limites da importação: um texto colado ou arquivo grande demais trava a janela do mestre */
const MAX_CARACTERES = 2_000_000;
const MAX_EDICOES = 50;
const CAMPOS_EDICAO = ["manchete", "titulo", "subtitulo", "texto", "materias", "rodape", "notaDoMestre"];

/* ---------- exportar ---------- */

const htmlParaTexto = (h) => String(h ?? "").replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
const ehHtmlRico = (h) => /<(h\d|ul|ol|li|table|img|a |strong|em|b>|i>|blockquote)/i.test(String(h ?? ""));
const textoDe = (h) => (ehHtmlRico(h) ? h : htmlParaTexto(h));

/** Objeto JSON de uma edição (com os segredos, se pedido: o arquivo fica com o mestre). */
export function edicaoParaJson(p, { segredos = true } = {}) {
  const ed = lerEdicao(p);
  const seg = segredos ? segredosDe(p.id) : { nota: "", materias: {} };
  let data = ed.dataTexto || "";
  if (ed.td != null && J.Tempo.ok()) { const pt = J.Tempo.partes(ed.td); data = { dia: pt.dia, mes: pt.mes + 1, ano: pt.ano }; }
  return {
    formato: FORMATO, versao: VERSAO, jornal: p.parent.name,
    numero: ed.numero, data,
    manchete: { titulo: ed.titulo, subtitulo: ed.subtitulo, texto: textoDe(ed.texto), editor: ed.editor, imagem: ed.imagem },
    materias: ed.materias.map((m) => {
      const s = seg.materias[m.id];
      return {
        secao: m.secao, titulo: m.titulo, texto: textoDe(m.texto), categoria: m.categoria, autor: m.autor, imagem: m.imagem,
        vinculos: m.vinculos, fotos: m.fotos,
        ...(s?.verdade || s?.nota ? { segredo: { veracidade: s.verdade || "", nota: s.nota || "" } } : {})
      };
    }),
    rodape: ed.rodape, ...(seg.nota ? { notaDoMestre: seg.nota } : {})
  };
}

/** Salva o JSON num arquivo. Usa o saveDataToFile do Foundry; o link de download NÃO pode ser posto na
 *  página: o Foundry intercepta cliques em links no corpo da página (abre em outra janela) e o arquivo não
 *  era salvo (erro da 4.8). Por isso a alternativa dispara o clique num link solto, fora da página. */
export function baixarJson(obj, nome) {
  const texto = JSON.stringify(obj, null, 2);
  const arquivo = nome.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  const salvar = globalThis.foundry?.utils?.saveDataToFile;
  if (typeof salvar === "function") return salvar(texto, "application/json", arquivo);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  a.download = arquivo;
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function exportarEdicao(p) {
  if (!game.user.isGM || !ehEdicao(p)) return;
  ui.notifications.info(t("Jornal.Json.Exportado", { nome: p.name }));
  baixarJson(edicaoParaJson(p), `${p.parent.name}-n${lerEdicao(p).numero}.json`);
}

/* ---------- importar ---------- */

/** Acha um documento pelo nome (Diários que não são jornais, e atores). Único ou nada. */
function acharPorNome(nome) {
  const n = String(nome ?? "").trim().toLowerCase();
  if (!n) return { uuid: null, motivo: "vazio" };
  const docs = [...game.journal.filter((j) => !ehJornal(j)), ...game.actors];
  let l = docs.filter((d) => d.name.trim().toLowerCase() === n);
  if (l.length > 1) { const sem = l.filter((d) => d.documentName === "JournalEntry"); if (sem.length === 1) l = sem; }
  if (l.length === 1) return { uuid: l[0].uuid };
  return { uuid: null, motivo: l.length ? "repetido" : "naoAchado" };
}
function resolverVinculos(lista, relatorio) {
  const r = [];
  for (const v of Array.isArray(lista) ? lista : []) {
    if (typeof v !== "string") continue;
    if (uuidValido(v) && docDe(v)) { r.push(v); continue; }
    const { uuid, motivo } = acharPorNome(v);
    if (uuid) r.push(uuid); else relatorio.push(t(motivo === "repetido" ? "Jornal.Json.NomeRepetido" : "Jornal.Json.NomeNaoAchado", { nome: v }));
  }
  return [...new Set(r)];
}
const paraHtml = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return s.split(/\n\s*\n/).map((par) => `<p>${J.esc(par.trim()).replace(/\n/g, "<br>")}</p>`).join("");
};

/** Lê o texto colado ou do arquivo e devolve a lista de edições em bruto. */
export function lerJson(texto) {
  let s = String(texto ?? "").trim();
  if (s.length > MAX_CARACTERES) throw new Error(t("Jornal.Json.Grande", { n: Math.round(MAX_CARACTERES / 1e6) }));
  // aceita o JSON dentro de um bloco ```json ... ```
  const bloco = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloco) s = bloco[1].trim();
  let d;
  try { d = JSON.parse(s); } catch (err) { throw new Error(t("Jornal.Json.Invalido", { erro: err.message })); }
  const lista = Array.isArray(d) ? d : Array.isArray(d?.edicoes) ? d.edicoes : [d];
  if (!lista.length || !lista.every((x) => x && typeof x === "object" && !Array.isArray(x))) throw new Error(t("Jornal.Json.SemEdicao"));
  if (lista.length > MAX_EDICOES) throw new Error(t("Jornal.Json.MuitasEdicoes", { n: MAX_EDICOES }));
  // nada reconhecível (nem manchete, nem matérias...): provavelmente é outro tipo de JSON
  if (!lista.some((x) => CAMPOS_EDICAO.some((c) => x[c] != null))) throw new Error(t("Jornal.Json.SemEdicao"));
  return lista;
}

/** Converte uma edição em bruto para os dados do Journal: { ed, seg, relatorio }. */
/* campo de texto do JSON: aceita texto e número; objeto, lista ou nulo viram "" */
const str = (v) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

export function converterEdicao(bruto, entry, numeroPadrao) {
  const relatorio = [];
  if (bruto.formato != null && bruto.formato !== FORMATO) relatorio.push(t("Jornal.Json.FormatoOutro", { formato: str(bruto.formato) || "?" }));
  if (Number(bruto.versao) > VERSAO) relatorio.push(t("Jornal.Json.VersaoNova", { v: str(bruto.versao) }));
  const m0 = bruto.manchete && typeof bruto.manchete === "object" ? bruto.manchete : {};
  const ed = edicaoPadrao(Number.isFinite(Number(bruto.numero)) && Number(bruto.numero) > 0 ? Math.trunc(Number(bruto.numero)) : numeroPadrao, null);
  // data: { dia, mes (1..), ano } ou texto
  const dt = bruto.data;
  if (dt && typeof dt === "object" && J.Tempo.ok()) {
    const td = J.Tempo.tdDe(Number(dt.ano), Number(dt.mes) - 1, Number(dt.dia));
    if (td != null) ed.td = td; else relatorio.push(t("Jornal.Json.DataInvalida"));
  } else if (typeof dt === "string" && dt.trim()) { ed.dataTexto = dt.trim(); if (J.Tempo.ok()) ed.td = J.Tempo.hoje(); }
  else if (J.Tempo.ok()) ed.td = J.Tempo.hoje();
  Object.assign(ed, {
    titulo: str(m0.titulo ?? bruto.titulo), subtitulo: str(m0.subtitulo ?? bruto.subtitulo), texto: paraHtml(str(m0.texto ?? bruto.texto)),
    editor: str(m0.editor ?? m0.autor ?? bruto.editor), imagem: str(m0.imagem ?? bruto.imagem), rodape: str(bruto.rodape)
  });
  const seg = { nota: str(bruto.notaDoMestre ?? bruto.nota), materias: {} };
  const brutas = (Array.isArray(bruto.materias) ? bruto.materias : []).filter((mb) => mb && typeof mb === "object" && !Array.isArray(mb));
  if (brutas.length > LIMITES.materias) relatorio.push(t("Jornal.Json.MateriasCortadas", { n: LIMITES.materias, total: brutas.length }));
  for (const mb of brutas.slice(0, LIMITES.materias)) {
    const secao = SECAO_SINONIMOS[str(mb.secao || "noticia").toLowerCase().trim()] ?? "noticia";
    const m = { ...materiaPadrao(secao), titulo: str(mb.titulo), texto: paraHtml(str(mb.texto)), categoria: str(mb.categoria), autor: str(mb.autor), imagem: str(mb.imagem) };
    m.vinculos = resolverVinculos(mb.vinculos, relatorio);
    m.fotos = Array.isArray(mb.fotos) ? mb.fotos.filter((u) => m.vinculos.includes(u)) : m.vinculos.filter(fotoAutomatica);
    const sg = mb.segredo && typeof mb.segredo === "object" ? mb.segredo : {};
    const vb = str(sg.veracidade ?? sg.verdade).trim();
    const verdade = VERDADE_SINONIMOS[vb] ?? VERDADE_SINONIMOS[vb.toLowerCase()] ?? (VERACIDADE[vb] ? vb : "");
    if (vb && !verdade) relatorio.push(t("Jornal.Json.VeracidadeDesconhecida", { v: vb }));
    if (verdade || str(sg.nota)) seg.materias[m.id] = { verdade, nota: str(sg.nota) };
    ed.materias.push(m);
  }
  return { ed: normalizarEdicao(ed), seg, relatorio };
}

/** Cria edições (rascunho) no jornal a partir do JSON. Devolve as páginas criadas e o relatório. */
export async function importarNoJornal(entry, texto) {
  if (!game.user.isGM || !ehJornal(entry)) return { paginas: [], relatorio: [] };
  const lista = lerJson(texto);      // JSON inválido: erro antes de criar qualquer coisa
  const paginas = [], relatorio = [];
  const numeros = new Set(entry.pages.contents.map((p) => lerEdicao(p)?.numero).filter(Boolean));
  for (const bruto of lista) {
    // número: o do JSON ou o próximo do jornal; a edição é criada já completa (uma gravação só)
    const { ed, seg, relatorio: rel } = converterEdicao(bruto, entry, proximoNumero(entry));
    relatorio.push(...rel);
    if (numeros.has(ed.numero)) relatorio.push(t("Jornal.Json.NumeroRepetido", { n: ed.numero }));
    const p = await criarEdicao(entry, ed);
    if (!p) continue;
    numeros.add(ed.numero);
    paginas.push(p);
    // as matérias mantêm os ids do converter (normalizar preserva ids válidos): os segredos vão por id
    const ids = lerEdicao(p).materias.map((m) => m.id);
    if (seg.nota || Object.keys(seg.materias).length) {
      try { await gravarSegredos(p.id, seg, ids); }
      catch (err) { console.error("Journal da Mesa | segredos da edição importada", err); relatorio.push(t("Jornal.Json.SegredosFalhou", { n: ed.numero })); }
    }
  }
  return { paginas, relatorio };
}

/** Duplica uma edição como rascunho novo (próximo número, data de hoje). */
export async function novaAPartirDe(p) {
  if (!game.user.isGM || !ehEdicao(p)) return null;
  const obj = edicaoParaJson(p);
  delete obj.numero; delete obj.data;
  const { paginas } = await importarNoJornal(p.parent, JSON.stringify(obj));
  return paginas[0] ?? null;
}

/** Janela de importação: colar (ou escolher arquivo) e importar no jornal. */
export async function dialogoImportar(entry, { destino = "jornal" } = {}) {
  if (!game.user.isGM || !ehJornal(entry)) return null;
  const e = J.esc;
  const r = await J.Dialogo().prompt({
    window: { title: t(destino === "jornal" ? "Jornal.Json.ImportarTitulo" : "Jornal.Json.ImportarAquiTitulo"), icon: "fa-solid fa-file-import" },
    position: { width: 620 },
    content: `<div class="jm-form-dialogo jmj-importar">
      <p class="jm-dica">${e(t(destino === "jornal" ? "Jornal.Json.ImportarDica" : "Jornal.Json.ImportarAquiDica"))}</p>
      <label>${e(t("Jornal.Json.Colar"))} <textarea name="texto" rows="12" placeholder='{ "manchete": { "titulo": "..." }, "materias": [ ... ] }'></textarea></label>
      <label>${e(t("Jornal.Json.OuArquivo"))} <input type="file" name="arquivo" accept=".json,application/json,text/plain"></label>
    </div>`,
    ok: { label: t("Jornal.Json.Importar"), icon: "fa-solid fa-file-import", callback: (ev, b) => ({ texto: b.form.elements.texto.value, arquivo: b.form.elements.arquivo.files?.[0] ?? null }) }
  }).catch(() => null);
  if (!r) return null;
  const texto = r.arquivo ? await r.arquivo.text() : r.texto;
  if (!String(texto ?? "").trim()) { ui.notifications.warn(t("Jornal.Json.Vazio")); return null; }
  return texto;
}

export function mostrarRelatorio(relatorio) {
  if (!relatorio.length) return;
  const unicos = [...new Set(relatorio)];
  ui.notifications.warn(`${t("Jornal.Json.Avisos")}: ${unicos.slice(0, 4).join(" · ")}${unicos.length > 4 ? " …" : ""}`);
  console.warn("Journal da Mesa | importação de jornal:", unicos);
}

export { SECOES };
