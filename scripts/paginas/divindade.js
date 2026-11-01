/* Journal — página de Divindade (tipo "deus"): abas (geral, fé, poder…), símbolos sagrados, seções de texto,
 * dias sagrados no calendário e relíquias. */
import { T } from "../idioma.js";
import { CAL, CAL_AVISOS, CAL_ICONES, Tempo, calNota, deusDaFesta, festasDe } from "../partes/calendario.js";
import { calProxima, calResumoRepeticao, calSalvar, calTextoDia, campoData, notaPadrao } from "../partes/historia.js";
import { ABAS_DEUS, CAMPOS_DEUS, CHAVE_DADOS, Dialogo, FP, LV, MOD, SECOES_DEUS, SIMBOLOS_DEUS, STATUS_DEUS, TE, analisar, dadosPadrao, ehGM, esc, op, ordemNova, podeVer, podeVerSecao, textoParaHtml } from "../nucleo.js";

function deusTemConteudo(x, aba, entry = null) {
  if (aba === "geral") return true;
  const ve = (k) => !entry || podeVerSecao(entry, k);
  if ((SECOES_DEUS[aba] ?? []).some(([k]) => x.deus[k] && ve(k))) return true;
  return aba === "poder" && (x.deus.reliquias ?? []).length > 0 && ve("reliquias");
}

function simbolosDeus(x, ed, secao) {
  const d = x.deus;
  const tem = d.simboloImg || SIMBOLOS_DEUS.some(([k]) => d[k]);
  if (!tem && !ed) return "";
  const img = d.simboloImg
    ? `<img class="jm-simbolo-img" src="${esc(d.simboloImg)}" alt="">`
    : `<div class="jm-simbolo-img vazio"><i class="fa-solid fa-sun"></i></div>`;
  const campos = SIMBOLOS_DEUS.map(([k, r]) => ed
    ? `<label class="jm-sub-campo">${r}<input data-campo="x:deus.${k}" value="${esc(d[k] ?? "")}"></label>`
    : (d[k] ? `<div class="jm-simbolo-campo"><small>${r}</small><span>${esc(d[k])}</span></div>` : "")).join("");
  return secao(T("Janela.SimbolosSagrados"), "fa-solid fa-ankh",
    `<div class="jm-simbolos">${ed ? `<a class="jm-simbolo-troca" data-action="imagemSimbolo" data-tooltip="${T("Janela.EscolherImagemDoSimbolo")}">${img}</a>` : img}
      <div class="jm-simbolos-campos">${campos}</div></div>`, "jm-deus-simbolos", "", "", "simbolos");
}

async function reliquiasDeus(x, ed, secao) {
  const gm = ehGM();
  const lista = [];
  for (const uuid of x.deus.reliquias ?? []) {
    const doc = fromUuidSync(uuid);
    if (!doc) continue;
    lista.push(`<div class="jm-premio-card"><img src="${esc(doc.img)}" alt="">
      <div class="nome">${await TE().enrichHTML(`@UUID[${uuid}]{${String(doc.name).replace(/[{}]/g, "")}}`)}</div>
      ${gm && ed ? `<a class="jm-mini-btn" data-action="removerReliquia" data-uuid="${esc(uuid)}"><i class="fa-solid fa-trash"></i></a>` : ""}</div>`);
  }
  if (!lista.length && !(gm && ed)) return "";
  return secao(T("Janela.ReliquiasEArtefatosSagrados"), "fa-solid fa-gem",
    `<div class="jm-premio-itens">${lista.join("")}</div>${gm && ed ? `<div class="jm-soltar jm-premio-drop"><i class="fa-solid fa-hand-holding-heart"></i> ${T("Janela.ArrasteItensAquiReliquiasArmas")}</div>` : ""}`,
    "", gm && ed ? `data-drop="reliquia"` : "", "", "reliquias");
}

function diasSagrados(entry, secao) {
  const gm = ehGM();
  const festas = festasDe(entry).filter((j) => podeVer(j))
    .map((j) => ({ j, n: calNota(j) }))
    .sort((a, b) => (calProxima(a.j) ?? Infinity) - (calProxima(b.j) ?? Infinity));
  if (!festas.length && !gm) return "";
  const linhas = festas.map(({ j, n }) => {
    const prox = n ? calProxima(j) : null;
    const cor = /^#[0-9a-f]{6}$/i.test(n?.cor ?? "") ? n.cor : "#d6a92b";
    return `<div class="jm-festa" style="border-left-color:${cor}">
      <i class="fa-solid ${CAL_ICONES[n?.icone] ? n.icone : "fa-hands-praying"}" style="color:${cor}"></i>
      <div class="info"><a data-action="abrir" data-id="${j.id}"><b>${esc(j.name)}</b></a>
        <small>${n ? `${esc(calResumoRepeticao(j))}${prox != null ? ` · ${T("Janela.Proxima")}: ${esc(calTextoDia(prox))}` : ""}` : T("Janela.SemDataNoCalendario")}</small></div>
      ${gm && n && Tempo.ok() ? campoData("festa", Number(n.td), `data-festa="${j.id}"`) : ""}
      ${gm ? `<a class="jm-mini-btn" data-action="desligarFesta" data-id="${j.id}" data-tooltip="${T("Janela.DesligarDestaDivindadeAPagina")}"><i class="fa-solid fa-link-slash"></i></a>` : ""}
    </div>`;
  }).join("");
  /* eventos do calendário que ainda não são dias sagrados desta divindade */
  const livres = gm ? game.journal.filter((j) => j.id !== entry.id && calNota(j) && calNota(j).divindade !== entry.uuid && analisar(j).tipo !== "deus")
    .sort((a, b) => a.name.localeCompare(b.name)) : [];
  const ligar = gm ? `<div class="jm-festa-ligar">
      <select data-festa-livre><option value="">— ${T("Janela.LigarUmEventoQueJa")} —</option>${livres.map((j) => {
        const outro = deusDaFesta(j);
        return `<option value="${j.id}">${esc(j.name)}${outro ? ` (${T("Janela.HojeDe")} ${esc(outro.name)})` : ""}</option>`;
      }).join("")}</select>
      <button type="button" data-action="ligarFesta"><i class="fa-solid fa-link"></i> ${T("Janela.Ligar")}</button>
    </div>
    <div class="jm-soltar jm-festa-drop"><i class="fa-solid fa-calendar-plus"></i> ${T("Janela.ArrasteAquiUmEventoOu")}</div>` : "";
  return secao(T("Janela.DiasSagradosNoCalendario"), "fa-solid fa-calendar-days",
    (linhas || `<p class="jm-vazio">${T("Janela.NenhumDiaSagradoMarcado")}</p>`) +
    (gm ? `<button type="button" class="jm-add" data-action="novoDiaSagrado"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoDiaSagrado")}</button>` : "") + ligar,
    "jm-dias-sagrados", gm ? `data-drop="festa"` : "", "", "diasSagrados");
}

/** Liga um evento que já existe à divindade (vira dia sagrado dela). */
async function tornarDiaSagrado(deus, evento) {
  if (analisar(evento).tipo === "deus") return ui.notifications.warn(T("Janela.UmaDivindadeNaoPodeSer"));
  const n = calNota(evento);
  if (n?.divindade === deus.uuid) return ui.notifications.info(`"${evento.name}" ${T("Janela.JaEDiaSagradoDe")} ${deus.name}.`);
  const outro = deusDaFesta(evento);
  if (outro) {
    const ok = await Dialogo().confirm({ window: { title: T("Janela.TrocarADivindade") },
      content: `<p><b>${esc(evento.name)}</b> ${T("Janela.HojeEDiaSagradoDe")} <b>${esc(outro.name)}</b>. ${T("Janela.PassarPara")} <b>${esc(deus.name)}</b>?</p>` });
    if (!ok) return;
  }
  if (!n) {
    if (!Tempo.ok()) return ui.notifications.warn(T("Janela.OCalendarioDoMundoNao"));
    const ok = await Dialogo().confirm({ window: { title: T("Janela.SemDataNoCalendario2") },
      content: `<p><b>${esc(evento.name)}</b> ${T("Janela.AindaNaoEstaNoCalendario")}</p>` });
    if (!ok) return;
    await calSalvar(evento, { repetir: "anos", cada: 1, icone: "fa-hands-praying", cor: "#d6a92b", divindade: deus.uuid });
  } else await calSalvar(evento, { divindade: deus.uuid });
  ui.notifications.info(`"${evento.name}" ${T("Janela.AgoraEDiaSagradoDe")} ${deus.name}.`);
}

export default {
  tipo: "deus",
  tituloDescricao: () => T("Janela.MitosELendas"),

  /* cabeçalho: campos da divindade (status é uma lista de opções) */
  campos: (ctx) => CAMPOS_DEUS.map(([k, r]) => [`x:deus.${k}`, r, ctx.x.deus[k]]),
  valorCampo: (k, v) => (k === "x:deus.status" ? (STATUS_DEUS[v] ?? v) : v),
  campoEditavel: (k, r, v) => (k === "x:deus.status"
    ? `<label class="jm-sub-campo">${r}<select data-campo="${k}">${Object.entries(STATUS_DEUS).map(([sk, sr]) => `<option value="${sk}" ${sk === (v ?? "") ? "selected" : ""}>${sr}</option>`).join("")}</select></label>`
    : null),

  /* abas e símbolos vêm antes da descrição ("Mitos e lendas"), que só aparece na aba geral */
  antes(entry, app, ctx) {
    const { x, gm, ed, secao } = ctx;
    const blocos = [];
    const abas = ABAS_DEUS.filter(([k]) => gm || k === "geral" || deusTemConteudo(x, k, entry));
    if (!abas.some(([k]) => k === app.subDeus)) app.subDeus = "geral";
    if (abas.length > 1) blocos.push(`<nav class="jm-subabas jm-abas-deus">${abas.map(([k, r, i]) =>
      `<button type="button" class="${app.subDeus === k ? "ativo" : ""}" data-action="subDeus" data-sub="${k}"><i class="${i}"></i> ${r}</button>`).join("")}</nav>`);
    if (app.subDeus === "geral") blocos.push(simbolosDeus(x, ed, secao));
    return blocos.join("");
  },
  mostrarDescricao: (ctx) => ctx.app.subDeus === "geral",

  async html(entry, app, ctx) {
    const { x, gm, ed, secao, enr } = ctx;
    const blocos = [];
    for (const [k, r, i, dica] of SECOES_DEUS[app.subDeus] ?? []) {
      if (!x.deus[k] && !ed) continue;
      blocos.push(secao(r, i, ed
        ? `<textarea data-campo="x:deus.${k}" rows="4" placeholder="${esc(dica)}">${esc(x.deus[k])}</textarea>`
        : `<div class="jm-texto">${await enr(x.deus[k])}</div>`, `jm-deus-${k}`, "", "", k));
    }
    if (app.subDeus === "fe") blocos.push(diasSagrados(entry, secao));
    if (app.subDeus === "poder") blocos.push(await reliquiasDeus(x, ed, secao));
    if (gm && !ed && app.subDeus !== "geral" && !deusTemConteudo(x, app.subDeus, null))
      blocos.push(`<p class="jm-vazio jm-centro">${T("Janela.NadaEscritoNestaAbaAinda")}</p>`);
    return blocos.join("");
  },

  acoes: {
    subDeus(app, ev, el) { app.subDeus = el.dataset.sub; app.render(); },

    imagemSimbolo(app) {
      const { page, x } = analisar(app._entry());
      new (FP())({ type: "image", current: x.deus.simboloImg, callback: (path) => page.setFlag(MOD, "deus.simboloImg", path) }).render(true);
    },

    async removerReliquia(app, ev, el) {
      const { page, x } = analisar(app._entry());
      await page.setFlag(MOD, "deus.reliquias", (x.deus.reliquias ?? []).filter((u) => u !== el.dataset.uuid));
    },

    async desligarFesta(app, ev, el) {
      const j = game.journal.get(el.dataset.id);
      const n = calNota(j);
      if (n) await j.update({ [`flags.${CAL}.nota.divindade`]: null });
    },

    async ligarFesta(app, ev, el) {
      const id = el.closest(".jm-festa-ligar")?.querySelector("[data-festa-livre]")?.value;
      if (!id) return ui.notifications.warn(T("Janela.EscolhaUmEventoParaLigar"));
      const evento = game.journal.get(id);
      if (evento) await tornarDiaSagrado(app._entry(), evento);
    },

    /** Cria um dia sagrado (evento que se repete todo ano) ligado à divindade aberta. */
    async novoDiaSagrado(app) {
      const deus = app._entry();
      if (!Tempo.ok()) return ui.notifications.warn(T("Janela.OCalendarioDoMundoNao"));
      const p = Tempo.partes(Tempo.hoje());
      const dados = await Dialogo().prompt({
        window: { title: `${T("Janela.NovoDiaSagrado")}: ${deus.name}`, icon: "fa-solid fa-hands-praying" },
        position: { width: 460 },
        content: `<div class="jm-form-dialogo">
          <label>${T("Janela.Nome")} <input type="text" name="nome" required autofocus></label>
          <label>${T("Janela.ComecaEm")} <span class="jm-data">
            <input type="number" name="dia" min="1" value="${p.dia}">
            <select name="mes">${Tempo.meses(p.ano).map((m) => `<option value="${m.i}" ${m.i === p.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
            <input type="number" name="ano" value="${p.ano}"></span></label>
          <label>${T("Janela.RepeteACada")} <span class="jm-linha-curta"><input type="number" name="cada" min="1" value="1"> ${T("Janela.AnoS")}</span></label>
          <label>${T("Janela.DuraQuantosDias")} <input type="number" name="duracao" min="1" value="1"></label>
          <label>${T("Janela.QuandoChegar")} <select name="aviso">${op(CAL_AVISOS, "nenhum")}</select></label>
          <label>${T("Janela.Descricao")} <textarea name="texto" rows="3"></textarea></label>
        </div>`,
        ok: {
          label: T("Comum.Criar"), icon: "fa-solid fa-check",
          callback: (ev, botao) => Object.fromEntries(["nome", "dia", "mes", "ano", "cada", "duracao", "aviso", "texto"].map((k) => [k, botao.form.elements[k]?.value]))
        }
      }).catch(() => null);
      if (!dados?.nome?.trim()) return;
      const td = Tempo.tdDe(Number(dados.ano), Number(dados.mes), Number(dados.dia));
      if (td == null) return ui.notifications.warn(T("Comum.EssaDataNaoExisteNeste"));
      const pasta = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag?.(CAL, "pasta"))?.id ?? deus.folder?.id ?? null;
      const nome = dados.nome.trim();
      await JournalEntry.create({
        name: nome, folder: pasta, sort: ordemNova(pasta), ownership: { default: LV().NONE },
        flags: { [CAL]: { nota: notaPadrao(td, {
          repetir: "anos", cada: Math.max(1, Math.trunc(Number(dados.cada) || 1)), duracao: Math.max(1, Math.trunc(Number(dados.duracao) || 1)),
          icone: "fa-hands-praying", cor: "#d6a92b", aviso: CAL_AVISOS[dados.aviso] ? dados.aviso : "nenhum", divindade: deus.uuid
        }) } },
        pages: [{ name: nome, type: "text", text: { content: textoParaHtml(dados.texto ?? "") }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao("journalentry") } } }]
      });
      ui.notifications.info(`"${nome}" ${T("Janela.CriadoNoCalendario")}`);
    }
  },

  soltar: {
    /* soltar um evento do calendário em "Dias sagrados" */
    async festa(app, doc, e) {
      const alvo = doc.documentName === "JournalEntryPage" ? doc.parent : doc;
      if (alvo?.documentName !== "JournalEntry" || alvo.id === e.id) return ui.notifications.warn(T("Janela.ArrasteUmEventoPaginaDo"));
      return tornarDiaSagrado(e, alvo);
    },
    /* soltar um item em "Relíquias" */
    async reliquia(app, doc, e, page) {
      if (doc.documentName !== "Item") return ui.notifications.warn(T("Janela.ArrasteUmItem"));
      const atuais = analisar(e).x.deus.reliquias ?? [];
      if (!atuais.includes(doc.uuid)) await page.setFlag(MOD, "deus.reliquias", [...atuais, doc.uuid]);
    }
  },

  /* seletor de data de um dia sagrado (data-festa = id do evento) */
  data: {
    festa(app, td, caixa) {
      if (!app._entry()) return;
      const festa = game.journal.get(caixa.dataset.festa);
      if (festa) return calSalvar(festa, { td });
    }
  }
};
