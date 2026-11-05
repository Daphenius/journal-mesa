/* Testes da integração com o módulo Monetização (5.9.0): lojas com preço da cidade, itens em falta,
 * compras e vendas registradas na economia, e edições automáticas do Jornal de Notícias.
 * A Monetização aqui é uma API falsa (só o que o Journal chama); o Foundry é o simulado de foundry-simulado.mjs.
 * Rodar na pasta do módulo:  node tests/economia.test.mjs */
import * as F from "./foundry-simulado.mjs";
F.instalar(); F.novoMundo();
await import("../scripts/journal.js");
const N = await import("../scripts/nucleo.js");
const Jornal = await import("../scripts/jornal/index.js");
const { lerEdicao } = await import("../scripts/jornal/dados.js");
const { MOD, CHAVE_DADOS: D } = N;

let passou = 0, falhou = 0;
function ok(cond, msg) { if (cond) passou++; else { falhou++; console.log("FALHOU:", msg); } }
const igual = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
async function teste(nome, fn) {
  const antes = falhou;
  try { await fn(); } catch (err) { falhou++; console.log("ERRO em", nome, err.stack?.split("\n").slice(0, 5).join("\n")); }
  console.log(`${falhou === antes ? "PASS" : "FAIL"} ${nome}`);
}

const GM = "GMGMGMGMGMGMGMGM", JOG = "JOGADORJOGADOR01";
const avisos = [];
F.game.socket.emit = (canal, msg) => { if (msg?.acao === "aviso") avisos.push(msg); };
console.warn = () => {};

/* ---------- Monetização falsa ---------- */
const registros = [];
let noticias = [];
let diaEco = 10;
function instalarMonetizacao() {
  registros.length = 0;
  F.game._modulos.monetizacao = {
    active: true,
    api: {
      local: (id) => (id === "pedra" ? { id: "pedra", nome: "Pedravale" } : null),
      locais: () => [{ id: "pedra", nome: "Pedravale", status: "Estável" }],
      multiplicadorItem: (item) => (item?.type === "weapon" ? 1.5 : 1),
      multiplicador: () => 1.2,
      disponivel: (item) => item?.name !== "Sal",
      registrarItem: async (item, local, quantidade, tipo) => { registros.push({ nome: item?.name, local, quantidade, tipo }); return {}; },
      abundancia: () => ({ manufaturados: 3, alimentos: 0.2 }),
      categoriaItem: (item) => (item?.type === "weapon" ? "manufaturados" : "alimentos"),
      dia: () => diaEco,
      faccoes: () => [],
      noticias: (desde) => noticias.filter((n) => n.dia > desde)
    }
  };
}

async function iniciar() {
  F.novoMundo();
  F.Hooks.callAll("init"); F.Hooks.callAll("i18nInit");
  instalarMonetizacao();
  avisos.length = 0;
}
const item = (id, nome, tipo, preco, qtd = 5) => ({
  _id: id, name: nome, type: tipo, img: "", system: { price: { value: preco, denomination: "gp" }, quantity: 1 },
  flags: { [MOD]: { qtd, preco } }
});
async function loja(ligada = true) {
  const { entry } = await N.criarTipo("shop");
  await entry.update({ "ownership.default": 2 });
  await entry.pages.contents[0].update({
    [`flags.${MOD}.${D}.items`]: { esp: item("esp", "Espada", "weapon", 10), sal: item("sal", "Sal", "loot", 1) },
    ...(ligada ? { [`flags.${MOD}.economia.local`]: "pedra" } : {})
  });
  return entry;
}
const heroi = (gp = 100, items = []) => F.Actor.create({ name: "Ana", ownership: { default: 0, [JOG]: 3 }, system: { currency: { pp: 0, gp, ep: 0, sp: 0, cp: 0 } }, items });
const ouro = (ator) => ator.system.currency.gp + ator.system.currency.sp / 10 + ator.system.currency.cp / 100;

/* ================= lojas ================= */

await teste("loja ligada: o jogador paga o preço ajustado pela cidade e a compra entra na economia", async () => {
  await iniciar();
  const l = await loja(true);
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: l.id, origem: "semanal", itemId: "esp", actorUuid: ator.uuid, userId: JOG, quantidade: 2 });
  igual(Math.round(ouro(ator) * 100) / 100, 70, "pagou 2 × 15 po (10 po × 1,5)");
  igual(registros, [{ nome: "Espada", local: "pedra", quantidade: 2, tipo: "compra" }], "compra registrada na Monetização");
  igual(N.analisar(l).m.items.esp.flags[MOD].qtd, 3, "o estoque da loja baixou");
});

await teste("loja sem cidade: preço normal e nada é registrado", async () => {
  await iniciar();
  const l = await loja(false);
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: l.id, origem: "semanal", itemId: "esp", actorUuid: ator.uuid, userId: JOG });
  igual(ouro(ator), 90, "pagou 10 po");
  igual(registros.length, 0, "nada registrado");
});

await teste("loja ligada com a opção de preços desligada: preço normal, mas a compra continua registrada", async () => {
  await iniciar();
  const l = await loja(true);
  await l.pages.contents[0].update({ [`flags.${MOD}.economia.precos`]: false });
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: l.id, origem: "semanal", itemId: "esp", actorUuid: ator.uuid, userId: JOG });
  igual(ouro(ator), 90, "pagou 10 po");
  igual(registros.length, 1, "registrada");
});

await teste("item em falta na cidade: compra recusada, nada muda", async () => {
  await iniciar();
  const l = await loja(true);
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: l.id, origem: "semanal", itemId: "sal", actorUuid: ator.uuid, userId: JOG });
  igual(ouro(ator), 100, "não cobrou");
  igual(ator.items.size, 0, "não entregou");
  ok(avisos.at(-1)?.texto?.includes("em falta"), `aviso de falta: ${avisos.at(-1)?.texto}`);
  igual(registros.length, 0, "nada registrado");
});

await teste("Monetização desligada: a loja ligada volta a funcionar como antes", async () => {
  await iniciar();
  const l = await loja(true);
  F.game._modulos.monetizacao.active = false;
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: l.id, origem: "semanal", itemId: "sal", actorUuid: ator.uuid, userId: JOG });
  igual(ouro(ator), 99, "comprou o sal por 1 po (sem falta, sem ajuste)");
});

await teste("venda: a loja paga pelo valor da cidade e a venda entra na economia", async () => {
  await iniciar();
  const l = await loja(true);
  const ator = await heroi(0, [{ _id: "minhaesp00000001", name: "Espada", type: "weapon", system: { price: { value: 10, denomination: "gp" }, quantity: 1 } }]);
  const itemId = ator.items.contents[0].id;
  await N.pedir("vender", { entryId: l.id, itemId, actorUuid: ator.uuid, userId: JOG, quantidade: 1 });
  igual(Math.round(ouro(ator) * 100) / 100, 9.75, "recebeu 65% de 15 po");
  igual(registros, [{ nome: "Espada", local: "pedra", quantidade: 1, tipo: "venda" }], "venda registrada");
});

/* ================= jornal automático ================= */

async function jornalAuto(cfg = {}) {
  const j = await Jornal.criarJornal(null, "Gazeta de Pedravale");
  await j.update({ [`flags.${MOD}.auto`]: { ativo: true, intervalo: 1, publicar: false, pularVazio: true, economia: true, calendario: false, missoes: false, ...cfg } });
  return j;
}
const edicoesDe = (j) => j.pages.contents.map((p) => lerEdicao(p)).filter(Boolean);

await teste("jornal automático: cria uma edição (rascunho) com as notícias da economia", async () => {
  await iniciar();
  diaEco = 10;
  noticias = [
    { dia: 10, data: "10 de Colheita", tipo: "perda", texto: "Caravana de Pedravale para Trigal foi perdida (20 Grãos).", manchete: "", locais: [], faccoes: [] },
    { dia: 10, data: "10 de Colheita", tipo: "alta", texto: "Sal subiu 60% em Vila Rasa na última semana.", manchete: "", locais: [], faccoes: [] },
    { dia: 10, data: "10 de Colheita", tipo: "grupo", texto: "O grupo resolveu \"Bandidos na estrada\".", manchete: "", locais: [], faccoes: [] }
  ];
  const j = await jornalAuto();
  await Jornal.gerarEdicoesAutomaticas(100);
  const eds = edicoesDe(j);
  igual(eds.length, 1, "uma edição");
  const ed = eds[0];
  igual(ed.estado, "rascunho", "nasce como rascunho");
  igual(ed.td, 100, "data do dia");
  igual(ed.materias.length, 3, "três matérias (saque, boato do grupo, preços)");
  ok(ed.materias.some((m) => m.secao === "rumor"), "feito do grupo vira boato");
  ok(ed.titulo.length > 0, `tem manchete: ${ed.titulo}`);
  igual(j.flags[MOD].auto.ultimoTd, 100, "marcou o dia coberto");
  igual(j.flags[MOD].auto.ultimoDiaEco, 10, "marcou o dia da economia coberto");

  // mesmo dia de novo: não repete
  await Jornal.gerarEdicoesAutomaticas(100);
  igual(edicoesDe(j).length, 1, "não cria duas no mesmo dia");

  // dia seguinte sem novidades: pula (e não repete as notícias antigas)
  await Jornal.gerarEdicoesAutomaticas(101);
  igual(edicoesDe(j).length, 1, "dia sem novidades não gera edição");
  igual(j.flags[MOD].auto.ultimoTd, 101, "mas conta o dia como coberto");
});

await teste("jornal automático: intervalo de 7 dias e edição publicada direto", async () => {
  await iniciar();
  diaEco = 20;
  noticias = [{ dia: 20, data: "", tipo: "falta", texto: "Falta comida em Vila Rasa.", manchete: "", locais: [], faccoes: [] }];
  const j = await jornalAuto({ intervalo: 7, publicar: true, ultimoTd: 200, ultimoDiaEco: 19 });
  await Jornal.gerarEdicoesAutomaticas(203);
  igual(edicoesDe(j).length, 0, "antes de 7 dias, nada");
  await Jornal.gerarEdicoesAutomaticas(207);
  await new Promise((r) => setTimeout(r, 20));
  const eds = edicoesDe(j);
  igual(eds.length, 1, "no 7º dia, uma edição");
  igual(eds[0].estado, "publicado", "publicada direto");
});

await teste("jornal automático desligado ou sem novidades com 'pular' desligado", async () => {
  await iniciar();
  noticias = [];
  const desligado = await jornalAuto({ ativo: false });
  const sempre = await jornalAuto({ pularVazio: false });
  await Jornal.gerarEdicoesAutomaticas(50);
  igual(edicoesDe(desligado).length, 0, "desligado não gera");
  igual(edicoesDe(sempre).length, 1, "sem 'pular', sai uma edição calma");
  igual(edicoesDe(sempre)[0].materias.length, 0, "sem matérias");
});

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exitCode = 1;
