/* Journal — sessão de jogo (diário automático), medidor dos Nexus, anomalias e rastreador de missões.
 * Parte do journal.js (dividido na 4.10); depende do núcleo (nucleo.js) e das outras partes só pelas importações abaixo. */
import { T } from "../idioma.js";
import { Tempo, calApi, historicoCal, listaCal, textoPrazo } from "./calendario.js";
import { criarHistoria, historias, novoAcontecimento } from "./historia.js";
import { CHAVE_DADOS, Dialogo, LV, MOD, abrirJournal, analisar, avisoUmaVez, chat, comoLista, dup, ehGM, entradas, esc, idsGM, dadosPadrao, naFila, novoId, obterPasta, ordemNova, podeLer, podeVer, textoParaHtml } from "../nucleo.js";

/* ---------------- sessão de jogo (diário automático) ---------------- */

const souGMPrincipal = () => game.user.isGM && (game.users.activeGM?.id ?? game.user.id) === game.user.id;

const Sessao = {
  atual() { try { return game.settings.get(MOD, "sessaoAtual") || null; } catch { return null; } },
  ativa() { return !!this.atual()?.inicio; },
  /** Anota algo na sessão aberta (só o mestre principal grava). As anotações entram em fila: várias ao
   *  mesmo tempo (compras de dois jogadores, prazos vencendo na virada do dia) não se apagam mais. */
  registrar(tipo, html) {
    if (!souGMPrincipal() || !this.ativa()) return Promise.resolve();
    const reg = { tipo, html: String(html), wt: game.time.worldTime, real: Date.now() };
    return naFila("sessao", async () => {
      const atual = this.atual();
      if (!atual?.inicio) return;
      const s = dup(atual);
      s.registros = [...(s.registros ?? []), reg];
      await game.settings.set(MOD, "sessaoAtual", s);
    }).catch((err) => console.error(T("Sessao.JournalDaMesaDiarioDe"), err));
  },
  async iniciar() {
    if (!ehGM() || this.ativa()) return;
    const n = (Number(game.settings.get(MOD, "sessaoNumero")) || 0) + 1;
    await game.settings.set(MOD, "sessaoAtual", { n, inicio: Date.now(), wt: game.time.worldTime, registros: [] });
    ui.notifications.info(`${T("Comum.Sessao")} ${n} ${T("Sessao.IniciadaOJournalDaMesa")}`);
  },
  async descartar() {
    const ok = await Dialogo().confirm({ window: { title: T("Sessao.DescartarSessao") }, content: `<p>${T("Sessao.DescartarASessaoAbertaSem")}</p>` });
    if (ok) await naFila("sessao", () => game.settings.set(MOD, "sessaoAtual", null));
  },
  /** Encerra e cria o Diário da sessão. */
  async encerrar() {
    const s = this.atual();
    if (!s?.inicio) return;
    const temHist = !!calApi() && historicoCal().length > 0;
    const dados = await Dialogo().prompt({
      window: { title: `${T("Sessao.EncerrarASessao")} ${s.n}`, icon: "fa-solid fa-book-bookmark" },
      position: { width: 480 },
      content: `<div class="jm-form-dialogo">
        <label>${T("Comum.Titulo")} <input type="text" name="titulo" value="${T("Comum.Sessao")} ${s.n}"></label>
        <p><button type="button" data-jm-copiar-registro><i class="fa-solid fa-copy"></i> ${T("Sessao.CopiarORegistroDaSessao")}</button>
          <span class="jm-dica">${T("Sessao.ParaOTranscritorDaMesa")}</span></p>
        <label>${T("Sessao.ResumoOpcionalPodeColarAqui")} <textarea name="resumo" rows="8" placeholder="${T("Sessao.OQueAconteceuEmPoucas")}"></textarea></label>
        ${temHist ? `<label class="jm-check"><input type="checkbox" name="hist" checked> ${T("Sessao.IncluirOHistoricoDoCalendario")}</label>` : ""}
        <label class="jm-check"><input type="checkbox" name="jogadores"> ${T("Sessao.JogadoresPodemLer")}</label>
        <label>${T("Comum.RegistrarNaHistoria")} <select name="historia"><option value="">${T("Sessao.NaoRegistrar")}</option>
          ${historias().map((h, i) => `<option value="${h.id}" ${i === 0 ? "selected" : ""}>${esc(h.name)}</option>`).join("")}
          <option value="__nova">+ ${T("Comum.NovaHistoria")}</option></select></label>
        <p class="jm-dica">${(s.registros ?? []).length} ${T("Sessao.RegistroSAnotadoSNesta")}</p>
      </div>`,
      ok: { label: T("Sessao.GerarDiario"), icon: "fa-solid fa-check", callback: (ev, b) => ({ titulo: b.form.elements.titulo.value, resumo: b.form.elements.resumo.value, hist: !!b.form.elements.hist?.checked, jogadores: !!b.form.elements.jogadores.checked, historia: b.form.elements.historia?.value ?? "" }) }
    }).catch(() => null);
    if (!dados) return;
    const wtFim = game.time.worldTime;
    const seg = Tempo.segDia();
    const tdIni = Math.floor(s.wt / seg), tdFim = Math.floor(wtFim / seg);
    const dur = Math.max(0, wtFim - s.wt);
    const dd = Tempo.cal()?.days ?? {};
    const segHora = (Number(dd.minutesPerHour) || 60) * (Number(dd.secondsPerMinute) || 60);
    const dias = Math.floor(dur / seg), horas = Math.round((dur % seg) / segHora);
    const real = new Date(s.inicio);

    const ROT = { compra: T("Sessao.ComprasEVendas"), loja: T("Sessao.ComprasEVendas"), missao: T("Comum.Missoes"), recompensa: T("Comum.Recompensas"), combate: T("Sessao.Combates"), nexus: T("Comum.Nexus"), jornal: T("Sessao.Jornais"), evento: T("Sessao.EventosDoCalendario"), dia: T("Sessao.PassagemDoTempo"), outro: T("Sessao.Outros") };
    const grupos = {};
    for (const r of s.registros ?? []) (grupos[ROT[r.tipo] ? r.tipo === "loja" ? "compra" : r.tipo : "outro"] ??= []).push(r);
    let corpo = `<p><b>${T("Sessao.DataReal")}:</b> ${esc(real.toLocaleDateString(game.i18n.lang))} · ${esc(real.toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" }))}</p>`;
    if (Tempo.ok()) corpo += `<p><b>${T("Sessao.NoJogo")}:</b> ${esc(Tempo.texto(tdIni))}${tdFim !== tdIni ? ` → ${esc(Tempo.texto(tdFim))}` : ""} (${dias ? `${dias} ${T("Comum.DiaS")} ` : ""}${horas ? `${horas} h` : (dias ? "" : T("Sessao.MenosDe1H"))})</p>`;
    if (dados.resumo?.trim()) corpo += `<h2>${T("Sessao.Resumo")}</h2>${textoParaHtml(dados.resumo.trim())}`;
    for (const k of ["missao", "recompensa", "combate", "compra", "nexus", "jornal", "evento", "dia", "outro"]) {
      if (!grupos[k]?.length) continue;
      corpo += `<h2>${ROT[k]}</h2><ul>${grupos[k].map((r) => `<li>${r.html}</li>`).join("")}</ul>`;
    }
    if (dados.hist) {
      const itens = historicoCal().filter((i) => i.wt >= s.wt && i.wt <= wtFim);
      if (itens.length) corpo += `<h2>${T("Comum.HistoricoDoCalendario2")}</h2><ul>${itens.map((i) => `<li>${Tempo.ok() ? `<b>${esc(Tempo.texto(i.td))}</b>: ` : ""}${esc(i.texto)}</li>`).join("")}</ul>`;
    }
    const pasta = await obterPasta("JournalEntry", T("Comum.Sessoes"), "sessoes");
    const nome = String(dados.titulo || `${T("Comum.Sessao")} ${s.n}`).trim();
    const e = await JournalEntry.create({
      name: nome, folder: pasta?.id ?? null, sort: ordemNova(pasta?.id ?? null),
      ownership: { default: dados.jogadores ? LV().OBSERVER : LV().NONE },
      flags: { [MOD]: { sessao: { n: s.n, tdInicio: tdIni, tdFim, real: s.inicio } } },
      pages: [{ name: nome, type: "text", text: { content: corpo }, flags: { [MOD]: { [CHAVE_DADOS]: dadosPadrao("journalentry") } } }]
    });
    await game.settings.set(MOD, "sessaoNumero", s.n);
    await naFila("sessao", () => game.settings.set(MOD, "sessaoAtual", null));
    try { await calApi()?.registrar?.(`${T("Sessao.FimDa")} ${nome}`, "fa-book-bookmark"); } catch (err) { avisoUmaVez(T("Comum.HistoricoDoCalendario"), err); }
    if (dados.historia) {
      const h = (dados.historia !== "__nova" && game.journal.get(dados.historia)) || await criarHistoria();
      const resumo = dados.resumo?.trim() ? textoParaHtml(dados.resumo.trim()) : "";
      await novoAcontecimento(h, { nome, td: Tempo.ok() ? tdFim : null, icone: "fa-book-bookmark", origem: e.uuid,
        html: `<p>@UUID[${e.uuid}]{${esc(nome)}}</p>${resumo}` });
    }
    abrirJournal(e.id);
  }
};

/* ---------------- medidor dos Nexus (opcional) ---------------- */

const NEXUS_ICONES = { "fa-droplet": "Água", "fa-fire": "Fogo", "fa-mountain": "Terra", "fa-wind": "Ar", "fa-bolt": "Raio", "fa-snowflake": "Gelo", "fa-sun": "Luz", "fa-moon": "Sombra", "fa-gem": "Cristal", "fa-star": "Outro" };

const Nexus = {
  ligado() { try { return !!game.settings.get(MOD, "nexusAtivo"); } catch { return false; } },
  lista() { try { const l = game.settings.get(MOD, "nexusLista"); return Array.isArray(l) ? dup(l) : []; } catch { return []; } },
  jogadoresVeem() { try { return !!game.settings.get(MOD, "nexusJogadores"); } catch { return false; } },
  async salvar(l) { if (ehGM()) await game.settings.set(MOD, "nexusLista", l); },
  async novo() {
    const l = this.lista();
    l.push({ id: novoId(), nome: T("Sessao.NovoNexus"), icone: "fa-star", cor: "#4a7fbf", valor: 100, visivel: true, zona: "", anomalia: "", limiares: [] });
    await this.salvar(l);
  },
  /** Muda o valor e dispara os limiares que foram cruzados para baixo (ou rearma ao subir).
   *  Cada limiar cruzado fica no histórico do medidor (aparece na Linha do tempo). */
  async definir(id, valor) {
    if (!ehGM()) return;
    const l = this.lista();
    const nx = l.find((n) => n.id === id);
    if (!nx) return;
    const antes = Number(nx.valor) || 0;
    const depois = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
    if (antes === depois) return;
    nx.valor = depois;
    const tinhaAnomalia = (nx.limiares ?? []).some((x) => x.anomalia && x.disparado);
    const cruzados = [];
    let ligar = null;
    for (const lim of nx.limiares ?? []) {
      const v = Number(lim.v) || 0;
      if (antes >= v && depois < v && !lim.disparado) {
        lim.disparado = true;
        cruzados.push({ lim, v, subiu: false });
        if (lim.anomalia) ligar = lim;
      } else if (depois >= v && lim.disparado) {
        lim.disparado = false;
        cruzados.push({ lim, v, subiu: true });
      }
    }
    const hoje = Tempo.ok() ? Tempo.hoje() : null;
    if (hoje != null && cruzados.length) {
      nx.historico = [...(Array.isArray(nx.historico) ? nx.historico : []), ...cruzados.map((c) => ({ id: novoId(), td: hoje, v: c.v, texto: String(c.lim.texto ?? ""), ...(c.subiu ? { subiu: true } : {}) }))].slice(-NEXUS_HIST_MAX);
    }
    // grava antes dos avisos: o desligar da anomalia confere os outros Nexus já com este valor
    await this.salvar(l);
    const api = calApi();
    for (const { lim, v, subiu } of cruzados) {
      if (subiu) { await Sessao.registrar("nexus", `<b>${esc(nx.nome)}</b> ${T("Comum.VoltouAcimaDe")} ${v}%.`); continue; }
      await chat(`<i class="fa-solid fa-triangle-exclamation" style="color:${esc(nx.cor)}"></i> <b>${esc(nx.nome)}</b> ${T("Comum.CaiuAbaixoDe")} <b>${v}%</b>.${lim.texto ? `<br>${esc(lim.texto)}` : ""}`, { whisper: idsGM() });
      await Sessao.registrar("nexus", `<b>${esc(nx.nome)}</b> ${T("Comum.CaiuAbaixoDe")} ${v}%${lim.texto ? `: ${esc(lim.texto)}` : ""}.`);
      try { await api?.registrar?.(`${nx.nome} ${T("Sessao.AbaixoDe")} ${v}%`, "fa-triangle-exclamation"); } catch (err) { avisoUmaVez(T("Comum.HistoricoDoCalendario"), err); }
    }
    const temAgora = (nx.limiares ?? []).some((x) => x.anomalia && x.disparado);
    if (ligar && NexusClima.pronto(nx)) await NexusClima.ligar(nx, ligar.texto ?? "");
    else if (tinhaAnomalia && !temAgora && NexusClima.pronto(nx)) await NexusClima.desligar(nx, this.lista());
  }
};

const NEXUS_HIST_MAX = 60;

/* ---------- Nexus e as anomalias do Calendário da Mesa ----------
 * Dois jeitos de a anomalia valer (escolha "onde" em cada Nexus):
 *   "regiao" — liga o "Usar como região" da anomalia (Calendário 4.2+): as Regiões do mapa e as cenas
 *              marcadas com a região dela passam a ter o clima drenado. Funciona com a opção padrão do Calendário.
 *   "zona"   — a anomalia cobre uma região inteira (Temperada, Reino da Água...). Precisa da opção
 *              "Anomalia cobrindo uma região inteira" ligada no Calendário (o jeito antigo, até o Journal 4.5).
 * Nexus antigos com região escolhida continuam no jeito "zona". */
const NexusClima = {
  api() { const a = calApi(); return typeof a?.anomalia === "function" ? a : null; },
  porRegiao() { return typeof calApi()?.anomaliaRegiao === "function"; },
  modo() {
    try { const m = calApi()?.modoAnomalias?.(); if (m) return { ligadas: m.ligadas !== false, regiaoInteira: !!m.regiaoInteira }; }
    catch (err) { avisoUmaVez(T("Sessao.ModoDasAnomaliasDoCalendario"), err); }
    return { ligadas: true, regiaoInteira: true };   // Calendário antigo: só existe o jeito "zona"
  },
  onde(nx) {
    if (!this.porRegiao()) return "zona";
    if (nx.onde === "zona" || nx.onde === "regiao") return nx.onde;
    return nx.zona ? "zona" : "regiao";
  },
  pronto(nx) { return !!nx.anomalia && (this.onde(nx) === "regiao" ? this.porRegiao() : !!nx.zona); },
  alvo(nx) { return this.onde(nx) === "regiao" ? `r:${nx.anomalia}` : `z:${nx.zona}`; },
  /** A anomalia do Nexus está valendo agora? (null = não dá para saber) */
  ativa(nx) {
    const api = calApi();
    if (!api || !this.pronto(nx)) return null;
    try {
      if (this.onde(nx) === "regiao") return !!listaCal("anomalias").find((a) => a.id === nx.anomalia)?.regiao;
      return api.clima?.(nx.zona)?.anomalia?.tipo === nx.anomalia;
    } catch (err) { avisoUmaVez(T("Sessao.EstadoDaAnomalia"), err); return null; }
  },
  async ligar(nx, texto = "") {
    const api = this.api();
    if (!api || !this.pronto(nx)) return false;
    try { return this.onde(nx) === "regiao" ? !!(await api.anomaliaRegiao(nx.anomalia, true)) : !!(await api.anomalia(nx.zona, nx.anomalia, texto)); }
    catch (err) { avisoUmaVez(T("Sessao.LigarAAnomaliaNoCalendario"), err); return false; }
  },
  /** Desliga, a não ser que outro Nexus com o mesmo alvo ainda esteja com um limiar de anomalia disparado. */
  async desligar(nx, lista = [], { forcar = false } = {}) {
    const api = this.api();
    if (!api || !this.pronto(nx)) return false;
    const alvo = this.alvo(nx);
    if (!forcar && lista.some((o) => o.id !== nx.id && this.pronto(o) && this.alvo(o) === alvo && (o.limiares ?? []).some((x) => x.anomalia && x.disparado))) return false;
    try { return this.onde(nx) === "regiao" ? !!(await api.anomaliaRegiao(nx.anomalia, false)) : !!(await api.anomalia(nx.zona, null)); }
    catch (err) { avisoUmaVez(T("Sessao.DesligarAAnomaliaNoCalendario"), err); return false; }
  },
  /** Linha "Anomalia no clima" do medidor (só o mestre). */
  html(nx, zonas, anomalias, op) {
    const m = this.modo();
    if (!m.ligadas) return `<div class="jm-nexus-ctrl jm-nexus-clima"><span class="jm-dica"><i class="fa-solid fa-circle-info"></i> ${T("Sessao.ABarraDeAnomaliasEsta")}</span></div>`;
    const onde = this.onde(nx);
    const ondeOp = [...(this.porRegiao() ? [["regiao", T("Sessao.NaRegiaoDaAnomalia")]] : []), ["zona", T("Sessao.NumaRegiaoInteira")]];
    const at = this.ativa(nx);
    const estado = at == null ? "" : `<span class="jm-nexus-estado ${at ? "ligada" : ""}">${at ? T("Sessao.Ativa") : T("Sessao.Inativa")}</span>
      <a class="jm-mini-btn" data-action="nexusAnomalia" data-id="${nx.id}" data-ligar="${at ? 0 : 1}" data-tooltip="${at ? T("Sessao.DesligarAAnomaliaAgora") : T("Sessao.LigarAAnomaliaAgora")}"><i class="fa-solid ${at ? "fa-power-off" : "fa-bolt"}"></i></a>`;
    const aviso = onde === "zona" && !m.regiaoInteira
      ? `<span class="jm-dica jm-nexus-aviso"><i class="fa-solid fa-triangle-exclamation"></i> ${T("Sessao.ParaCobrirUmaRegiaoInteira")}${this.porRegiao() ? `, ${T("Sessao.OuEscolhaNaRegiaoDa")}"` : ""}.</span>`
      : onde === "regiao" && nx.anomalia ? `<span class="jm-dica">${T("Sessao.LigaOUsarComoRegiao")}</span>` : "";
    return `<div class="jm-nexus-ctrl jm-nexus-clima"><span>${T("Sessao.AnomaliaNoClima")}:</span>
      <select data-nexus-campo="anomalia">${op(anomalias.map((a2) => [a2.id, `${a2.nome}${a2.regiao ? T("Sessao.RegiaoLigada") : ""}`]), nx.anomalia, "— anomalia —")}</select>
      ${ondeOp.length > 1 ? `<select data-nexus-campo="onde">${ondeOp.map(([v, r]) => `<option value="${v}" ${v === onde ? "selected" : ""}>${r}</option>`).join("")}</select>` : ""}
      ${onde === "zona" ? `<select data-nexus-campo="zona">${op(zonas.map((z) => [z.id, z.nome]), nx.zona, T("Sessao.Regiao"))}</select>` : ""}
      ${estado}${aviso}</div>`;
  }
};

/* ---------------- rastreador de missões ---------------- */

const Rastreador = {
  el: null,
  min: false,

  render() {
    const ligado = game.settings.get(MOD, "rastreador");
    const missoes = ligado ? entradas().filter((j) => {
      if (!podeLer(j)) return false;
      const a = analisar(j);
      return a.tipo === "quest" && a.m.status === "inprogress" && a.x.rastrear;
    }) : [];
    if (!missoes.length) { this.el?.remove(); this.el = null; return; }

    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "jm-rastreador";
      document.body.append(this.el);
      const pos = game.settings.get(MOD, "posRastreador");
      if (pos?.top != null) Object.assign(this.el.style, { top: `${pos.top}px`, left: `${pos.left}px`, right: "auto" });
    }
    this.el.dataset.tema = game.settings.get(MOD, "tema");

    let corpo = "";
    if (!this.min) for (const j of missoes) {
      const { m, x } = analisar(j);
      const objs = comoLista(m.objectives).filter(([, o]) => ehGM() || o.available !== false);
      const doador = game.journal.get(x.doador);
      const mostraDoador = doador && podeVer(doador);
      const img = mostraDoador ? analisar(doador).page?.src : null;
      const itens = objs.map(([, o]) => {
        const req = Number(o.required) || 0;
        const feito = req ? (Number(o.done) || 0) >= req : !!Number(o.done) || o.done === true;
        const texto = String(o.content ?? "").replace(/<[^>]+>/g, "");
        return `<li class="${feito ? "feito" : ""}"><i class="fa-${feito ? "solid fa-square-check" : "regular fa-square"}"></i> ${esc(texto)}${req ? ` <small>${Number(o.done) || 0}/${req}</small>` : ""}</li>`;
      }).join("");
      corpo += `<div class="missao" data-id="${j.id}">
        <div class="topo">${img ? `<img src="${esc(img)}" alt="">` : ""}
          <div><b>${esc(j.name)}</b>${mostraDoador ? `<small>${esc(doador.name)}</small>` : (m.source ? `<small>${esc(m.source)}</small>` : "")}
            ${x.prazo != null && Tempo.ok() ? `<small class="jm-prazo ${textoPrazo(Number(x.prazo)).classe}"><i class="fa-solid fa-hourglass-half"></i> ${esc(textoPrazo(Number(x.prazo)).quando)}</small>` : ""}</div></div>
        <ul>${itens}</ul></div>`;
    }

    this.el.innerHTML = `<header><i class="fa-solid fa-scroll"></i><span>${T("Comum.Missoes")}</span>
      <a data-min><i class="fa-solid ${this.min ? "fa-chevron-down" : "fa-chevron-up"}"></i></a></header>${corpo}`;

    this.el.querySelector("[data-min]").addEventListener("click", () => { this.min = !this.min; this.render(); });
    this.el.querySelectorAll(".missao").forEach((mm) => mm.addEventListener("click", () => abrirJournal(mm.dataset.id)));

    this.el.querySelector("header").addEventListener("mousedown", (ev) => {
      if (ev.target.closest("[data-min]")) return;
      const r = this.el.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      const mover = (e) => Object.assign(this.el.style, { left: `${e.clientX - dx}px`, top: `${e.clientY - dy}px`, right: "auto" });
      const soltar = () => {
        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", soltar);
        const r2 = this.el.getBoundingClientRect();
        game.settings.set(MOD, "posRastreador", { top: Math.round(r2.top), left: Math.round(r2.left) });
      };
      document.addEventListener("mousemove", mover);
      document.addEventListener("mouseup", soltar);
    });
  }
};

export { NEXUS_ICONES, Nexus, NexusClima, Rastreador, Sessao, souGMPrincipal };
