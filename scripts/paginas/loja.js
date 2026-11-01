/* Journal — página de Loja (tipo "shop"): dono e horário no cabeçalho; balcão com estoque da semana,
 * oferta do dia, vender e configurar (pechincha, horário, tabelas). */
import { T } from "../idioma.js";
import { tabelasDasLojas, tabelaDaLoja, nomeTabela } from "../lojas/tabelas.js";
import { Tempo, horaParaMin, horarioLoja, minParaHora, textoHorarioLoja } from "../partes/calendario.js";
import { PERICIAS_VENDEDOR, RESULTADOS, atorDoDono, bonusPericia, multVendaPadrao, negociacaoDeHoje, tabelaNegocio } from "../partes/pechincha.js";
import { souGMPrincipal } from "../partes/sessao.js";
import { CHAVE_DADOS, Dialogo, MOD, OFERTAS, TE, TIPOS_SAQUE, analisar, apagarChave, atorDoJogador, chat, diaAtual, ehGM, esc, estaVisivel, formatarPreco, idsGM, itemParaLoja, dadosSet, opcoes, pedir, precoEmPo, qtdDaFicha, resultadoParaItem, substituirMapa } from "../nucleo.js";
import { listaItens } from "./estoque.js";

async function cartaOferta(o, visaoGM, linkItem, userId = "") {
  const cfg = OFERTAS[o.tipo] ?? OFERTAS.achado;
  let extra = "";
  if (o.tipo === "escambo") extra = visaoGM
    ? `<div class="jm-custo"><i class="fa-solid fa-skull"></i> ${T("Janela.CustoOculto")}: ${esc(o.custoOculto)}</div>`
    : (o.comprado
      ? `<div class="jm-custo misterio"><i class="fa-solid fa-handshake"></i> ${T("Janela.AcordoFechadoOQueEle")}</div>`
      : `<div class="jm-custo misterio"><i class="fa-solid fa-question"></i> ${T("Janela.OVendedorSorriUmPouco")}</div>`);
  const riscado = o.tipo !== "luxo" && o.precoBase > o.preco ? `<s>${formatarPreco(o.precoBase)}</s>` : "";
  let acao;
  if (o.comprado) acao = `<span class="jm-comprado"><i class="fa-solid fa-check"></i> ${T("Janela.Comprado")}</span>`;
  else if (visaoGM) acao = `<button type="button" class="sec" data-action="limparOferta" data-user="${userId}" data-tooltip="${T("Janela.PermitirQueRoleDeNovo")}"><i class="fa-solid fa-rotate"></i></button>`;
  else acao = `<button type="button" class="primario" data-action="comprarDiaria"><i class="fa-solid fa-coins"></i> ${T("Janela.Comprar")}</button>`;
  return `<div class="jm-oferta ${o.tipo} ${o.comprado ? "comprada" : ""}">
    <img src="${esc(o.img)}" alt="">
    <div class="info">
      <span class="jm-tag ${o.tipo}">${cfg.rotulo}</span>
      <div class="nome">${await linkItem(o.uuid, o.nome)}</div>
      <small>${cfg.desc}</small>
      <div class="preco">${riscado} <b>${formatarPreco(o.preco)}</b></div>
      ${extra}
    </div>
    <div class="acao">${acao}</div>
  </div>`;
}

async function secaoLoja(ctx) {
  const { entry, a, ed, app, secao } = ctx;
  const { m, x } = a;
  const gm = ehGM();
  const fechada = textoHorarioLoja(entry);
  if (fechada && !fechada.aberta && !gm) {
    const h = horarioLoja(entry);
    return secao(T("Janela.Balcao"), "fa-solid fa-store", `<div class="jm-loja-fechada"><i class="fa-solid fa-door-closed"></i>
      <b>${fechada.texto === T("Comum.FolgaHoje") ? T("Janela.ALojaEstaDeFolga") : T("Janela.ALojaEstaFechada")}</b>
      <span>${h.abre !== h.fecha ? `${T("Janela.FuncionaDas")} ${minParaHora(h.abre)} ${T("Janela.As")} ${minParaHora(h.fecha)}` : ""}${h.folga.length ? ` · ${T("Janela.Folga")}: ${h.folga.map((i) => Tempo.semana()[i] ?? "?").join(", ")}` : ""}</span></div>`, "jm-loja");
  }
  const sub = app.subLoja;
  const tabs = [["semanal", T("Comum.EstoqueDaSemana"), "fa-solid fa-calendar-week"], ["diaria", T("Janela.OfertaDoDia"), "fa-solid fa-sun"], ["vender", T("Janela.Vender"), "fa-solid fa-hand-holding-dollar"]];
  if (gm) tabs.push(["config", T("Janela.Configurar"), "fa-solid fa-sliders"]);
  const nav = `<div class="jm-subabas">${tabs.map(([k, r, i]) => `<button type="button" class="${sub === k ? "ativo" : ""}" data-action="subLoja" data-sub="${k}"><i class="${i}"></i> ${r}</button>`).join("")}</div>`
    + (gm && fechada && !fechada.aberta ? `<div class="jm-aviso-loja"><i class="fa-solid fa-door-closed"></i> ${esc(fechada.texto)}: ${T("Janela.OsJogadoresNaoConseguemComprar")}</div>` : "");
  const tabelas = tabelasDasLojas([x.semanal.tabela, x.diaria.tabela]);
  /* sem tabela própria: a padrão das configurações do módulo (Tabelas de itens das lojas) */
  const vazioTabela = (tipo) => { const p = tabelaDaLoja("", tipo); return p ? `— ${T("Comum.Padrao")}: ${nomeTabela(p) || "?"} —` : T("Janela.EscolhaUmaTabela"); };
  const linkItem = async (uuid, nome) => uuid ? await TE().enrichHTML(`@UUID[${uuid}]{${String(nome).replace(/[{}]/g, "")}}`) : esc(nome);
  let corpo = "";

  if (sub === "semanal") {
    const barra = gm ? `<div class="jm-barra">
        <label>${T("Janela.Tabela")} <select data-campo="x:semanal.tabela">${opcoes(tabelas, x.semanal.tabela, vazioTabela("semanal"))}</select></label>
        <label class="curto">${T("Janela.Itens")} <input type="number" min="1" max="40" data-campo="x:semanal.qtd" data-num value="${x.semanal.qtd}"></label>
        <button type="button" class="primario" data-action="rolarSemanal"><i class="fa-solid fa-dice"></i> ${T("Janela.RenovarEstoque")}</button>
        <button type="button" class="sec" data-action="exportarItens" data-tooltip="${T("Janela.CopiarOsItensParaA")}"><i class="fa-solid fa-file-export"></i></button>
        <button type="button" class="sec" data-action="limparSemanal" data-tooltip="${T("Janela.EsvaziarEstoque")}"><i class="fa-solid fa-broom"></i></button>
      </div>` : "";
    const linhas = await listaItens(m, ed, "loja", x);
    const vazio = `<p class="jm-vazio">${gm ? T("Janela.EstoqueVazioRenovePelaTabela") : T("Janela.AsPrateleirasEstaoVaziasEsta")}</p>`;
    corpo = barra + `<div class="jm-produtos" ${gm ? `data-drop="itemLoja"` : ""}>${linhas.join("") || vazio}
      ${gm && linhas.length ? `<p class="jm-dica">${T("Janela.ArrasteItensParaCaPara")}</p>` : ""}</div>`;
  }

  if (sub === "diaria") {
    const dia = diaAtual();
    const minha = x.diaria.ofertas[game.user.id];
    let topo;
    if (minha && minha.dia === dia) topo = await cartaOferta(minha, false, linkItem);
    else if (tabelaDaLoja(x.diaria.tabela, "diaria")) topo = `<div class="jm-rolar">
        <p>${T("Janela.OBalcaoMudaTodoDia")} <b>${T("Janela.Achado")}</b>, ${T("Janela.Uma")} <b>${T("Janela.Raridade")}</b>... ${T("Janela.OuUm")} <b>${T("Janela.Escambo")}</b> ${T("Janela.BaratoDemaisParaSerVerdade")}</p>
        <button type="button" class="primario grande" data-action="rolarDiaria"><i class="fa-solid fa-dice-d20"></i> ${T("Janela.RolarOfertaDoDia")}</button>
      </div>`;
    else topo = `<p class="jm-vazio">${gm ? T("Janela.DefinaATabelaDasOfertas") : T("Janela.HojeNaoHaOfertasEspeciais")}</p>`;
    let outras = "";
    if (gm) {
      const lista = Object.entries(x.diaria.ofertas).filter(([u, o]) => u !== game.user.id && o?.dia === dia);
      const cartas = [];
      for (const [u, o] of lista) cartas.push(`<div class="jm-oferta-de"><span><i class="fa-solid fa-user"></i> ${esc(game.users.get(u)?.name ?? "?")}</span>${await cartaOferta(o, true, linkItem, u)}</div>`);
      outras = `<h4 class="jm-h4">${T("Janela.OfertasDosJogadoresHoje")}</h4>${cartas.join("") || `<p class="jm-vazio">${T("Janela.NinguemRolouAindaHoje")}</p>`}`;
    }
    corpo = `<div class="jm-dia-info"><i class="fa-solid fa-sun"></i> ${T("Comum.Dia2")} ${dia}</div>${topo}${outras}`;
  }

  if (sub === "vender") {
    const ator = atorDoJogador();
    if (!ator) corpo = `<p class="jm-vazio">${T("Janela.SelecioneSeuTokenOuDefina2")}</p>`;
    else {
      const vendiveis = ator.items.filter((i) => TIPOS_SAQUE.includes(i.type) && precoEmPo(i) > 0 && qtdDaFicha(i) >= 1)
        .sort((a2, b2) => a2.name.localeCompare(b2.name, game.i18n.lang));
      const padrao = multVendaPadrao(x);
      const linhas = vendiveis.map((it) => {
        const base = precoEmPo(it);
        const neg = negociacaoDeHoje(x, game.user.id, `v_${it.id}`);
        const mult = neg?.mult ?? padrao;
        const oferta = Math.round(base * mult * 100) / 100;
        const qtd = qtdDaFicha(it);
        const pendente = neg && neg.mult == null;
        return `<div class="jm-produto venda">
          <img src="${esc(it.img)}" alt="">
          <div class="nome">${esc(it.name)}<small class="jm-de">${T("Janela.Vale")} ${formatarPreco(base)} ${T("Janela.Cada")}${qtd > 1 ? ` · ${T("Janela.VoceTem")} ${qtd}` : ""}</small></div>
          <div class="preco">${formatarPreco(oferta)}<small class="jm-ajuste ${neg?.mult != null ? (mult >= padrao ? "bom" : "ruim") : ""}">${Math.round(mult * 100)}%</small></div>
          <div class="qtd">${neg?.mult != null ? `<i class="fa-solid fa-handshake" data-tooltip="${T("Janela.JaNegociadoHoje")}"></i>` : ""}</div>
          <div class="acoes">
            ${pendente ? `<span class="jm-neg-pendente" data-tooltip="${T("Janela.PechinchaEmAndamentoNoChat")}"><i class="fa-solid fa-hourglass-half"></i></span>`
              : (neg ? "" : `<button type="button" class="sec" data-action="negociarVenda" data-id="${it.id}" data-nome="${esc(it.name)}" data-tooltip="${T("Janela.PechincharPersuasaoContraOVendedor")}"><i class="fa-solid fa-handshake"></i></button>`)}
            ${qtd > 1 ? `<input type="number" class="jm-qtd" min="1" max="${qtd}" value="1" data-tooltip="${T("Janela.QuantosVender")}">` : ""}
            <button type="button" class="primario" data-action="vender" data-id="${it.id}"><i class="fa-solid fa-hand-holding-dollar"></i> ${T("Janela.Vender")}</button>
          </div></div>`;
      });
      const t = tabelaNegocio(x, "venda");
      corpo = `<div class="jm-dica jm-venda-dica"><i class="fa-solid fa-circle-info"></i> ${T("Janela.ALojaPaga")} <b>${t.empate}%</b> ${T("Janela.DoValorPechinchandoSeVoce")}, ${t.venceJ}${T("Janela.Critico")}: ${t.critJ}${T("Janela.SeOVendedorVencer")}, ${t.venceN}${T("Janela.CriticoDele")}: ${t.critN}${T("Janela.UmaTentativaPorItemPor")}</div>
        <div class="jm-produtos">${linhas.join("") || `<p class="jm-vazio">${esc(ator.name)} ${T("Janela.NaoTemNadaQueEsta")}</p>`}</div>`;
    }
  }

  if (sub === "config" && gm) {
    const ch = x.diaria.chances;
    const npc = await atorDoDono(x.dono);
    const h = horarioLoja(entry);
    const semana = Tempo.semana();
    corpo = `<div class="jm-config">
      <div class="jm-config-horario">
        <h4><i class="fa-solid fa-clock"></i> ${T("Janela.Horario")}</h4>
        <label class="jm-check"><input type="checkbox" data-campo="x:horario.ativo" ${h?.ativo ? "checked" : ""}> ${T("Janela.RespeitarHorarioEFolgasFechada")}</label>
        <div class="jm-sub-linha ${h?.ativo ? "" : "desligado"}">
          <label class="jm-sub-campo">${T("Janela.Abre")} <input type="text" data-horario="opening" value="${minParaHora(h?.abre ?? 480)}" placeholder="08:00"></label>
          <label class="jm-sub-campo">${T("Janela.Fecha")} <input type="text" data-horario="closing" value="${minParaHora(h?.fecha ?? 1020)}" placeholder="17:00"></label>
          <span class="jm-dica">${T("Janela.FecharAntesDeAbrirVira")}</span>
        </div>
        ${semana.length ? `<div class="jm-cal-semana jm-folgas ${h?.ativo ? "" : "inativo"}"><span>${T("Janela.Folga2")}:</span>${semana.map((nome, i) =>
          `<label class="jm-dia-sem ${h?.folga.includes(i) ? "marcado" : ""}"><input type="checkbox" data-folga="${i}" ${h?.folga.includes(i) ? "checked" : ""}>${esc(nome)}</label>`).join("")}</div>` : ""}
      </div>
      <div class="jm-config-negocio">
        <label>${T("Janela.PericiaDoVendedorNasPechinchas")} <select data-campo="x:vendedorPericia">${Object.entries(PERICIAS_VENDEDOR).map(([k, r]) => `<option value="${k}" ${k === x.vendedorPericia ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        ${npc ? `<p class="jm-dica">${T("Janela.UsaAFichaDe")} <b>${esc(npc.name)}</b> (${bonusPericia(npc, x.vendedorPericia) >= 0 ? "+" : ""}${bonusPericia(npc, x.vendedorPericia)}).</p>`
          : `<label class="curto">${T("Janela.BonusDoVendedor")} <input type="number" data-campo="x:vendedorBonus" data-num value="${Number(x.vendedorBonus) || 0}"></label>
             <p class="jm-dica">${T("Janela.ODonoDaLojaNao")}</p>`}
      </div>
      ${["compra", "venda"].map((modo) => {
        const t = tabelaNegocio(x, modo);
        return `<div class="jm-tabela-negocio">
          <h4><i class="fa-solid ${modo === "compra" ? "fa-coins" : "fa-hand-holding-dollar"}"></i> ${T("Janela.PechinchaNa")} ${modo === "compra" ? T("Janela.Compra") : T("Janela.Venda")}
            <small>${modo === "compra" ? T("Janela.SomadoAoPrecoNegativoDesconto") : T("Janela.DoValorQueALoja")}</small></h4>
          <div class="jm-chances cinco">
            ${RESULTADOS.map(([k, r, cor]) => `<label><span class="jm-tag ${cor}">${r}</span>
              <span class="jm-pct"><input type="number" step="1" data-campo="x:negocio.${modo}.${k}" data-num value="${t[k]}"><b>%</b></span></label>`).join("")}
          </div></div>`;
      }).join("")}
      <label>${T("Janela.TabelaDasOfertasDiarias")} <select data-campo="x:diaria.tabela">${opcoes(tabelas, x.diaria.tabela, vazioTabela("diaria"))}</select></label>
      <div class="jm-chances">
        ${Object.entries(OFERTAS).map(([k, o]) => `<label><span class="jm-tag ${k}">${o.rotulo}</span><small>${o.desc}</small>
          <input type="number" min="0" data-campo="x:diaria.chances.${k}" data-num value="${ch[k]}"> ${T("Janela.Peso")}</label>`).join("")}
      </div>
      <label>${T("Janela.CustosOcultosDoEscambo")} <small>(${T("Janela.UmPorLinhaSorteadoE")})</small>
        <textarea data-campo="x:diaria.custos" rows="6">${esc(x.diaria.custos)}</textarea></label>
      <p class="jm-dica">${T("Janela.OPrecoBaseVemDo")} <i class="fa-solid fa-forward"></i> ${T("Janela.NaLateral")}</p>
    </div>`;
  }

  return secao(T("Janela.Balcao"), "fa-solid fa-store", nav + corpo, "jm-loja");
}

/** Renova o estoque semanal de uma loja pela tabela dela. Devolve o nº de itens, ou null sem tabela.
 *  A tabela é rolada uma vez por item, em sequência (tabelas "sem reposição" dependem da ordem). */
async function renovarEstoqueDaLoja(e, { avisarChat = true } = {}) {
  const { page, x, tipo } = analisar(e);
  if (!page || tipo !== "shop") return null;
  const uuidSemanal = tabelaDaLoja(x.semanal.tabela, "semanal");
  const tabela = uuidSemanal ? await fromUuid(uuidSemanal) : null;
  if (!tabela) return null;
  const novos = {};
  const porChave = {};
  for (let i = 0; i < Math.max(1, x.semanal.qtd); i++) {
    const { results } = await tabela.roll();
    for (const r of results ?? []) {
      const { doc, ...info } = await resultadoParaItem(r);
      const chave = info.uuid || info.nome;
      if (porChave[chave]) {
        const f = novos[porChave[chave]].flags[MOD];
        f.qtd = (f.qtd ?? 1) + 1;
        continue;
      }
      const data = itemParaLoja(doc, info);
      novos[data._id] = data;
      porChave[chave] = data._id;
    }
  }
  // troca o estoque numa gravação só, para uma falha no meio não deixar a loja vazia
  await substituirMapa(page, `flags.${MOD}.${CHAVE_DADOS}.items`, novos);
  if (avisarChat) await chat(`<i class="fa-solid fa-store"></i> <b>${esc(e.name)}</b> ${T("Janela.RenovouOEstoqueDaSemana")}`, estaVisivel(e) ? {} : { whisper: idsGM() });
  return Object.keys(novos).length;
}

/** Para o Calendário da Mesa: na virada da semana, renova todas as lojas que têm tabela — só se a opção
 *  estiver ligada. Devolve true quando renovou (o Calendário então não manda o lembrete). */
async function renovarEstoques() {
  if (!souGMPrincipal() || !game.settings.get(MOD, "renovarAuto")) return false;
  const lojas = game.journal.filter((e) => analisar(e).tipo === "shop" && tabelaDaLoja(analisar(e).x.semanal.tabela, "semanal"));
  const feitas = [];
  for (const e of lojas) {
    try { if ((await renovarEstoqueDaLoja(e, { avisarChat: false })) != null) feitas.push(e.name); }
    catch (err) { console.error(`${T("Janela.JournalDaMesaNaoRenovei")} "${e.name}"`, err); }
  }
  if (feitas.length) await chat(`<i class="fa-solid fa-store"></i> ${T("Janela.NovaSemanaEstoqueRenovadoEm")} ${feitas.map((n) => `<b>${esc(n)}</b>`).join(", ")}.`, { whisper: idsGM() });
  return true;
}

/** Ator do jogador (token selecionado ou personagem); avisa se não houver. */
function precisaAtor() {
  const ator = atorDoJogador();
  if (!ator) ui.notifications.warn(T("Janela.SelecioneSeuTokenOuDefina"));
  return ator;
}

export default {
  tipo: "shop",
  tituloDescricao: () => T("Janela.SobreALoja"),

  /* cabeçalho: horário de funcionamento e dono/vendedor */
  detalhes(ctx) {
    const { entry, x, ed, chipPagina, npcs } = ctx;
    let detalhes = "";
    const hl = textoHorarioLoja(entry);
    if (hl) detalhes += `<div class="jm-sub-linha"><span class="jm-horario ${hl.aberta ? "aberta" : "fechada"}"><i class="fa-solid ${hl.aberta ? "fa-door-open" : "fa-door-closed"}"></i> ${esc(hl.texto)}</span></div>`;
    detalhes += ed
      ? `<div class="jm-sub-linha"><label class="jm-sub-campo">${T("Janela.DonoVendedor")} <select data-campo="x:dono">${opcoes(npcs, x.dono)}</select></label></div>`
      : (chipPagina(x.dono) ? `<div class="jm-sub-linha">${chipPagina(x.dono, T("Janela.DonoVendedor"))}</div>` : "");
    return detalhes;
  },

  html(entry, app, ctx) { return secaoLoja(ctx); },

  acoes: {
    subLoja(app, ev, el) { app.subLoja = el.dataset.sub; app.render(); },

    async rolarSemanal(app) {
      const e = app._entry();
      const r = await renovarEstoqueDaLoja(e);
      if (r === null) ui.notifications.warn(T("Janela.EscolhaUmaTabelaDeRolagem"));
    },

    async limparSemanal(app) {
      const { page } = analisar(app._entry());
      await substituirMapa(page, `flags.${MOD}.${CHAVE_DADOS}.items`, {});
    },

    comprarSemanal(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      const quantidade = Number(el.closest(".jm-produto")?.querySelector(".jm-qtd")?.value) || 1;
      pedir("comprar", { entryId: app.ativa, origem: "semanal", itemId: el.dataset.id, actorUuid: ator.uuid, userId: game.user.id, quantidade });
    },

    comprarDiaria(app) {
      const ator = precisaAtor(); if (!ator) return;
      pedir("comprar", { entryId: app.ativa, origem: "diaria", actorUuid: ator.uuid, userId: game.user.id });
    },

    rolarDiaria(app) { pedir("rolarDiaria", { entryId: app.ativa, userId: game.user.id }); },

    async limparOferta(app, ev, el) {
      await apagarChave(analisar(app._entry()).page, `flags.${MOD}.diaria.ofertas`, el.dataset.user);
    },

    /* ---------- negociação e venda ---------- */

    negociarCompra(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      pedir("negociar", { entryId: app.ativa, userId: game.user.id, actorUuid: ator.uuid, modo: "compra", alvoId: el.dataset.id, nome: el.dataset.nome });
    },

    negociarVenda(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      pedir("negociar", { entryId: app.ativa, userId: game.user.id, actorUuid: ator.uuid, modo: "venda", alvoId: el.dataset.id, nome: el.dataset.nome });
    },

    async vender(app, ev, el) {
      const ator = precisaAtor(); if (!ator) return;
      const item = ator.items.get(el.dataset.id);
      const quantidade = Number(el.closest(".jm-produto")?.querySelector(".jm-qtd")?.value) || 1;
      const ok = await Dialogo().confirm({
        window: { title: T("Janela.Vender") },
        content: `<p>${T("Janela.Vender")} ${quantidade > 1 ? `<b>${quantidade}×</b> ` : ""}<b>${esc(item?.name)}</b> ${T("Janela.Para")} <b>${esc(app._entry().name)}</b>?</p>`
      });
      if (ok) pedir("vender", { entryId: app.ativa, userId: game.user.id, actorUuid: ator.uuid, itemId: el.dataset.id, quantidade });
    }
  },

  /* horário de funcionamento e folgas (aba Configurar) */
  ouvintes(app, root) {
    root.querySelectorAll("[data-horario]").forEach((el) => el.addEventListener("change", async () => {
      const min = horaParaMin(el.value);
      if (min == null) return ui.notifications.warn(T("Janela.UseOFormatoHHMM"));
      await dadosSet(analisar(app._entry()).page, el.dataset.horario, min);
    }));
    /* dias de folga: marcar uma folga com o horário desligado liga "Respeitar horário e folgas", senão a folga não valeria */
    root.querySelectorAll("[data-folga]").forEach((el) => el.addEventListener("change", async () => {
      const dias = [...root.querySelectorAll("[data-folga]:checked")].map((x2) => Number(x2.dataset.folga));
      const page = analisar(app._entry()).page;
      const ligar = dias.length && !page.flags?.[MOD]?.horario?.ativo;
      await page.update({ [`flags.${MOD}.horario.folga`]: dias, ...(ligar ? { [`flags.${MOD}.horario.ativo`]: true } : {}) });
      if (ligar) ui.notifications.info(T("Janela.HorarioEFolgasLigadosNesta"));
    }));
  }
};

export { precisaAtor, renovarEstoques };
