/* Testes do formato próprio (5.0) e da conversão do Monk's Enhanced Journal.
 * Rodar na pasta do módulo:  node tests/formato.test.mjs */
import * as F from "./foundry-simulado.mjs";
F.instalar(); F.novoMundo();
await import("../scripts/journal.js");
const N = await import("../scripts/nucleo.js");
const { MOD, CHAVE_DADOS: D } = N;
const MEJ = "monks-enhanced-journal";

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
  return u;
}
async function pronto() { await F.Hooks.callAll("ready"); await new Promise((r) => setTimeout(r, 20)); }

/* ---------- dados de exemplo no formato do Monk's ---------- */
const GM = "GMGMGMGMGMGMGMGM", JOG = "JOGADORJOGADOR01";
const itemMonks = (id, nome, qtd, preco, extra = {}) => ({
  _id: id, name: nome, type: "weapon", img: "icons/x.png", system: { price: { value: 10, denomination: "gp" }, quantity: 1 },
  flags: { [MEJ]: { quantity: qtd, price: preco, ...extra } }
});
function lojaMonks(idOutro) {
  return {
    name: "Ferreiro do Vale",
    pages: [{ name: "Ferreiro do Vale", type: "text", text: { content: "<p>Forja.</p>" }, src: "icons/loja.png", flags: { [MEJ]: {
      type: "shop", purchasing: "confirm", selling: "confirm", opening: 480, closing: 1020, shoptype: "Ferraria", location: "Vale",
      actor: "Actor.FERREIROFERREIR",
      items: {
        it1: itemMonks("it1", "Espada longa", 3, "15 gp"),
        it2: itemMonks("it2", "Adaga", 0, "2 sp", { from: "Mercador" }),
        it3: { ...itemMonks("it3", "Elmo", 1, "5 gp"), hidden: true }
      },
      relationships: { [idOutro]: { id: idOutro, uuid: `JournalEntry.${idOutro}`, hidden: false, relationship: "dono" }, inexistente1234: { id: "inexistente1234", uuid: "JournalEntry.inexistente1234", hidden: false } },
      [JOG]: { notes: "O ferreiro parece esconder algo." }
    } } }]
  };
}
function npcMonks(idLoja) {
  return {
    name: "Bram, o ferreiro",
    pages: [{ name: "Bram", type: "text", text: { content: "<p>Um anão.</p>" }, flags: { [MEJ]: {
      type: "person", role: "Ferreiro", location: "Vale", attributes: { race: { value: "Anão" } },
      relationships: { [idLoja]: { id: idLoja, uuid: `JournalEntry.${idLoja}`, hidden: false, relationship: "trabalha" } }
    } } }]
  };
}
const missaoMonks = () => ({
  name: "A espada perdida",
  pages: [{ name: "A espada perdida", type: "text", text: { content: "<p>Ache a espada.</p>" }, flags: { [MEJ]: {
    type: "quest", status: "inprogress", seen: true, source: "Bram",
    objectives: { o1: { id: "o1", content: "Achar a espada", done: 0, required: "", available: true } },
    rewards: { r1: { id: "r1", name: "Paga", xp: 100, currency: { gp: 50 }, itemIds: ["ri1"], visible: true, awarded: false, active: true } },
    items: { ri1: itemMonks("ri1", "Poção", 1, "50 gp") }
  } } }]
});
/* formato antigo do Monk's: listas como arrays, tipo "base" */
const bauAntigoMonks = () => ({
  name: "Baú antigo",
  pages: [{ name: "Baú antigo", type: "text", text: { content: "" }, flags: { [MEJ]: {
    type: "loot", purchasing: "free", currency: { gp: 12, sp: 3 },
    items: [itemMonks("b1", "Moedas falsas", 2, "1 gp"), itemMonks("b2", "Anel", "1", "")]
  } } }]
});
const anotacaoBase = () => ({ name: "Nota velha", pages: [{ name: "Nota velha", type: "text", text: { content: "x" }, flags: { [MEJ]: { type: "base", relationships: [] } } }] });
const encontroMonks = () => ({ name: "Emboscada", pages: [{ name: "Emboscada", type: "text", text: { content: "x" }, flags: { [MEJ]: { type: "encounter", monsters: [] } } }] });

/* ================= testes ================= */

await teste("dadosDeMonks converte uma loja (itens, preços, notas, vínculos)", async () => {
  const d = N.dadosDeMonks(lojaMonks("OUTROOUTROOUTRO1").pages[0].flags[MEJ]);
  igual(d.type, "shop", "tipo");
  igual(d.shoptype, "Ferraria", "campo simples");
  igual(d.actor, "Actor.FERREIROFERREIR", "ator ligado");
  igual(d.items.it1.flags[MOD], { qtd: 3, preco: 15 }, "quantidade e preço em po");
  igual(d.items.it2.flags[MOD], { qtd: 0, preco: 0.2, de: "Mercador" }, "preço em prata e origem");
  ok(d.items.it1.flags[MEJ] === undefined, "o item convertido não leva as flags do Monk's");
  ok(d.items.it3.hidden === true, "hidden do item fica");
  igual(d.notas, { [JOG]: "O ferreiro parece esconder algo." }, "notas pessoais vão para dados.notas");
  ok(!(JOG in d), "o id do usuário não fica como chave solta");
  igual(Object.keys(d.relationships).length, 2, "vínculos mantidos");
  igual(d.relationships.OUTROOUTROOUTRO1.relationship, "dono", "rótulo do vínculo");
});

await teste("dadosDeMonks: formato antigo (arrays, tipo base) vira o formato atual", async () => {
  const d = N.dadosDeMonks(bauAntigoMonks().pages[0].flags[MEJ]);
  ok(!Array.isArray(d.items) && d.items.b1 && d.items.b2, "lista de itens virou objeto por id");
  igual(d.items.b1.id, "b1", "id preenchido");
  igual(d.items.b2.flags[MOD].qtd, 1, "quantidade em texto vira número");
  igual(d.items.b2.flags[MOD].preco, 10, "preço vazio usa o preço da ficha do item (10 gp)");
  igual(d.currency, { gp: 12, sp: 3 }, "moedas");
  igual(N.dadosDeMonks(anotacaoBase().pages[0].flags[MEJ]).type, "journalentry", "tipo base vira anotação");
  igual(N.dadosDeMonks({}), null, "sem tipo: nada");
  igual(N.dadosDeMonks(null), null, "nulo: nada");
});

await teste("importarDoMonks: copia sem alterar o Monk's, mantém vínculos e faz o relatório", async () => {
  await iniciar();
  const loja = await F.JournalEntry.create(lojaMonks("PENDENTE00000000"));
  const npc = await F.JournalEntry.create(npcMonks(loja.id));
  // acerta o vínculo da loja para o npc real
  const mej = loja.pages.contents[0]._source.flags[MEJ];
  mej.relationships[npc.id] = { id: npc.id, uuid: npc.uuid, hidden: false, relationship: "dono" };
  delete mej.relationships.PENDENTE00000000;
  const missao = await F.JournalEntry.create(missaoMonks());
  const bau = await F.JournalEntry.create(bauAntigoMonks());
  const enc = await F.JournalEntry.create(encontroMonks());
  const diario = await F.JournalEntry.create({ name: "Diário comum", pages: [{ name: "a", type: "text", text: { content: "" } }] });
  const antesMonks = JSON.stringify([loja, npc, missao, bau, enc].map((e) => e.pages.contents[0]._source.flags[MEJ]));
  const ids = [loja, npc, missao, bau, enc].map((e) => [e.id, e.pages.contents[0].id]);

  ok(N.analisar(loja).tipo === "diario", "antes da conversão a loja do Monk's aparece como diário comum");

  const rel = await N.importarDoMonks({ silencioso: true });
  igual(rel.convertidas.length, 5, "cinco páginas convertidas");
  igual(rel.porTipo, { shop: 1, person: 1, quest: 1, loot: 1, encounter: 1 }, "contagem por tipo");
  igual(rel.limitadas.map((l) => l.tipo), ["encounter"], "tipo só do Monk's apontado como edição limitada");
  igual(rel.puladas, 0, "nada pulado");
  igual(rel.falhas, [], "sem falhas");
  igual(rel.vinculosQuebrados.length, 1, "um vínculo quebrado apontado");
  ok(rel.vinculosQuebrados[0].para.includes("inexistente1234"), "o vínculo quebrado é o inexistente");

  const depoisMonks = JSON.stringify([loja, npc, missao, bau, enc].map((e) => e.pages.contents[0]._source.flags[MEJ]));
  ok(antesMonks === depoisMonks, "as flags do Monk's ficaram idênticas");
  igual([loja, npc, missao, bau, enc].map((e) => [e.id, e.pages.contents[0].id]), ids, "mesmos ids de diário e página");
  igual(F.game.journal.size, 6, "nenhum diário novo criado");

  const a = N.analisar(loja);
  igual(a.tipo, "shop", "a loja agora é loja");
  igual(a.m.items.it1.flags[MOD].qtd, 3, "estoque lido do formato próprio");
  ok(a.m.relationships[npc.id]?.uuid === npc.uuid, "vínculo loja → npc continua apontando para o npc");
  ok(N.analisar(npc).m.relationships[loja.id]?.uuid === loja.uuid, "vínculo npc → loja continua");
  ok(F.fromUuidSync(N.analisar(npc).m.relationships[loja.id].uuid) === loja, "o uuid do vínculo resolve para a loja");
  igual(N.analisar(missao).tipo, "quest", "missão");
  igual(N.analisar(missao).m.objectives.o1.content, "Achar a espada", "objetivo");
  igual(N.analisar(missao).m.rewards.r1.itemIds, ["ri1"], "recompensa");
  igual(N.analisar(bau).tipo, "loot", "baú antigo");
  igual(N.analisar(enc).tipo, "outro", "encontro do Monk's é 'outro'");
  igual(N.analisar(enc).tipoBase, "encounter", "tipo base guardado");
  igual(N.analisar(diario).tipo, "diario", "diário comum continua comum");
  ok(!("dados" in (a.x)), "os extras (x) não carregam o registro de tipo");

  const rel2 = await N.importarDoMonks({ silencioso: true });
  igual(rel2.convertidas.length, 0, "segunda passada não converte nada");
  igual(rel2.puladas, 5, "segunda passada pula as cinco já convertidas");
});

await teste("migrarFormato: pergunta uma vez, converte e marca a versão; 'Depois' não mexe", async () => {
  await iniciar();
  await F.JournalEntry.create(lojaMonks("X"));
  await F.JournalEntry.create(npcMonks("Y"));
  igual(F.game.settings.get(MOD, "formatoDados"), 0, "começa em 0");
  F.dialogos.respostas.push(false); // Depois
  await N.migrarFormato();
  igual(F.dialogos.registro.length, 1, "perguntou");
  igual(F.game.settings.get(MOD, "formatoDados"), 0, "'Depois' deixa a versão em 0");
  ok(F.game.journal.contents.every((e) => N.analisar(e).tipo === "diario"), "'Depois' não converte");

  F.dialogos.respostas.push(true, true); // Converter agora + fechar o relatório
  await N.migrarFormato();
  igual(F.game.settings.get(MOD, "formatoDados"), 5, "versão 5 depois de converter");
  igual(F.game.journal.contents.map((e) => N.analisar(e).tipo).sort(), ["person", "shop"], "convertidas");
  igual(F.dialogos.registro.filter((d) => d.tipo === "prompt").length, 1, "mostrou o relatório");

  F.dialogos.registro.length = 0;
  await N.migrarFormato();
  igual(F.dialogos.registro.length, 0, "com a versão 5 não pergunta mais");
});

await teste("migrarFormato: mundo sem nada do Monk's marca a versão sem perguntar", async () => {
  await iniciar();
  await F.JournalEntry.create({ name: "Diário", pages: [{ name: "a", type: "text", text: { content: "" } }] });
  await N.migrarFormato();
  igual(F.dialogos.registro.length, 0, "não perguntou");
  igual(F.game.settings.get(MOD, "formatoDados"), 5, "versão 5");
});

await teste("ready: páginas que chegam no formato do Monk's depois são convertidas sozinhas", async () => {
  await iniciar();
  await pronto();
  igual(F.game.settings.get(MOD, "formatoDados"), 5, "mundo vazio: versão 5 no ready");
  const e = await F.JournalEntry.create(missaoMonks());  // ex.: importada de um compêndio
  await new Promise((r) => setTimeout(r, 20));
  igual(N.analisar(e).tipo, "quest", "criada no formato do Monk's → convertida pelo gancho");
  // Monk's ativo marcando o tipo numa página já existente
  const e2 = await F.JournalEntry.create({ name: "Nova", pages: [{ name: "Nova", type: "text", text: { content: "" } }] });
  igual(N.analisar(e2).tipo, "diario", "sem tipo: diário");
  await e2.pages.contents[0].update({ [`flags.${MEJ}.type`]: "person", [`flags.${MEJ}.role`]: "Guarda" });
  await new Promise((r) => setTimeout(r, 20));
  igual(N.analisar(e2).tipo, "person", "tipo marcado pelo Monk's → convertido");
  igual(N.analisar(e2).m.role, "Guarda", "campo copiado");
});

await teste("páginas novas nascem no formato próprio, sem nada do Monk's", async () => {
  await iniciar();
  for (const tipo of ["person", "place", "organization", "shop", "quest", "loot", "journalentry"]) {
    const { entry } = await N.criarTipo(tipo);
    const pg = entry.pages.contents[0];
    igual(N.analisar(entry).tipo, tipo, `tipo ${tipo}`);
    ok(pg._source.flags[MEJ] === undefined, `${tipo}: sem flags do Monk's`);
    igual(pg._source.flags[MOD][D].type, tipo, `${tipo}: registro próprio`);
  }
  const { entry: deus } = await N.criarTipo("deus");
  igual(N.analisar(deus).tipo, "deus", "divindade");
  igual(deus.pages.contents[0]._source.flags[MOD][D].type, "journalentry", "divindade guarda como anotação por baixo");
});

await teste("compra, pegar do baú, venda, notas e recompensas gravam no formato próprio", async () => {
  await iniciar();
  const rel = await (async () => { const loja = await F.JournalEntry.create(lojaMonks("Z")); await N.importarDoMonks({ silencioso: true }); return loja; })();
  const loja = rel;
  const ator = await F.Actor.create({ _id: "ATORATORATORATOR", name: "Ana", system: { currency: { pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 } } });
  F.game.user = F.mundo.users.get(GM);
  await N.executarCompra({ entryId: loja.id, origem: "semanal", itemId: "it1", actorUuid: ator.uuid, userId: JOG, quantidade: 2 });
  igual(N.analisar(loja).m.items.it1.flags[MOD].qtd, 1, "estoque caiu de 3 para 1");
  igual(ator.items.size, 1, "o item foi para a ficha");
  const naFicha = ator.items.contents[0];
  ok(naFicha._source.flags?.[MOD] === undefined && naFicha._source.flags?.[MEJ] === undefined, "o item na ficha não leva flags de estoque");
  igual(naFicha.system.quantity, 2, "quantidade comprada");
  igual(ator.system.currency.gp, 70, "pagou 30 po");

  await N.executarCompra({ entryId: loja.id, origem: "semanal", itemId: "it2", actorUuid: ator.uuid, userId: JOG, quantidade: 1 });
  igual(ator.items.size, 1, "item esgotado (qtd 0) não é vendido");

  // notas pessoais
  await N.executarNota({ pageUuid: loja.pages.contents[0].uuid, userId: JOG, texto: "Nova nota" });
  igual(N.analisar(loja).m.notas[JOG], "Nova nota", "nota pessoal gravada em dados.notas");
  ok(loja.pages.contents[0]._source.flags[MEJ][JOG].notes === "O ferreiro parece esconder algo.", "a nota do Monk's ficou intacta");

  // baú: pegar
  const bau = await F.JournalEntry.create(bauAntigoMonks());
  await N.importarDoMonks({ silencioso: true });
  await N.executarPegar({ entryId: bau.id, itemId: "b1", actorUuid: ator.uuid, userId: JOG });
  ok(!N.analisar(bau).m.items.b1 && N.analisar(bau).m.items.b2, "o item pego saiu do baú; o outro ficou");
  igual(ator.items.size, 2, "o item pego foi para a ficha");

  // recompensa de missão
  const missao = await F.JournalEntry.create(missaoMonks());
  await N.importarDoMonks({ silencioso: true });
  await missao.pages.contents[0].update({ [`flags.${MOD}.${D}.rewards.r1.awarded`]: true });
  await N.executarPegarRecompensa({ entryId: missao.id, grupo: "r1", itemId: "ri1", actorUuid: ator.uuid, userId: JOG });
  igual(N.analisar(missao).m.rewards.r1.itemIds, [], "item saiu da recompensa");
  ok(!N.analisar(missao).m.items.ri1, "item saiu da lista");
  igual(ator.items.size, 3, "foi para a ficha");
});

await teste("itemParaLoja e itemLimpo: preço e quantidade no formato próprio", async () => {
  await iniciar();
  const it = await F.Item.create({ name: "Arco", type: "weapon", system: { price: { value: 25, denomination: "gp" }, quantity: 1 }, flags: { [MEJ]: { quantity: 9 } } });
  const d = N.itemParaLoja(it, {}, 4);
  igual(d.flags[MOD].qtd, 4, "quantidade");
  igual(d.flags[MOD].preco, 25, "preço em po");
  igual(d.flags[MOD].origem, it.uuid, "origem");
  ok(d.flags[MEJ] === undefined, "sem flags do Monk's");
  igual(N.precoDoItem(d), 25, "precoDoItem lê o próprio");
  igual(N.qtdDoItem(d), 4, "qtdDoItem");
  igual(N.qtdDoItem({ flags: {} }), undefined, "sem quantidade = ilimitado");
  igual(N.precoDoItem({ system: { price: { value: 3, denomination: "sp" } } }), 0.3, "sem preço próprio usa a ficha");
  const limpo = N.itemLimpo({ ...d, hidden: true });
  ok(!limpo.flags[MOD] && !limpo._id && !("hidden" in limpo), "itemLimpo tira estoque, id e hidden");
});

await teste("importar JSON: diário do Monk's chega convertido; pasta do Journal da Mesa também", async () => {
  await iniciar();
  const d = { name: "Importada", pages: lojaMonks("Q").pages };
  const n = N.converterDadosDeEntrada(d);
  igual(n, 1, "uma página convertida");
  igual(d.pages[0].flags[MOD][D].type, "shop", "registro próprio nos dados");
  ok(!!d.pages[0].flags[MEJ], "as flags do Monk's continuam no JSON importado");
  igual(N.converterDadosDeEntrada(d), 0, "não converte duas vezes");
  igual(N.converterDadosDeEntrada({ name: "x", pages: [{ type: "text" }] }), 0, "diário comum: nada");
});

await teste("paginaPendenteDoMonks", async () => {
  ok(N.paginaPendenteDoMonks({ flags: { [MEJ]: { type: "shop" } } }), "só Monk's: pendente");
  ok(!N.paginaPendenteDoMonks({ flags: { [MEJ]: { type: "shop" }, [MOD]: { [D]: { type: "shop" } } } }), "já convertida: não");
  ok(!N.paginaPendenteDoMonks({ flags: {} }), "sem nada: não");
  ok(!N.paginaPendenteDoMonks(null), "nulo: não");
});

await teste("venda para a loja, estoque semanal e baú do combate usam o formato próprio", async () => {
  await iniciar();
  const P = await import("../scripts/partes/pechincha.js");
  const J = await import("../scripts/partes/janela.js");
  const { entry: loja } = await N.criarTipo("shop");
  const ator = await F.Actor.create({ name: "Ana", system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
    items: [{ _id: "ESCUDOESCUDOESCU", name: "Escudo", type: "equipment", system: { price: { value: 10, denomination: "gp" }, quantity: 3 } }] });
  // vender 2 escudos
  await P.ACOES_GM.vender({ entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: "ESCUDOESCUDOESCU", quantidade: 2 });
  let itens = Object.values(N.analisar(loja).m.items);
  igual(itens.length, 1, "um item no estoque");
  igual(itens[0].flags[MOD].qtd, 2, "quantidade vendida");
  ok(typeof itens[0].flags[MOD].preco === "number", "preço numérico");
  ok(!("origem" in itens[0].flags[MOD]), "item vindo da ficha não tem origem");
  ok(itens[0].flags[MEJ] === undefined, "sem flags do Monk's");
  igual(ator.system.currency.gp, 13, "a loja pagou 65% de 20 po = 13 po");
  // vender de novo junta com o igual
  await P.ACOES_GM.vender({ entryId: loja.id, userId: JOG, actorUuid: ator.uuid, itemId: "ESCUDOESCUDOESCU", quantidade: 1 });
  itens = Object.values(N.analisar(loja).m.items);
  igual(itens.length, 1, "ainda um item");
  igual(itens[0].flags[MOD].qtd, 3, "quantidades somadas");

  // estoque semanal por tabela
  const arco = await F.Item.create({ name: "Arco", type: "weapon", system: { price: { value: 25, denomination: "gp" }, quantity: 1 } });
  const tabela = { id: "TABELATABELATABE", name: "Armas", uuid: "RollTable.TABELATABELATABE", documentName: "RollTable",
    async roll() { return { results: [{ documentUuid: arco.uuid, name: "Arco" }] }; } };
  F.mundo.tables.set(tabela.id, tabela);
  await F.game.settings.set(MOD, "renovarAuto", true);
  await loja.pages.contents[0].update({ [`flags.${MOD}.semanal`]: { tabela: tabela.uuid, qtd: 2 } });
  await J.renovarEstoques();
  itens = Object.values(N.analisar(loja).m.items);
  igual(itens.length, 1, "estoque trocado por um item (duas rolagens do mesmo arco juntam)");
  igual(itens[0].name, "Arco", "o arco");
  igual(itens[0].flags[MOD].qtd, 2, "duas unidades");
  igual(itens[0].flags[MOD].preco, 25, "preço");
  igual(itens[0].flags[MOD].origem, arco.uuid, "origem do item");

  // baú do combate
  const inimigo = await F.Actor.create({ name: "Goblin", type: "npc", system: { currency: { gp: 2, sp: 5 }, attributes: { hp: { value: 0 } } },
    items: [{ name: "Cimitarra", type: "weapon", system: { price: { value: 25, denomination: "gp" }, quantity: 1 } }, { name: "Mordida", type: "weapon", system: { type: { value: "natural" } } }, { name: "Magia", type: "spell", system: {} }] });
  inimigo.hasPlayerOwner = false;
  const combat = { combatants: { contents: [{ actor: inimigo, defeated: true, name: "Goblin" }] }, scene: { name: "Caverna" } };
  F.dialogos.respostas.push(true);
  const bau = await N.criarBauDoCombate(combat);
  const a = N.analisar(bau);
  igual(a.tipo, "loot", "baú");
  const saque = Object.values(a.m.items);
  igual(saque.map((i) => i.name), ["Cimitarra"], "só o item saqueável (sem arma natural e sem magia)");
  igual(saque[0].flags[MOD].de, "Goblin", "origem do saque");
  igual(saque[0].flags[MOD].qtd, 1, "quantidade");
  ok(!("origem" in saque[0].flags[MOD]), "sem link para o item do inimigo");
  igual(a.m.currency.gp, 2, "moedas do inimigo");
  ok(bau.pages.contents[0]._source.flags[MEJ] === undefined, "sem flags do Monk's");
});

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) { console.log(falhas.join("\n")); process.exit(1); }
