/* Foundry simulado (Node) para os testes do Journal da Mesa.
 * Não é o Foundry: imita só o que o módulo usa (documentos com update() por caminho, flags, coleções,
 * ganchos, configurações, diálogos). Serve para testar a lógica dos dados, não a interface. */

const PLANO = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

export class ForcedDeletion {}

function deepClone(o) {
  if (o === null || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(deepClone);
  if (o instanceof ForcedDeletion) return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = deepClone(v);
  return r;
}
function expandObject(obj) {
  const r = {};
  for (const [k, v] of Object.entries(obj)) setProperty(r, k, PLANO(v) ? expandObject(v) : v);
  return r;
}
function flattenObject(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (PLANO(v) && Object.keys(v).length) flattenObject(v, p, out); else out[p] = v;
  }
  return out;
}
function getProperty(obj, path) {
  let c = obj;
  for (const p of String(path).split(".")) { if (c == null) return undefined; c = c[p]; }
  return c;
}
function hasProperty(obj, path) { return getProperty(obj, path) !== undefined; }
function setProperty(obj, path, value) {
  const partes = String(path).split("."); const ultimo = partes.pop();
  let c = obj;
  for (const p of partes) { if (!PLANO(c[p]) && !Array.isArray(c[p])) c[p] = {}; c = c[p]; }
  c[ultimo] = value; return true;
}
/** Mescla como o Foundry: objetos simples mesclam; o resto substitui. "-=chave" e ForcedDeletion apagam. */
function mergeInto(alvo, mudancas) {
  for (const [k, v] of Object.entries(mudancas)) {
    if (k.startsWith("-=")) { delete alvo[k.slice(2)]; continue; }
    if (v instanceof ForcedDeletion) { delete alvo[k]; continue; }
    if (PLANO(v) && PLANO(alvo[k])) mergeInto(alvo[k], v);
    else alvo[k] = deepClone(v);
  }
  return alvo;
}
function mergeObject(original, other = {}, { inplace = true } = {}) {
  const alvo = inplace ? original : deepClone(original);
  return mergeInto(alvo, expandObject(other));
}
let _id = 0;
const ALFA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomID(n = 16) { _id++; let s = ""; let x = _id; for (let i = 0; i < n; i++) { s += ALFA[(x + i * 7) % ALFA.length]; x = (x * 31 + 7) % 1000003; } return s; }
const debounce = (fn) => { const f = (...a) => fn(...a); return f; };

/* ---------- ganchos ---------- */
const hooks = {};
export const Hooks = {
  on(n, fn) { (hooks[n] ??= []).push(fn); return fn; },
  once(n, fn) { const w = (...a) => { Hooks.off(n, w); return fn(...a); }; return Hooks.on(n, w); },
  off(n, fn) { hooks[n] = (hooks[n] ?? []).filter((f) => f !== fn); },
  call(n, ...a) { for (const f of [...(hooks[n] ?? [])]) if (f(...a) === false) return false; return true; },
  callAll(n, ...a) { for (const f of [...(hooks[n] ?? [])]) f(...a); return true; },
  _limpar() { for (const k of Object.keys(hooks)) delete hooks[k]; }
};

/* ---------- coleções e documentos ---------- */
export class Colecao extends Map {
  [Symbol.iterator]() { return this.values(); }   // como a Collection do Foundry: itera os documentos
  get contents() { return [...this.values()]; }
  filter(fn) { return this.contents.filter(fn); }
  find(fn) { return this.contents.find(fn); }
  some(fn) { return this.contents.some(fn); }
  map(fn) { return this.contents.map(fn); }
  getName(n) { return this.contents.find((d) => d.name === n); }
}

const NIVEIS = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };
export const CONST = { DOCUMENT_OWNERSHIP_LEVELS: NIVEIS, SETTING_SCOPES: { USER: "user", CLIENT: "client", WORLD: "world" }, SORT_INTEGER_DENSITY: 100000 };

export const mundo = { journal: new Colecao(), folders: new Colecao(), items: new Colecao(), actors: new Colecao(), users: new Colecao(), tables: new Colecao(), messages: [] };
const colecaoDe = { JournalEntry: "journal", Folder: "folders", Item: "items", Actor: "actors", User: "users", RollTable: "tables" };

export class Documento {
  static documentName = "Documento";
  constructor(data = {}, { parent = null } = {}) {
    this.parent = parent;
    this._source = deepClone(data);
    this._source._id ??= randomID();
    this._source.flags ??= {};
    this._source.ownership ??= { default: 0 };
    this._aplicar();
  }
  _aplicar() {
    for (const [k, v] of Object.entries(this._source)) if (k !== "_id") this[k] = v;
    this.id = this._source._id;
  }
  get documentName() { return this.constructor.documentName; }
  get uuid() { return this.parent ? `${this.parent.uuid}.${this.documentName}.${this.id}` : `${this.documentName}.${this.id}`; }
  get isOwner() { return true; }
  toObject() { return deepClone(this._source); }
  getFlag(escopo, chave) { return getProperty(this._source.flags?.[escopo] ?? {}, chave); }
  async setFlag(escopo, chave, valor) { return this.update({ [`flags.${escopo}.${chave}`]: valor }); }
  async unsetFlag(escopo, chave) { const i = chave.lastIndexOf("."); const base = i < 0 ? `flags.${escopo}` : `flags.${escopo}.${chave.slice(0, i)}`; const k = i < 0 ? chave : chave.slice(i + 1); return this.update({ [`${base}.-=${k}`]: null }); }
  testUserPermission(user, nivel) { if (user?.isGM) return true; const n = typeof nivel === "string" ? NIVEIS[nivel] : nivel; const own = this._source.ownership ?? {}; return Math.max(own.default ?? 0, own[user?.id] ?? 0) >= n; }
  async update(mudancas = {}) {
    mergeInto(this._source, expandObject(mudancas));
    this._aplicar();
    this.constructor._registrar.push({ doc: this, mudancas: deepClone(mudancas) });
    Hooks.callAll(`update${this.documentName}`, this, expandObject(deepClone(mudancas)), {}, game.user.id);
    return this;
  }
  static _registrar = [];
  async delete() {
    // um item dentro de uma ficha sai da ficha; um documento do mundo sai da coleção dele
    if (this.parent?.items?.has(this.id)) this.parent.items.delete(this.id);
    const col = mundo[colecaoDe[this.documentName]];
    col?.delete(this.id);
    Hooks.callAll(`delete${this.documentName}`, this, {}, game.user.id);
  }
  static async create(data, opcoes = {}) {
    const doc = new this(data);
    const col = mundo[colecaoDe[this.documentName]];
    col?.set(doc.id, doc);
    Hooks.callAll(`create${this.documentName}`, doc, opcoes, game.user.id);
    return doc;
  }
}

export class JournalEntryPage extends Documento {
  static documentName = "JournalEntryPage";
  constructor(data, opts) { super({ type: "text", sort: 0, text: {}, ...data }, opts); }
}
export class JournalEntry extends Documento {
  static documentName = "JournalEntry";
  constructor(data = {}) {
    const { pages = [], ...resto } = data;
    super(resto);
    this.pages = new Colecao();
    for (const p of pages) { const pg = new JournalEntryPage(p, { parent: this }); this.pages.set(pg.id, pg); }
  }
  _aplicar() { super._aplicar(); this.folder = this._source.folder ? mundo.folders.get(this._source.folder) ?? null : null; }
  toObject() { const o = super.toObject(); o.pages = this.pages.contents.map((p) => p.toObject()); return o; }
  async updateEmbeddedDocuments(nome, lista) {
    const out = [];
    for (const { _id, ...mud } of lista) { const pg = this.pages.get(_id); if (pg) out.push(await pg.update(mud)); }
    return out;
  }
  async createEmbeddedDocuments(nome, lista) {
    return lista.map((d) => { const pg = new JournalEntryPage(d, { parent: this }); this.pages.set(pg.id, pg); Hooks.callAll("createJournalEntryPage", pg, {}, game.user.id); return pg; });
  }
}
export class Folder extends Documento {
  static documentName = "Folder";
  _aplicar() { super._aplicar(); this.folder = this._source.folder ? mundo.folders.get(this._source.folder) ?? null : null; }
}
export class Item extends Documento {
  static documentName = "Item";
  constructor(data, opts) { super({ type: "loot", img: "", system: {}, ...data }, opts); }
}
export class Actor extends Documento {
  static documentName = "Actor";
  constructor(data = {}) {
    const { items = [], ...resto } = data;
    super({ type: "character", system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } }, ...resto });
    this.items = new Colecao();
    for (const i of items) { const it = new Item(i, { parent: this }); this.items.set(it.id, it); }
  }
  async createEmbeddedDocuments(nome, lista) {
    return lista.map((d) => { const it = new Item(d, { parent: this }); this.items.set(it.id, it); return it; });
  }
  async deleteEmbeddedDocuments(nome, ids) {
    return ids.map((id) => { const it = this.items.get(id); if (it) this.items.delete(id); return it; }).filter(Boolean);
  }
  /** Mínimo do Actor.updateDocuments do Foundry: cada { _id, ...mudanças } atualiza a ficha com esse id. */
  static async updateDocuments(lista) {
    const out = [];
    for (const { _id, ...mud } of lista) { const a = mundo.actors.get(_id); if (!a) throw new Error(`Actor ${_id} não existe`); out.push(await a.update(mud)); }
    return out;
  }
}
export class User extends Documento { static documentName = "User"; get isGM() { return !!this._source.role && this._source.role >= 4; } }

export function fromUuidSync(uuid) {
  if (!uuid) return null;
  const partes = String(uuid).split(".");
  let doc = null;
  for (let i = 0; i < partes.length; i += 2) {
    const tipo = partes[i], id = partes[i + 1];
    if (!doc) doc = mundo[colecaoDe[tipo]]?.get(id) ?? null;
    else if (tipo === "JournalEntryPage") doc = doc.pages?.get(id) ?? null;
    else if (tipo === "Item") doc = doc.items?.get(id) ?? null;
    else doc = null;
    if (!doc) return null;
  }
  return doc;
}
export const fromUuid = async (u) => fromUuidSync(u);

/* ---------- jogo ---------- */
const settingsReg = new Map(); const settingsVal = new Map();
export const game = {
  user: null,
  users: mundo.users,
  get journal() { return mundo.journal; },
  get folders() { return mundo.folders; },
  get items() { return mundo.items; },
  get actors() { return mundo.actors; },
  get tables() { return mundo.tables; },
  modules: { get: (id) => game._modulos[id] ?? { active: false } },
  _modulos: {},
  system: { id: "dnd5e", version: "6.0.6" },
  i18n: { lang: "pt-BR", _d: {}, has(k) { return k in this._d; }, localize(k) { return this._d[k] ?? k; }, format(k, d) { return (this._d[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => d?.[n] ?? m); } },
  settings: {
    register(mod, k, cfg) { settingsReg.set(`${mod}.${k}`, cfg); if (!settingsVal.has(`${mod}.${k}`)) settingsVal.set(`${mod}.${k}`, deepClone(cfg.default)); },
    registerMenu() {},
    get(mod, k) { if (!settingsReg.has(`${mod}.${k}`)) throw new Error(`setting ${mod}.${k} não registrada`); return settingsVal.get(`${mod}.${k}`); },
    async set(mod, k, v) { settingsVal.set(`${mod}.${k}`, deepClone(v)); settingsReg.get(`${mod}.${k}`)?.onChange?.(v); return v; },
    _zerar() { for (const [k, cfg] of settingsReg) settingsVal.set(k, deepClone(cfg.default)); }
  },
  time: { worldTime: 0, async advance(n) { this.worldTime += n; } },
  combats: new Colecao(),
  scenes: { current: null },
  socket: { on() {}, emit() {} },
  keybindings: { register() {} },
  clipboard: { copyPlainText: async () => {} },
  packs: new Colecao()
};
export const ui = {
  notifications: { _l: [], info(m) { this._l.push(["info", m]); }, warn(m) { this._l.push(["warn", m]); }, error(m) { this._l.push(["error", m]); } },
  journal: { render() {} }, sidebar: { tabs: {} }
};

/* ---------- diálogos: respostas programadas ---------- */
export const dialogos = { respostas: [], registro: [] };
class DialogV2 {
  static async confirm(cfg) { dialogos.registro.push({ tipo: "confirm", cfg }); return dialogos.respostas.length ? dialogos.respostas.shift() : true; }
  static async prompt(cfg) { dialogos.registro.push({ tipo: "prompt", cfg }); return dialogos.respostas.length ? dialogos.respostas.shift() : true; }
  static async wait(cfg) { dialogos.registro.push({ tipo: "wait", cfg }); return dialogos.respostas.length ? dialogos.respostas.shift() : null; }
}
class ApplicationV2 {
  constructor(o = {}) { this.options = o; this.rendered = false; }
  static DEFAULT_OPTIONS = {};
  async render() { this.rendered = true; return this; }
  async close() { this.rendered = false; }
  get element() { return null; }
}
const HandlebarsApplicationMixin = (B) => class extends B {};

export const foundry = {
  utils: { deepClone, mergeObject, getProperty, setProperty, hasProperty, expandObject, flattenObject, randomID, debounce, isEmpty: (o) => !o || !Object.keys(o).length, duplicate: deepClone,
    saveDataToFile(texto, tipo, nome) { foundry._arquivos.push({ nome, texto }); } },
  _arquivos: [],
  data: { operators: { ForcedDeletion } },
  applications: { api: { ApplicationV2, DialogV2, HandlebarsApplicationMixin }, apps: { DocumentSheetConfig: { registerSheet() {} }, FilePicker: class {} }, sheets: { journal: { JournalEntrySheet: class {} } }, ux: { TextEditor: { implementation: { enrichHTML: async (s) => s, getDragEventData: () => ({}) } } } },
  documents: { collections: {} }
};

export class ChatMessage extends Documento {
  static documentName = "ChatMessage";
  static getSpeaker() { return {}; }
  static async create(d) { mundo.messages.push(d); return new ChatMessage(d); }
}

/* ---------- instalação dos globais ---------- */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Carrega lang/<idioma>.json no game.i18n (chaves achatadas, como o Foundry). */
export function carregarIdioma(lang = "pt-BR") {
  const d = JSON.parse(fs.readFileSync(path.join(RAIZ, "lang", `${lang}.json`), "utf8"));
  game.i18n.lang = lang; game.i18n._d = flattenObject(d);
}

export function instalar() {
  const g = globalThis;
  // o Jornal busca lang/*.json pela rede; aqui lê do disco
  g.fetch = async (url) => {
    const m = String(url).match(/lang\/([\w-]+)\.json/);
    const texto = m ? fs.readFileSync(path.join(RAIZ, "lang", `${m[1]}.json`), "utf8") : "{}";
    return { ok: true, json: async () => JSON.parse(texto) };
  };
  Object.assign(g, { Hooks, CONST, game, ui, foundry, JournalEntry, JournalEntryPage, Folder, Item, Actor, ChatMessage, fromUuid, fromUuidSync });
  g.TextEditor = foundry.applications.ux.TextEditor.implementation;
  const elemento = () => ({
    style: {}, dataset: {}, innerHTML: "", textContent: "", children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    append() {}, appendChild() {}, prepend() {}, remove() {}, replaceWith() {}, insertAdjacentHTML() {},
    querySelector() { return elemento(); }, querySelectorAll() { return []; }, closest() { return null; },
    addEventListener() {}, removeEventListener() {}, focus() {}, click() {}, getBoundingClientRect() { return { width: 0, height: 0, top: 0, left: 0 }; }
  });
  g.document = { ...elemento(), body: elemento(), documentElement: elemento(), head: elemento(), createElement: elemento, createRange() { return { createContextualFragment: () => elemento() }; } };
  g.window = g;
  g.CONFIG = { DND5E: { currencies: { pp: { conversion: 0.1 }, gp: { conversion: 1 }, ep: { conversion: 2 }, sp: { conversion: 10 }, cp: { conversion: 100 } } }, JournalEntry: { sheetClasses: {} } };
  g.Roll = class { constructor(f) { this.formula = f; this.total = 10; } async evaluate() { return this; } async roll() { return this; } };
  g.SceneNavigation = { displayProgressBar() {} };
  g.Dialog = class {};
}

/** Começa um mundo limpo com um mestre e um jogador. */
export function novoMundo({ monks = false } = {}) {
  for (const c of Object.values(mundo)) { if (c instanceof Map) c.clear(); else c.length = 0; }
  game._modulos = { "journal-mesa": { active: true, api: {} }, "monks-enhanced-journal": { active: monks } };
  const gm = new User({ _id: "GMGMGMGMGMGMGMGM", name: "Mestre", role: 4 });
  const jog = new User({ _id: "JOGADORJOGADOR01", name: "Ana", role: 1 });
  mundo.users.set(gm.id, gm); mundo.users.set(jog.id, jog);
  mundo.users.activeGM = gm;
  game.user = gm;
  game.settings._zerar();
  carregarIdioma("pt-BR");
  ui.notifications._l.length = 0;
  dialogos.respostas.length = 0; dialogos.registro.length = 0;
  Documento._registrar.length = 0;
  return { gm, jog };
}
