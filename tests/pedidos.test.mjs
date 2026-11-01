/* Testes dos pedidos executados pelo mestre (5.4.5): validação do tipo de página por ação, quantidade na venda,
 * compra com compensação (falha em cada passo) e entrega de recompensa (repetição, reabrir, falha parcial).
 * Tudo passa pelo mesmo ponto de entrada que o mestre usa (pedir → executarPedido → ACOES_GM), com o Foundry
 * simulado de foundry-simulado.mjs — não é o Foundry real; o autor testa lá depois.
 * Rodar na pasta do módulo:  node tests/pedidos.test.mjs */
import * as F from "./foundry-simulado.mjs";
F.instalar(); F.novoMundo();
await import("../scripts/journal.js");
const N = await import("../scripts/nucleo.js");
const P = await import("../scripts/partes/pechincha.js");
const Missao = (await import("../scripts/paginas/missao.js")).default;
const { MOD, CHAVE_DADOS: D } = N;

let passou = 0, falhou = 0;
const falhas = [];
function ok(cond, msg) { if (cond) { passou++; } else { falhou++; falhas.push(msg); console.log("FALHOU:", msg); } }
const igual = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
async function teste(nome, fn) {
  const antes = falhou;
  try { await fn(); } catch (err) { falhou++; falhas.push(`${nome}: ${err.message}`); console.log("ERRO em", nome, err.stack?.split("\n").slice(0, 4).join("\n")); }
  console.log(`${falhou === antes ? "PASS" : "FAIL"} ${nome}`);
}
async function iniciar(opts = {}) {
  const u = F.novoMundo(opts);
  F.Hooks.callAll("init"); F.Hooks.callAll("i18nInit");
  avisos.length = 0; erros.length = 0;
  return u;
}

const GM = "GMGMGMGMGMGMGMGM", JOG = "JOGADORJOGADOR01";

/* avisos mandados ao jogador pelo socket e erros do console: guardados para conferir, sem poluir a saída */
const avisos = [];
F.game.socket.emit = (canal, msg) => { if (msg?.acao === "aviso") avisos.push(msg); };
const erros = [];
const consoleErro = console.error, consoleAviso = console.warn;
console.error = (...a) => erros.push(["error", ...a]);
console.warn = (...a) => erros.push(["warn", ...a]);
const ultimoAviso = () => avisos.at(-1)?.texto ?? "";
const errosDoMestre = () => F.ui.notifications._l.filter(([t]) => t === "error").map(([, m]) => m);

/* ---------- cenários ---------- */
/* páginas que os jogadores podem ver (Observador); criarTipo nasce só para o mestre */
async function criarVisivel(tipo) {
  const { entry } = await N.criarTipo(tipo);
  await entry.update({ "ownership.default": 2 });
  return entry;
}
const itemEstoque = (id, nome, qtd, preco) => ({
  _id: id, name: nome, type: "weapon", img: "icons/x.png", system: { price: { value: preco, denomination: "gp" }, quantity: 1 },
  flags: { [MOD]: { qtd, preco } }
});
async function lojaComEstoque() {
  const loja = await criarVisivel("shop");
  await loja.pages.contents[0].update({ [`flags.${MOD}.${D}.items`]: { it1: itemEstoque("it1", "Espada longa", 3, 10) } });
  return loja;
}
async function bauComItem() {
  const bau = await criarVisivel("loot");
  await bau.pages.contents[0].update({ [`flags.${MOD}.${D}.items`]: { b1: itemEstoque("b1", "Anel", 1, 5) } });
  return bau;
}
async function missaoComRecompensa() {
  const missao = await criarVisivel("quest");
  await missao.pages.contents[0].update({
    [`flags.${MOD}.${D}.rewards`]: { r1: { id: "r1", name: "Paga", xp: 100, currency: { gp: 50 }, itemIds: ["ri1"], visible: true, awarded: false, active: true } },
    [`flags.${MOD}.${D}.items`]: { ri1: itemEstoque("ri1", "Poção", 1, 50) }
  });
  return missao;
}
const heroi = (gp = 100, extra = {}) => F.Actor.create({ name: "Ana", ownership: { default: 0, [JOG]: 3 }, system: { currency: { pp: 0, gp, ep: 0, sp: 0, cp: 0 }, ...extra } });
const estado = (loja, ator) => ({ estoque: N.analisar(loja).m.items, itens: ator.items.contents.map((i) => i.toObject()), moedas: ator.system.currency });

/* ================= 1. tipo de página por ação ================= */

await teste("pedido 'pegar' apontando para uma loja é recusado sem mudar estoque, inventário ou moedas", async () => {
  await iniciar();
  const loja = await lojaComEstoque();
  const ator = await heroi();
  const antes = JSON.stringify(estado(loja, ator));
  await N.pedir("pegar", { entryId: loja.id, itemId: "it1", actorUuid: ator.uuid, userId: JOG });
  igual(JSON.stringify(estado(loja, ator)), antes, "nada mudou");
  ok(avisos.length === 1 && avisos[0].userId === JOG, "o jogador recebeu um aviso");
  ok(ultimoAviso().includes("essa ação não vale para este tipo de página"), `motivo certo: ${ultimoAviso()}`);
});

await teste("saque legítimo de baú continua funcionando pelo mesmo caminho", async () => {
  await iniciar();
  const bau = await bauComItem();
  const ator = await heroi();
  await N.pedir("pegar", { entryId: bau.id, itemId: "b1", actorUuid: ator.uuid, userId: JOG });
  igual(ator.items.size, 1, "o item foi para a ficha");
  ok(!N.analisar(bau).m.items.b1, "o item saiu do baú");
  igual(avisos.length, 0, "sem aviso");
});

await teste("demais combinações inválidas são recusadas (ação × tipo de página, origem, campos obrigatórios)", async () => {
  await iniciar();
  const loja = await lojaComEstoque();
  const bau = await bauComItem();
  const missao = await missaoComRecompensa();
  const ator = await heroi();
  const antes = JSON.stringify([estado(loja, ator), N.analisar(bau).m.items, N.analisar(missao).m]);
  const casos = [
    ["comprar", { entryId: bau.id, origem: "semanal", itemId: "b1", actorUuid: ator.uuid, userId: JOG }, "comprar num baú"],
    ["vender", { entryId: bau.id, itemId: "x", actorUuid: ator.uuid, userId: JOG }, "vender num baú"],
    ["rolarDiaria", { entryId: missao.id, userId: JOG }, "rolar oferta numa missão"],
    ["negociar", { entryId: bau.id, modo: "compra", alvoId: "b1", nome: "Anel", actorUuid: ator.uuid, userId: JOG }, "negociar num baú"],
    ["pegarRecompensa", { entryId: loja.id, grupo: "r1", itemId: "it1", actorUuid: ator.uuid, userId: JOG }, "pegar recompensa numa loja"],
    ["pegar", { entryId: missao.id, itemId: "ri1", actorUuid: ator.uuid, userId: JOG }, "pegar item de missão como se fosse baú"],
    ["comprar", { entryId: loja.id, origem: "gratis", itemId: "it1", actorUuid: ator.uuid, userId: JOG }, "origem inventada"],
    ["comprar", { entryId: loja.id, origem: "semanal", actorUuid: ator.uuid, userId: JOG }, "compra semanal sem itemId"],
    ["comprar", { entryId: loja.id, origem: "semanal", itemId: { a: 1 }, actorUuid: ator.uuid, userId: JOG }, "itemId que não é texto"],
    ["pegar", { entryId: bau.id, itemId: "b1", userId: JOG }, "pegar sem ficha"],
    ["pegar", { itemId: "b1", actorUuid: ator.uuid, userId: JOG }, "pegar sem página"],
    ["pegarRecompensa", { entryId: missao.id, itemId: "ri1", actorUuid: ator.uuid, userId: JOG }, "recompensa sem grupo"],
    ["negociar", { entryId: loja.id, modo: "roubo", alvoId: "it1", actorUuid: ator.uuid, userId: JOG }, "negociar com modo inválido"]
  ];
  for (const [acao, msg, nome] of casos) {
    const n = avisos.length;
    await N.pedir(acao, msg);
    ok(avisos.length === n + 1 && avisos[n].userId === JOG, `${nome}: recusado com aviso ao jogador`);
  }
  igual(JSON.stringify([estado(loja, ator), N.analisar(bau).m.items, N.analisar(missao).m]), antes, "nenhum pedido inválido mudou nada");

  // propriedade da ficha continua valendo
  const outro = await F.Actor.create({ name: "Bruno", ownership: { default: 0 }, system: { currency: { gp: 100 } } });
  const n = avisos.length;
  await N.pedir("pegar", { entryId: bau.id, itemId: "b1", actorUuid: outro.uuid, userId: JOG });
  ok(avisos.length === n + 1 && ultimoAviso().includes("não pertence"), "ficha de outro: recusado");
  igual(outro.items.size, 0, "a ficha alheia não recebeu nada");
});

/* ================= 2. quantidade na venda ================= */

await teste("venda: quantidade 0, negativa ou inválida não paga nem entra no estoque; ausente vale 1 unidade", async () => {
  await iniciar();
  const loja = await criarVisivel("shop");
  const preco = { value: 10, denomination: "gp" };
  const ator = await F.Actor.create({ name: "Ana", ownership: { [JOG]: 3 }, system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } }, items: [
    { _id: "ZEROZEROZEROZERO", name: "Zero", type: "equipment", system: { price: preco, quantity: 0 } },
    { _id: "NEGANEGANEGANEGA", name: "Negativo", type: "equipment", system: { price: preco, quantity: -2 } },
    { _id: "NANNANNANNANNANN", name: "Inválido", type: "equipment", system: { price: preco, quantity: "abc" } },
    { _id: "SEMQTDSEMQTDSEMQ", name: "Sem quantidade", type: "equipment", system: { price: preco } },
    { _id: "TRESTRESTRESTRES", name: "Três", type: "equipment", system: { price: preco, quantity: 3 } }
  ] });
  igual(N.qtdDaFicha({ system: {} }), 1, "qtdDaFicha: sem campo = 1");
  igual(N.qtdDaFicha({ system: { quantity: 0 } }), 0, "qtdDaFicha: zero = 0");
  igual(N.qtdDaFicha({ system: { quantity: -2 } }), 0, "qtdDaFicha: negativo = 0");
  igual(N.qtdDaFicha({ system: { quantity: NaN } }), 0, "qtdDaFicha: NaN = 0");
  igual(N.qtdDaFicha({ system: { quantity: "3" } }), 0, "qtdDaFicha: texto = 0");
  igual(N.qtdDaFicha({ system: { quantity: 2.7 } }), 2, "qtdDaFicha: 2,7 = 2");

  for (const id of ["ZEROZEROZEROZERO", "NEGANEGANEGANEGA", "NANNANNANNANNANN"]) {
    const n = avisos.length;
    await N.pedir("vender", { entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: id, quantidade: 1 });
    ok(avisos.length === n + 1 && ultimoAviso().includes("nenhuma unidade"), `${id}: recusado com aviso`);
    ok(ator.items.has(id), `${id}: o item continua na ficha`);
  }
  igual(ator.system.currency.gp, 0, "nada foi pago");
  igual(Object.keys(N.analisar(loja).m.items).length, 0, "nada entrou no estoque");

  // sem o campo quantity = 1 unidade: vende, o item sai da ficha, a loja paga 65% de 10 po
  await N.pedir("vender", { entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: "SEMQTDSEMQTDSEMQ", quantidade: 5 });
  ok(!ator.items.has("SEMQTDSEMQTDSEMQ"), "item sem quantidade: vendido inteiro (1 unidade)");
  igual([ator.system.currency.gp, ator.system.currency.sp], [6, 5], "recebeu 6 po 5 pp (65% de 10 po)");
  let estoque = Object.values(N.analisar(loja).m.items);
  igual(estoque.map((i) => [i.name, i.flags[MOD].qtd]), [["Sem quantidade", 1]], "uma unidade no estoque");

  // venda parcial e da última unidade
  await N.pedir("vender", { entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: "TRESTRESTRESTRES", quantidade: 2 });
  igual(ator.items.get("TRESTRESTRESTRES").system.quantity, 1, "venda parcial: sobrou 1");
  await N.pedir("vender", { entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: "TRESTRESTRESTRES", quantidade: 1 });
  ok(!ator.items.has("TRESTRESTRESTRES"), "última unidade: o item saiu da ficha");
  estoque = Object.values(N.analisar(loja).m.items);
  igual(estoque.find((i) => i.name === "Três")?.flags[MOD].qtd, 3, "as três unidades estão no estoque");
  igual(ator.system.currency.gp, 6 + 13 + 6, "pagamentos somados (6,5 + 13 + 6,5 = 26 po)");
});

/* ================= 3. compra com compensação ================= */

const falhar = (obj, metodo, quando = () => true) => {
  const orig = obj[metodo];
  obj[metodo] = async function (...a) { if (quando(...a)) throw new Error(`falha injetada em ${metodo}`); return orig.apply(this, a); };
  return () => { obj[metodo] = orig; };
};
const mexeNoEstoque = (m) => JSON.stringify(m).includes(".qtd") || JSON.stringify(m).includes("comprado");

await teste("compra semanal: falha injetada em cada passo deixa tudo como antes; sem falha, transferência completa", async () => {
  await iniciar();
  for (const passo of ["criar", "cobrar", "estoque"]) {
    const loja = await lojaComEstoque();
    const ator = await heroi(100);
    const page = loja.pages.contents[0];
    const antes = JSON.stringify(estado(loja, ator));
    const restaurar = passo === "criar" ? falhar(ator, "createEmbeddedDocuments")
      : passo === "cobrar" ? falhar(ator, "update")
      : falhar(page, "update", mexeNoEstoque);
    const n = avisos.length;
    await N.pedir("comprar", { entryId: loja.id, origem: "semanal", itemId: "it1", actorUuid: ator.uuid, userId: JOG, quantidade: 2 });
    restaurar();
    igual(JSON.stringify(estado(loja, ator)), antes, `falha em "${passo}": estado final igual ao anterior`);
    ok(avisos.length === n + 1 && ultimoAviso().includes("nada foi cobrado"), `falha em "${passo}": o jogador soube que nada foi cobrado`);
    igual(errosDoMestre().filter((m) => m.includes("não consegui desfazer")).length, 0, `falha em "${passo}": nenhuma inconsistência para o mestre`);
  }
  // sem falha
  const loja = await lojaComEstoque();
  const ator = await heroi(100);
  await N.pedir("comprar", { entryId: loja.id, origem: "semanal", itemId: "it1", actorUuid: ator.uuid, userId: JOG, quantidade: 2 });
  igual(N.analisar(loja).m.items.it1.flags[MOD].qtd, 1, "estoque 3 → 1");
  igual(ator.items.contents.map((i) => i.system.quantity), [2], "2 unidades na ficha");
  igual(ator.system.currency.gp, 80, "pagou 20 po");
});

await teste("compra semanal: se a baixa do estoque E o desfazer falharem, o mestre é avisado do que ficou", async () => {
  await iniciar();
  const loja = await lojaComEstoque();
  const ator = await heroi(100);
  const page = loja.pages.contents[0];
  const r1 = falhar(page, "update", mexeNoEstoque);
  const r2 = falhar(ator, "deleteEmbeddedDocuments");
  await N.pedir("comprar", { entryId: loja.id, origem: "semanal", itemId: "it1", actorUuid: ator.uuid, userId: JOG, quantidade: 1 });
  r1(); r2();
  const avisoMestre = errosDoMestre().find((m) => m.includes("não consegui desfazer"));
  ok(!!avisoMestre, "o mestre recebeu o aviso de inconsistência");
  ok(avisoMestre?.includes("o item entregue na ficha") && avisoMestre?.includes(loja.name), `o aviso diz o que ficou e onde: ${avisoMestre}`);
  igual(ator.system.currency.gp, 100, "as moedas foram devolvidas (esse desfazer funcionou)");
  igual(ator.items.size, 1, "o item ficou na ficha (esse desfazer falhou) — é o que o aviso diz");
  ok(erros.some(([t, m]) => t === "error" && String(m).includes("não consegui desfazer")), "o erro também foi para o console");
});

await teste("compra diária: falha ao marcar a oferta desfaz entrega e cobrança; sem falha, a oferta fica comprada", async () => {
  await iniciar();
  const oferta = () => ({ dia: N.diaAtual(), nome: "Amuleto", img: "icons/a.png", uuid: "", preco: 10, precoBase: 20, tipo: "achado", custoOculto: "", comprado: false });
  for (const passo of ["criar", "cobrar", "oferta", null]) {
    const loja = await criarVisivel("shop");
    const page = loja.pages.contents[0];
    await page.setFlag(MOD, `diaria.ofertas.${JOG}`, oferta());
    const ator = await heroi(100);
    const antes = JSON.stringify([estado(loja, ator), page.getFlag(MOD, `diaria.ofertas.${JOG}`)]);
    const restaurar = passo === "criar" ? falhar(ator, "createEmbeddedDocuments")
      : passo === "cobrar" ? falhar(ator, "update")
      : passo === "oferta" ? falhar(page, "update", mexeNoEstoque) : () => {};
    await N.pedir("comprar", { entryId: loja.id, origem: "diaria", actorUuid: ator.uuid, userId: JOG });
    restaurar();
    if (passo) {
      igual(JSON.stringify([estado(loja, ator), page.getFlag(MOD, `diaria.ofertas.${JOG}`)]), antes, `falha em "${passo}": estado igual ao anterior (oferta continua disponível, nada cobrado)`);
    } else {
      igual(ator.items.contents.map((i) => i.name), ["Amuleto"], "sem falha: o item foi para a ficha");
      igual(ator.system.currency.gp, 90, "sem falha: pagou 10 po");
      igual(page.getFlag(MOD, `diaria.ofertas.${JOG}.comprado`), true, "sem falha: a oferta ficou marcada como comprada");
      const n = avisos.length;
      await N.pedir("comprar", { entryId: loja.id, origem: "diaria", actorUuid: ator.uuid, userId: JOG });
      ok(avisos.length === n + 1 && ultimoAviso().includes("não está mais disponível"), "comprar de novo a mesma oferta: recusado");
      igual(ator.system.currency.gp, 90, "não cobrou duas vezes");
    }
  }
});

await teste("saque de baú e item de recompensa: se a página não gravar, o item criado na ficha é apagado", async () => {
  await iniciar();
  const bau = await bauComItem();
  const ator = await heroi();
  let restaurar = falhar(bau.pages.contents[0], "update");
  await N.pedir("pegar", { entryId: bau.id, itemId: "b1", actorUuid: ator.uuid, userId: JOG });
  restaurar();
  igual(ator.items.size, 0, "baú: a ficha ficou como estava");
  ok(!!N.analisar(bau).m.items.b1, "baú: o item continua no baú");

  const missao = await missaoComRecompensa();
  await missao.pages.contents[0].update({ [`flags.${MOD}.${D}.rewards.r1.awarded`]: true });
  restaurar = falhar(missao.pages.contents[0], "update");
  await N.pedir("pegarRecompensa", { entryId: missao.id, grupo: "r1", itemId: "ri1", actorUuid: ator.uuid, userId: JOG });
  restaurar();
  igual(ator.items.size, 0, "recompensa: a ficha ficou como estava");
  igual(N.analisar(missao).m.rewards.r1.itemIds, ["ri1"], "recompensa: o item continua disponível");
  // sem falha, funciona (lista do grupo e item saem juntos)
  await N.pedir("pegarRecompensa", { entryId: missao.id, grupo: "r1", itemId: "ri1", actorUuid: ator.uuid, userId: JOG });
  igual(ator.items.size, 1, "recompensa: pegou");
  igual(N.analisar(missao).m.rewards.r1.itemIds, [], "recompensa: saiu da lista");
  ok(!N.analisar(missao).m.items.ri1, "recompensa: saiu dos itens");
});

/* ================= 4. entrega de recompensa ================= */

const appDe = (missao) => ({ ativa: missao.id, _entry: () => missao });
const entregar = (missao, gid, resposta) => {
  F.dialogos.respostas.push(resposta);
  return Missao.acoes.entregarRecompensa(appDe(missao), {}, { dataset: { grupo: gid } });
};
const respostaPadrao = (ator, itens = { ri1: "" }) => ({ herois: [{ id: ator.id, xp: 100 }], moedas: "dividir", itens, anunciar: false });

await teste("entregar a mesma recompensa duas vezes dá XP e moedas uma vez só; reabrir permite de novo; itens remanescentes continuam", async () => {
  const { jog } = await iniciar();
  const missao = await missaoComRecompensa();
  const ator = await heroi(0, { details: { xp: { value: 0 } } });
  jog.character = ator;

  await entregar(missao, "r1", respostaPadrao(ator));
  igual(ator.system.details.xp.value, 100, "primeira entrega: 100 XP");
  igual(ator.system.currency.gp, 50, "primeira entrega: 50 po");
  igual(N.analisar(missao).m.rewards.r1.awarded, true, "marcada como entregue");
  igual(N.analisar(missao).m.rewards.r1.itemIds, ["ri1"], "item deixado na missão");

  const dialogosAntes = F.dialogos.registro.length;
  await entregar(missao, "r1", respostaPadrao(ator));
  F.dialogos.respostas.length = 0;
  igual(F.dialogos.registro.length, dialogosAntes, "segunda entrega: nem abre o diálogo");
  igual(ator.system.details.xp.value, 100, "segunda entrega: XP continua 100");
  igual(ator.system.currency.gp, 50, "segunda entrega: moedas continuam 50");
  ok(F.ui.notifications._l.some(([t, m]) => t === "warn" && m.includes("já foi entregue")), "o mestre foi avisado");

  // o jogador ainda pode pegar o item deixado
  await N.pedir("pegarRecompensa", { entryId: missao.id, grupo: "r1", itemId: "ri1", actorUuid: ator.uuid, userId: JOG });
  igual(ator.items.contents.map((i) => i.name), ["Poção"], "item remanescente pego depois");

  // reabrir (com confirmação) e entregar de novo, de propósito
  F.dialogos.respostas.push(false);
  await Missao.acoes.reabrirRecompensa(appDe(missao), {}, { dataset: { grupo: "r1" } });
  igual(N.analisar(missao).m.rewards.r1.awarded, true, "reabrir cancelado: continua entregue");
  F.dialogos.respostas.push(true);
  await Missao.acoes.reabrirRecompensa(appDe(missao), {}, { dataset: { grupo: "r1" } });
  igual(N.analisar(missao).m.rewards.r1.awarded, false, "reabrir confirmado: volta a poder ser entregue");
  await entregar(missao, "r1", respostaPadrao(ator, {}));
  igual(ator.system.details.xp.value, 200, "entrega intencional depois de reabrir: 200 XP");
});

await teste("dois cliques seguidos em Entregar: a segunda chamada é ignorada enquanto a primeira está em andamento", async () => {
  const { jog } = await iniciar();
  const missao = await missaoComRecompensa();
  const ator = await heroi(0, { details: { xp: { value: 0 } } });
  jog.character = ator;
  const app = appDe(missao);
  F.dialogos.respostas.push(respostaPadrao(ator), respostaPadrao(ator));
  await Promise.all([
    Missao.acoes.entregarRecompensa(app, {}, { dataset: { grupo: "r1" } }),
    Missao.acoes.entregarRecompensa(app, {}, { dataset: { grupo: "r1" } })
  ]);
  F.dialogos.respostas.length = 0;
  igual(F.dialogos.registro.length, 1, "um diálogo só");
  igual(ator.system.details.xp.value, 100, "XP uma vez");
  igual(ator.system.currency.gp, 50, "moedas uma vez");
  ok(!app._entregando, "a trava foi liberada no fim");
});

await teste("entrega com falha parcial: nada fica entregue pela metade e a recompensa não é marcada", async () => {
  const { jog } = await iniciar();
  const ator = await heroi(0, { details: { xp: { value: 0 } } });
  jog.character = ator;
  const intacto = (missao, rotulo) => {
    igual(ator.system.details.xp.value, 0, `${rotulo}: sem XP`);
    igual(ator.system.currency.gp, 0, `${rotulo}: sem moedas`);
    igual(ator.items.size, 0, `${rotulo}: sem itens na ficha`);
    igual(N.analisar(missao).m.rewards.r1.awarded, false, `${rotulo}: não marcada como entregue`);
    igual(N.analisar(missao).m.rewards.r1.itemIds, ["ri1"], `${rotulo}: o item continua na missão`);
    ok(!!N.analisar(missao).m.items.ri1, `${rotulo}: o item continua na lista`);
  };
  // (1) criar o item falha → sem XP, sem moedas, sem awarded
  let missao = await missaoComRecompensa();
  let restaurar = falhar(ator, "createEmbeddedDocuments");
  let erro = await entregar(missao, "r1", respostaPadrao(ator, { ri1: ator.id })).catch((e) => e);
  restaurar();
  ok(erro instanceof Error, "falha na criação do item é relatada (lançada)");
  intacto(missao, "falha no item");

  // (2) XP/moedas falham → os itens criados são apagados
  missao = await missaoComRecompensa();
  const origUpd = F.Actor.updateDocuments;
  F.Actor.updateDocuments = async () => { throw new Error("falha injetada em updateDocuments"); };
  erro = await entregar(missao, "r1", respostaPadrao(ator, { ri1: ator.id })).catch((e) => e);
  F.Actor.updateDocuments = origUpd;
  ok(erro instanceof Error, "falha no XP é relatada");
  intacto(missao, "falha no XP");

  // (3) a página da missão não grava → XP, moedas e itens voltam
  missao = await missaoComRecompensa();
  restaurar = falhar(missao.pages.contents[0], "update", (m) => JSON.stringify(m).includes("awarded"));
  erro = await entregar(missao, "r1", respostaPadrao(ator, { ri1: ator.id })).catch((e) => e);
  restaurar();
  ok(erro instanceof Error, "falha na página é relatada");
  intacto(missao, "falha na página");
  ok(F.ui.notifications._l.some(([t, m]) => t === "warn" && m.includes("nada foi entregue")), "o mestre soube que foi desfeito");

  // (4) sem falha: tudo entregue de uma vez
  await entregar(missao, "r1", respostaPadrao(ator, { ri1: ator.id }));
  igual(ator.system.details.xp.value, 100, "XP");
  igual(ator.system.currency.gp, 50, "moedas");
  igual(ator.items.contents.map((i) => i.name), ["Poção"], "item na ficha");
  igual(N.analisar(missao).m.rewards.r1.awarded, true, "marcada como entregue");
  igual(N.analisar(missao).m.rewards.r1.itemIds, [], "nenhum item sobrou");
});

console.error = consoleErro; console.warn = consoleAviso;
console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) { console.log(falhas.join("\n")); process.exit(1); }
