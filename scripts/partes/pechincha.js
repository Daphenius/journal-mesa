/* Journal — negociação com o dono da loja e rolagens da pechincha.
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T, TF } from "../idioma.js";
import { lojaBloqueada } from "./calendario.js";
import { Sessao } from "./sessao.js";
import { CHAVE_DADOS, LIMITES_REGRAS, LV, MOD, REGRAS_CATS, REGRAS_MODELOS, REGRAS_STATUS, analisar, aviso, avisoUmaVez, chat, comoLista, diaAtual, dup, ehGM, esc, executarCompra, executarNota, executarPegar, executarPegarRecompensa, executarRolagemDiaria, formatarPreco, garantirObjeto, itemParaLoja, dadosPadrao, dadosSet, naFila, novoId, pedir, precoEmPo, receber, regrasMesa, relatarErro } from "../nucleo.js";

/* ---------- negociação com o dono da loja ---------- */

/* compra: % somado ao preço · venda: % do valor que a loja paga (empate = oferta padrão) */
const NEGOCIO_PADRAO = {
  compra: { critJ: -35, venceJ: -10, empate: 0, venceN: 10, critN: 35 },
  venda: { critJ: 100, venceJ: 75, empate: 65, venceN: 55, critN: 40 }
};
const RESULTADOS = [
  ["critJ", "Crítico do jogador", "achado"],
  ["venceJ", "Jogador vence", "achado"],
  ["empate", "Empate", "neutro"],
  ["venceN", "Vendedor vence", "escambo"],
  ["critN", "Crítico do vendedor", "escambo"]
];
const PERICIAS_VENDEDOR = { per: "Persuasão", ins: "Intuição", dec: "Enganação" };

function tabelaNegocio(x, modo) {
  return { ...NEGOCIO_PADRAO[modo], ...(x?.negocio?.[modo] ?? {}) };
}
function multNegocio(x, modo, res) {
  const v = Number(tabelaNegocio(x, modo)[res]) || 0;
  return modo === "compra" ? Math.max(0, 1 + v / 100) : Math.max(0, v / 100);
}
const multVendaPadrao = (x) => multNegocio(x, "venda", "empate");
function textoNegocio(x, modo, res) {
  const v = Number(tabelaNegocio(x, modo)[res]) || 0;
  const quem = res.endsWith("J") ? "jogador" : (res === "empate" ? "" : "vendedor");
  const abre = res.startsWith("crit") ? `${T("Crítico do")} ${quem}! ` : (res === "empate" ? T("Empate: ") : (quem === "jogador" ? T("Boa conversa! ") : T("O vendedor leva a melhor: ")));
  if (modo === "compra") return abre + (v === 0 ? T("preço normal.") : `${T("o preço")} ${v < 0 ? T("cai") : T("sobe")} ${Math.abs(v)}%.`);
  return abre + `${T("a loja paga")} ${v}${T("% do valor.")}`;
}

const bonusPericia = (ator, k) => Number(ator?.system?.skills?.[k]?.total ?? ator?.system?.skills?.[k]?.mod ?? 0) || 0;

async function atorDoDono(donoId) {
  const j = donoId ? game.journal.get(donoId) : null;
  const link = j ? analisar(j).m.actor : null;
  if (!link) return null;
  if (typeof link === "string") return fromUuid(link).catch(() => null);
  return link.uuid ? fromUuid(link.uuid).catch(() => null) : game.actors.get(link.id);
}

function negociacaoDeHoje(x, userId, chave) {
  const n = x.negociacoes?.[userId]?.[chave];
  return n && n.dia === diaAtual() ? n : null;
}

function resultadoDisputa(j, n) {
  if (j.total > n.total) return j.nat === 20 ? "critJ" : "venceJ";
  if (n.total > j.total) return n.nat === 20 ? "critN" : "venceN";
  return "empate";
}

const FORMULA_MODO = { normal: "1d20", v: "2d20kh", d: "2d20kl" };

/* ---------- rolagens da pechincha ----------
 * Quem sorteia é sempre o computador do MESTRE (o número não pode ser trocado pelo console do jogador).
 * O jogador continua rolando de verdade: com o Dados em Cena ativo, a tela de rolagem abre para ele e ele
 * escolhe vantagem/desvantagem e clica no d20 dele; sem o módulo, ele clica no cartão do chat. Nos dois casos
 * os dados 3D (Dice So Nice) aparecem com as cores e o nome do jogador e a rolagem usa a ficha dele. */
const DEC = "dados-em-cena";
const dadosApi = () => (game.modules.get(DEC)?.active && typeof game.modules.get(DEC).api?.pedirTestes === "function" ? game.modules.get(DEC).api : null);

/** Teste de perícia pela ficha (bônus, efeitos e vantagens do sistema), sorteado aqui (no mestre).
 *  Sem ficha ou sem o D&D 5e: d20 + bônus. usuario = dono dos dados 3D na animação. */
async function rolarPericiaSegura({ actorUuid = null, pericia = "per", modo = "normal", bonus = 0, userId = null } = {}) {
  const ator = actorUuid ? fromUuidSync(actorUuid) : null;
  const usuario = game.users.get(userId) ?? game.user;
  let r = null;
  if (ator?.rollSkill && CONFIG.DND5E?.skills?.[pericia]) {
    try {
      const cfg = { skill: pericia };
      if (modo === "v") cfg.advantage = true;
      if (modo === "d") cfg.disadvantage = true;
      r = (await ator.rollSkill(cfg, { configure: false }, { create: false }))?.[0] ?? null;
    } catch (err) { avisoUmaVez(T("rolagem pela ficha"), err); }
  }
  if (!r) r = await new Roll(`${FORMULA_MODO[modo] ?? "1d20"} + ${Number(bonus) || 0}`).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(r, usuario, true).catch(() => null);
  const d = r.d20 ?? r.dice[0];
  const nat = d?.total ?? 0;
  return { total: r.total, nat, modo, bonus: r.total - nat, dados: (d?.results ?? []).map((x) => ({ v: x.result, ativo: x.active !== false })) };
}

/** Resultado do Dados em Cena → formato do cartão da pechincha. */
const rolagemDaCena = (r) => (r ? {
  total: r.total, nat: r.nat, modo: { adv: "v", dis: "d" }[r.modo] ?? "normal", bonus: Number(r.mod) || 0,
  dados: (r.dados ?? []).map((x) => ({ v: x.v, ativo: !x.d }))
} : null);

/** Com o Dados em Cena: abre a tela de rolagem para o jogador (e para o mestre, com o vendedor) e grava
 *  os resultados no cartão. Roda fora da fila do mestre (o jogador pode levar minutos para rolar). */
async function conduzirPechinchaEmCena(msgId) {
  const api = dadosApi();
  const msg = game.messages.get(msgId);
  const est = msg?.getFlag(MOD, "negocio");
  const jogador = est?.j?.actorUuid ? fromUuidSync(est.j.actorUuid) : null;
  if (!api || !est || !jogador) return;
  const npc = est.n.actorUuid ? fromUuidSync(est.n.actorUuid) : null;
  const participantes = [{ actorId: jogador.id, config: { kind: "skill", key: "per", label: T("Persuasão") }, rotulo: "JOGADOR" }];
  if (npc && npc.id !== jogador.id) participantes.push({ actorId: npc.id, config: { kind: "skill", key: est.n.chave ?? "per", label: est.n.pericia }, rotulo: "VENDEDOR" });
  let res = new Map();
  try { res = await api.pedirTestes({ participantes, para: [est.userId], titulo: `${T("Pechincha")}: ${est.nome}` }) ?? new Map(); }
  catch (err) { relatarErro(T("pechincha no Dados em Cena"), err); }
  await naFila("gm", async () => {
    const m2 = game.messages.get(msgId);
    const e = dup(m2?.getFlag(MOD, "negocio") ?? null);
    if (!e || e.res) return;
    e.j.roll ??= rolagemDaCena(res.get(jogador.id));
    if (npc && npc.id !== jogador.id) e.n.roll ??= rolagemDaCena(res.get(npc.id));
    else if (!e.n.roll && e.j.roll) e.n.roll = await rolarPericiaSegura({ pericia: e.n.chave, bonus: e.n.bonus });   // vendedor sem ficha
    e.emCena = false;   // quem não rolou a tempo ganha os botões no chat
    await m2.update({ content: htmlNegocio(e), [`flags.${MOD}.negocio`]: e });
    if (e.j.roll && e.n.roll) await resolverNegocio(m2);
  });
}

/** Prepara a disputa (o mestre executa). Cria o cartão interativo no chat ou rola tudo de uma vez. */
async function executarNegociar({ entryId, userId, actorUuid, modo, alvoId, nome }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  if (lojaBloqueada(e, userId)) return aviso(userId, T("A loja está fechada agora."), "warn");
  const { page, x } = analisar(e);
  const ator = await fromUuid(actorUuid);
  if (!page || !ator) return aviso(userId, T("Personagem não encontrado."), "warn");
  const chave = `${modo === "compra" ? "c" : "v"}_${alvoId}`;
  if (negociacaoDeHoje(x, userId, chave)) return aviso(userId, T("Você já negociou esse item hoje."), "warn");

  const pericia = PERICIAS_VENDEDOR[x.vendedorPericia] ? x.vendedorPericia : "per";
  const npc = await atorDoDono(x.dono);
  const dono = game.journal.get(x.dono);
  const estado = {
    entryId, userId, modo, chave, nome, loja: e.name, res: null,
    j: { nome: ator.name, img: ator.img, pericia: T("Persuasão"), chave: "per", actorUuid: ator.uuid, bonus: bonusPericia(ator, "per"), roll: null },
    n: {
      nome: dono?.name ?? npc?.name ?? e.name,
      img: (dono ? analisar(dono).page?.src : null) ?? npc?.img ?? "icons/svg/mystery-man.svg",
      pericia: PERICIAS_VENDEDOR[pericia],
      chave: pericia,
      actorUuid: npc?.uuid ?? null,
      bonus: npc ? bonusPericia(npc, pericia) : (Number(x.vendedorBonus) || 0),
      roll: null
    }
  };

  if (!game.settings.get(MOD, "pechinchaChat")) {
    estado.j.roll = await rolarPericiaSegura({ actorUuid: estado.j.actorUuid, pericia: "per", bonus: estado.j.bonus, userId });
    estado.n.roll = await rolarPericiaSegura({ actorUuid: estado.n.actorUuid, pericia, bonus: estado.n.bonus });
    await page.setFlag(MOD, `negociacoes.${userId}.${chave}`, { dia: diaAtual(), pendente: true });
    const msg = await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: ator }), content: "…", flags: { [MOD]: { negocio: estado } } });
    return resolverNegocio(msg);
  }

  await page.setFlag(MOD, `negociacoes.${userId}.${chave}`, { dia: diaAtual(), pendente: true });
  // com o Dados em Cena: a rolagem acontece na tela dele, e o cartão mostra "rolando na tela"
  const emCena = !!dadosApi();
  if (emCena) estado.emCena = true;
  const msg = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: htmlNegocio(estado),
    flags: { [MOD]: { negocio: estado } }
  });
  if (emCena && msg) conduzirPechinchaEmCena(msg.id).catch((err) => relatarErro(T("pechincha no Dados em Cena"), err));
}

/** Pedido de rolagem no cartão da pechincha. Quem rola é sempre o mestre (com o bônus e o modo pedidos):
 *  antes o resultado vinha pronto do cliente do jogador e podia ser forjado pelo console. */
async function executarRolarNegocio({ msgId, lado, modo, userId }) {
  const msg = game.messages.get(msgId);
  const estado = dup(msg?.getFlag(MOD, "negocio") ?? null);
  if (!estado || estado.res || !["j", "n"].includes(lado)) return;
  if (lado === "j" && userId !== estado.userId && !game.users.get(userId)?.isGM) return;
  if (lado === "n" && !game.users.get(userId)?.isGM) return;
  if (estado[lado].roll || estado.emCena) return;
  // o jogador clicou; o sorteio é aqui, com a ficha dele e os dados 3D no nome dele
  estado[lado].roll = await rolarPericiaSegura({
    actorUuid: estado[lado].actorUuid, pericia: estado[lado].chave ?? "per", bonus: estado[lado].bonus,
    modo: FORMULA_MODO[modo] ? modo : "normal", userId: lado === "j" ? estado.userId : userId
  });
  await msg.update({ content: htmlNegocio(estado), [`flags.${MOD}.negocio`]: estado });
  if (estado.j.roll && estado.n.roll) await resolverNegocio(msg);
}

async function resolverNegocio(msg) {
  const estado = dup(msg.getFlag(MOD, "negocio"));
  const e = game.journal.get(estado.entryId);
  const a = e ? analisar(e) : null;
  estado.res = resultadoDisputa(estado.j.roll, estado.n.roll);
  estado.mult = multNegocio(a?.x, estado.modo, estado.res);
  estado.texto = textoNegocio(a?.x, estado.modo, estado.res);
  if (a?.page) await a.page.setFlag(MOD, `negociacoes.${estado.userId}.${estado.chave}`, { dia: diaAtual(), mult: estado.mult, res: estado.res });
  await msg.update({ content: htmlNegocio(estado), [`flags.${MOD}.negocio`]: estado });
}

/** Cartão da disputa no chat (estilo Epic Roll leve). */
function htmlNegocio(est) {
  const sinal = (b) => (b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`);
  const lado = (k, rotulo) => {
    const l = est[k];
    const r = l.roll;
    const ganhou = est.res && (k === "j" ? est.res.endsWith("J") : est.res.endsWith("N"));
    const perdeu = est.res && est.res !== "empate" && !ganhou;
    const marca = !est.res ? "" : (ganhou ? `<i class="fa-solid fa-check jm-ganhou"></i>` : (perdeu ? `<i class="fa-solid fa-xmark jm-perdeu"></i>` : `<i class="fa-solid fa-equals"></i>`));
    const modoTxt = { normal: "1d20", v: T("Vantagem (2d20, fica o maior)"), d: T("Desvantagem (2d20, fica o menor)") }[r?.modo] ?? "1d20";
    const detalhe = r ? `<div class="jm-neg-dados ${k}">
        <span class="jm-neg-modo">${modoTxt}</span>
        <span class="jm-neg-conta">${r.dados.map((d) => `<span class="d20 ${d.ativo ? "" : "descartado"} ${d.v === 20 ? "max" : ""} ${d.v === 1 ? "min" : ""}" data-tooltip="${d.ativo ? T("Dado usado") : T("Dado descartado")}">${d.v}</span>`).join("")}
          <small>${sinal(r.bonus)} (${esc(l.pericia)}) = <b>${r.total}</b></small></span></div>` : "";
    const acoes = (!r && est.emCena)
      ? `<span class="jm-neg-aguarda" data-tooltip="${T("A rolagem está aberta na tela do Dados em Cena")}"><i class="fa-solid fa-dice-d20 fa-spin"></i> ${T("rolando na tela")}</span>`
      : r
      ? `<a class="jm-neg-total ${r.nat === 20 ? "crit" : ""}">${r.total}</a>${r.modo !== "normal" ? `<span class="jm-neg-modo-tag">${r.modo === "v" ? "V" : "D"}</span>` : ""}${marca}`
      : `<span class="jm-neg-botoes" data-lado="${k}">
          <button type="button" data-jm-rolar="${k}" data-modo="d" data-tooltip="${T("Desvantagem")}">D</button>
          <button type="button" data-jm-rolar="${k}" data-modo="v" data-tooltip="${T("Vantagem")}">V</button>
          <button type="button" data-jm-rolar="${k}" data-modo="normal" data-tooltip="${T("Rolar")} ${esc(l.pericia)} (${sinal(l.bonus)})"><i class="fa-solid fa-dice-d20"></i></button>
        </span>`;
    return `<div class="jm-neg-rotulo ${k}">${rotulo} · ${esc(l.pericia.toUpperCase())}</div>
      <div class="jm-neg-linha ${k} ${r ? "rolado" : ""}" ${r ? `data-jm-ver="${k}" data-tooltip="${T("Clique para ver os dados")}"` : ""}>
        <img src="${esc(l.img)}" alt=""><b>${esc(l.nome)}</b>${acoes}
      </div>${detalhe}`;
  };
  const rodape = est.res
    ? `<div class="jm-neg-res ${est.res}"><i class="fa-solid fa-trophy"></i> ${esc(est.texto)}</div>`
    : `<div class="jm-neg-espera">${T("Aguardando as rolagens…")}</div>`;
  return `<div class="jm-chat jm-neg" data-jm-negocio>
    <div class="jm-neg-titulo"><i class="fa-solid fa-handshake"></i> ${T("Pechincha")}: ${est.modo === "compra" ? T("comprar") : T("vender")} <b>${esc(est.nome)}</b></div>
    ${lado("j", T("Jogador"))}${lado("n", T("Vendedor"))}${rodape}
    <div class="jm-neg-loja">${esc(est.loja)}</div>
  </div>`;
}

/** Liga os botões do cartão de pechincha quando ele aparece no chat. */
function ligarCartaoNegocio(msg, html) {
  const root = html instanceof HTMLElement ? html : null;
  const card = root?.querySelector("[data-jm-negocio]");
  if (!card) return;
  const estado = msg.getFlag(MOD, "negocio");
  card.querySelectorAll(".jm-neg-botoes").forEach((grupo) => {
    const lado = grupo.dataset.lado;
    const pode = lado === "j" ? (game.user.id === estado?.userId || ehGM()) : ehGM();
    if (!pode) { grupo.innerHTML = `<span class="jm-neg-aguarda" data-tooltip="${T("Aguardando")} ${lado === "j" ? T("o jogador") : T("o mestre")}"><i class="fa-solid fa-hourglass-half"></i></span>`; return; }
    grupo.querySelectorAll("[data-jm-rolar]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      grupo.querySelectorAll("button").forEach((x2) => { x2.disabled = true; });
      pedir("rolarNegocio", { msgId: msg.id, lado, modo: b.dataset.modo, userId: game.user.id });
    }));
  });
  card.querySelectorAll("[data-jm-ver]").forEach((linha) => linha.addEventListener("click", (ev) => {
    ev.preventDefault();
    card.classList.toggle(`mostrar-${linha.dataset.jmVer}`);
  }));
}

async function executarVender({ entryId, userId, actorUuid, itemId, quantidade = 1 }) {
  const e = game.journal.get(entryId);
  if (!e) return;
  if (lojaBloqueada(e, userId)) return aviso(userId, T("A loja está fechada agora."), "warn");
  const { page, m, x } = analisar(e);
  const ator = await fromUuid(actorUuid);
  const item = ator?.items.get(itemId);
  if (!page || !item) return aviso(userId, T("Item não encontrado."), "warn");
  const tem = Number(item.system?.quantity) || 1;
  const n = Math.min(tem, Math.max(1, Math.floor(Number(quantidade) || 1)));
  const base = precoEmPo(item);
  const neg = negociacaoDeHoje(x, userId, `v_${itemId}`);
  const mult = neg?.mult ?? multVendaPadrao(x);
  const valor = Math.round(base * mult * n * 100) / 100;
  if (valor <= 0) return aviso(userId, T("Esse item não tem valor de venda."), "warn");

  /* ordem segura: o item sai da ficha, o jogador recebe o ouro e só então o item entra no estoque da loja.
   * Se algum passo falhar, os anteriores são desfeitos (o jogador não fica sem o item e sem o ouro,
   * e a loja não fica com um item duplicado). */
  const copia = item.toObject();
  const moedasAntes = dup(ator.system?.currency ?? {});
  const desfazer = [];
  try {
    if (tem > n) { await item.update({ "system.quantity": tem - n }); desfazer.push(() => item.update({ "system.quantity": tem })); }
    else { await item.delete(); desfazer.push(() => ator.createEmbeddedDocuments("Item", [copia], { keepId: true })); }
    await ator.update({ "system.currency": receber(ator, valor) });
    desfazer.push(() => ator.update({ "system.currency": moedasAntes }));

    /* vai para o estoque da loja: junta com um item igual, se houver */
    await garantirObjeto(page, "items");
    const igual = comoLista(m.items).find(([, it]) => it.name === item.name && it.type === item.type);
    if (igual) {
      const atual = igual[1].flags?.[MOD]?.qtd;
      if (typeof atual === "number") await dadosSet(page, `items.${igual[0]}.flags.${MOD}.qtd`, atual + n);
    } else {
      const paraLoja = itemParaLoja(item, {}, n);
      delete paraLoja.flags?.[MOD]?.origem;   // o item da ficha do jogador sai dela; sem link de origem
      if (paraLoja.system && "quantity" in paraLoja.system) paraLoja.system.quantity = 1;
      await dadosSet(page, `items.${paraLoja._id}`, paraLoja);
    }
  } catch (err) {
    for (const passo of desfazer.reverse()) {
      try { await passo(); } catch (err2) { console.error(`${T("Journal da Mesa")} | ${T("não consegui desfazer a venda")}`, err2); }
    }
    throw err;
  }
  if (neg) await page.unsetFlag(MOD, `negociacoes.${userId}.v_${itemId}`);
  const linha = TF("{quem} vendeu {n}{item} para {loja} por {preco}.", { quem: `<b>${esc(ator.name)}</b>`, n: n > 1 ? `<b>${n}×</b> ` : "", item: `<b>${esc(item.name)}</b>`, loja: `<b>${esc(e.name)}</b>`, preco: formatarPreco(valor) });
  await chat(`<i class="fa-solid fa-hand-holding-dollar"></i> ${linha}`, { ator });
  Sessao.registrar("loja", linha);
}

/** Regras da Mesa: executado pelo mestre (pedido dele mesmo ou de um jogador, já validado). */
async function executarRegras({ userId, op, id, cid, cat, titulo, texto, status, voto, anonimo }) {
  const u = game.users.get(userId);
  if (!u) return;
  const gm = u.isGM;
  const r = dup(regrasMesa());
  const corta = (t, n) => String(t ?? "").trim().slice(0, n);
  const item = id ? r.itens.find((i) => i.id === id) : null;
  const autorDe = (i) => i?.autor === userId;
  const negar = (msg) => aviso(userId, msg, "warn");
  switch (op) {
    case "propor": {
      if (r.itens.length >= LIMITES_REGRAS.itens) return negar(T("Limite de tópicos atingido."));
      const t = corta(titulo, LIMITES_REGRAS.titulo);
      if (!t) return negar(T("Escreva um título para a proposta."));
      r.itens.push({ id: novoId(), cat: REGRAS_CATS[cat] ? cat : "casa", titulo: t, texto: corta(texto, LIMITES_REGRAS.texto),
        status: gm ? "discussao" : "proposta", autor: anonimo ? null : userId, criado: Date.now(), votos: {}, comentarios: [] });
      break;
    }
    case "editar": {
      if (!item || !(gm || (autorDe(item) && item.status === "proposta"))) return negar(T("Você não pode editar este tópico."));
      const t = corta(titulo, LIMITES_REGRAS.titulo);
      if (t) item.titulo = t;
      item.texto = corta(texto, LIMITES_REGRAS.texto);
      if (REGRAS_CATS[cat]) item.cat = cat;
      break;
    }
    case "apagar":
      if (!item || !(gm || (autorDe(item) && item.status === "proposta"))) return negar(T("Você não pode apagar este tópico."));
      r.itens = r.itens.filter((i) => i.id !== id);
      break;
    case "status":
      if (!gm || !item || !REGRAS_STATUS[status]) return;
      item.status = status;
      break;
    case "votar":
      if (!item) return;
      item.votos ??= {};
      if (voto === "sim" || voto === "nao") item.votos[userId] = voto; else delete item.votos[userId];
      break;
    case "comentar": {
      if (!item) return;
      const t = corta(texto, LIMITES_REGRAS.comentario);
      if (!t) return;
      item.comentarios ??= [];
      if (item.comentarios.length >= LIMITES_REGRAS.comentarios) return negar(T("Limite de comentários neste tópico."));
      item.comentarios.push({ id: novoId(), autor: anonimo ? null : userId, texto: t, t: Date.now() });
      break;
    }
    case "apagarComentario": {
      if (!item) return;
      const c = (item.comentarios ?? []).find((x) => x.id === cid);
      if (!c || !(gm || c.autor === userId)) return negar(T("Você não pode apagar este comentário."));
      item.comentarios = item.comentarios.filter((x) => x.id !== cid);
      break;
    }
    case "modelos": {
      if (!gm) return;
      const ja = new Set(r.itens.map((i) => i.titulo.toLowerCase()));
      for (const [c, t, d] of REGRAS_MODELOS) if (!ja.has(t.toLowerCase())) r.itens.push({ id: novoId(), cat: c, titulo: t, texto: d, status: "discussao", autor: userId, criado: Date.now(), votos: {}, comentarios: [] });
      break;
    }
    case "concluir":
      if (!gm) return;
      r.sessao0 = r.sessao0?.concluida ? { concluida: false } : { concluida: true, quando: Date.now() };
      break;
    default: return;
  }
  await game.settings.set(MOD, "regrasMesa", r);
}

/** Mestre: cria ou atualiza o Diário "Regras da Mesa" com os combinados, para todos lerem. */
async function gerarDiarioRegras() {
  if (!ehGM()) return;
  const { itens, sessao0 } = regrasMesa();
  const acordadas = itens.filter((i) => i.status === "acordada");
  if (!acordadas.length) return ui.notifications.warn(T("Nenhum tópico está como Combinado ainda."));
  let html = `<p>${sessao0?.concluida ? `${T("Combinados da sessão 0")} (${esc(new Date(sessao0.quando).toLocaleDateString(game.i18n.lang))}).` : T("Combinados da mesa até agora.")}</p>`;
  for (const [k, [rot]] of Object.entries(REGRAS_CATS)) {
    const l = acordadas.filter((i) => i.cat === k);
    if (!l.length) continue;
    html += `<h2>${esc(rot)}</h2><ul>${l.map((i) => `<li><b>${esc(i.titulo)}</b>${i.texto ? `: ${esc(i.texto).replace(/\n/g, "<br>")}` : ""}</li>`).join("")}</ul>`;
  }
  let e = game.journal.find((j) => j.getFlag(MOD, "regrasMesa"));
  if (e) {
    const p = e.pages.contents[0];
    if (p) await p.update({ "text.content": html });
    else await e.createEmbeddedDocuments("JournalEntryPage", [{ name: T("Regras da Mesa"), type: "text", text: { content: html } }]);
  } else {
    e = await JournalEntry.create({
      name: T("Regras da Mesa"), ownership: { default: LV().OBSERVER }, flags: { [MOD]: { regrasMesa: true } },
      pages: [{ name: T("Regras da Mesa"), type: "text", text: { content: html }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao("journalentry") } } }]
    });
  }
  ui.notifications.info(`${T("Diário \"Regras da Mesa\" atualizado com")} ${acordadas.length} ${T("combinado(s).")}`);
  return e;
}

const ACOES_GM = {
  regras: executarRegras,
  rolarDiaria: executarRolagemDiaria, comprar: executarCompra, pegar: executarPegar, nota: executarNota,
  pegarRecompensa: executarPegarRecompensa, negociar: executarNegociar, vender: executarVender,
  rolarNegocio: executarRolarNegocio
};

export { ACOES_GM, NEGOCIO_PADRAO, PERICIAS_VENDEDOR, RESULTADOS, atorDoDono, bonusPericia, gerarDiarioRegras, ligarCartaoNegocio, multVendaPadrao, negociacaoDeHoje, tabelaNegocio };
