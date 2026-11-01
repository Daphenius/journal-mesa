/* Journal — painel dos medidores de Nexus (aba especial __nexus): barras, limiares e anomalias do clima. */
import { T } from "../idioma.js";
import { calApi } from "../partes/calendario.js";
import { NEXUS_ICONES, Nexus, NexusClima } from "../partes/sessao.js";
import { Dialogo, atualizarTudo, avisoUmaVez, ehGM, esc, novoId, opcoes } from "../nucleo.js";

/** Painel dos medidores de Nexus. */
function painelNexus() {
  const gm = ehGM();
  const api = calApi();
  const zonas = (() => { try { return api?.zonas?.() ?? []; } catch (err) { avisoUmaVez(T("Janela.ZonasDoClima"), err); return []; } })();
  const anomalias = (() => { try { return api?.anomalias?.() ?? []; } catch (err) { avisoUmaVez(T("Janela.AnomaliasDoClima"), err); return []; } })();
  const lista = Nexus.lista().filter((n) => gm || n.visivel);
  const cards = lista.map((nx) => {
    const v = Math.max(0, Math.min(100, Number(nx.valor) || 0));
    const barra = `<div class="jm-nexus-barra"><div style="width:${v}%;background:${esc(nx.cor)}"></div>
      ${(nx.limiares ?? []).map((l) => `<span class="jm-nexus-marca ${l.disparado ? "disparado" : ""}" style="left:${Math.max(0, Math.min(100, Number(l.v) || 0))}%" data-tooltip="${esc(l.v)}%${l.texto ? `: ${esc(l.texto)}` : ""}"></span>`).join("")}</div>`;
    if (!gm) return `<div class="jm-nexus"><div class="jm-nexus-topo"><i class="fa-solid ${esc(nx.icone)}" style="color:${esc(nx.cor)}"></i><b>${esc(nx.nome)}</b><span class="jm-nexus-valor">${v}%</span></div>${barra}</div>`;
    return `<div class="jm-nexus" data-nexus="${nx.id}">
      <div class="jm-nexus-topo">
        <i class="fa-solid ${esc(nx.icone)}" style="color:${esc(nx.cor)}"></i>
        <input class="jm-nexus-nome" data-nexus-campo="nome" value="${esc(nx.nome)}">
        <a class="jm-mini-btn jm-olho ${nx.visivel ? "aberto" : "fechado"}" data-nexus-alternar="visivel" data-tooltip="${nx.visivel ? T("Janela.JogadoresVeemSeAOpcao") : T("Janela.SoOMestreVe")}"><i class="fa-solid ${nx.visivel ? "fa-eye" : "fa-eye-slash"}"></i></a>
        <a class="jm-mini-btn" data-action="nexusApagar" data-id="${nx.id}" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-trash"></i></a>
      </div>
      ${barra}
      <div class="jm-nexus-ctrl">
        ${[-10, -1].map((d) => `<button type="button" data-action="nexusMudar" data-id="${nx.id}" data-delta="${d}">${d}</button>`).join("")}
        <input type="number" min="0" max="100" data-nexus-campo="valor" value="${v}"><b>%</b>
        ${[1, 10].map((d) => `<button type="button" data-action="nexusMudar" data-id="${nx.id}" data-delta="${d}">+${d}</button>`).join("")}
        <select data-nexus-campo="icone">${Object.entries(NEXUS_ICONES).map(([k, r]) => `<option value="${k}" ${k === nx.icone ? "selected" : ""}>${r}</option>`).join("")}</select>
        <input type="color" data-nexus-campo="cor" value="${esc(nx.cor)}">
      </div>
      ${NexusClima.api() ? NexusClima.html(nx, zonas, anomalias, opcoes) : ""}
      <div class="jm-nexus-limiares">
        ${(nx.limiares ?? []).map((l) => `<div class="jm-nexus-limiar ${l.disparado ? "disparado" : ""}" data-limiar="${l.id}">
          <span>${T("Janela.AbaixoDe")}</span><input type="number" min="0" max="100" data-limiar-campo="v" value="${Number(l.v) || 0}"><b>%</b>
          <input type="text" data-limiar-campo="texto" value="${esc(l.texto ?? "")}" placeholder="${T("Janela.OQueAconteceAvisoPara")}">
          ${NexusClima.api() ? `<label class="jm-check" data-tooltip="${T("Janela.LigaAAnomaliaDoClima")}"><input type="checkbox" data-limiar-campo="anomalia" ${l.anomalia ? "checked" : ""}> anomalia</label>` : ""}
          <a class="jm-mini-btn" data-action="nexusLimiarApagar" data-id="${nx.id}" data-limiar="${l.id}"><i class="fa-solid fa-xmark"></i></a>
        </div>`).join("")}
        <button type="button" class="jm-add" data-action="nexusLimiarNovo" data-id="${nx.id}"><i class="fa-solid fa-plus"></i> ${T("Janela.Limiar")}</button>
      </div>
    </div>`;
  }).join("");
  return `<article class="jm-pagina jm-painel-nexus">
    <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-gauge-high"></i> ${T("Comum.Nexus")}</span><h1 class="jm-titulo">${T("Janela.Medidores")}</h1></div></header>
    ${cards || `<p class="jm-vazio jm-centro">${gm ? T("Janela.NenhumMedidorAinda") : T("Janela.NadaParaMostrar")}</p>`}
    ${gm ? `<button type="button" class="jm-add" data-action="nexusNovo"><i class="fa-solid fa-plus"></i> ${T("Janela.NovoMedidor")}</button>
      <p class="jm-dica">${T("Janela.QuandoOValorCaiAbaixo")}</p>` : ""}
  </article>`;
}

export default {
  tipo: "__nexus",

  html() { return painelNexus(); },

  acoes: {
    nexusNovo() { Nexus.novo(); },
    async nexusApagar(app, ev, el) {
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === el.dataset.id);
      const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarNexus") }, content: `<p>${T("Janela.ApagarOMedidor")} <b>${esc(nx?.name ?? nx?.nome)}</b>?</p>` });
      if (ok) await Nexus.salvar(l.filter((n) => n.id !== el.dataset.id));
    },
    nexusMudar(app, ev, el) {
      const nx = Nexus.lista().find((n) => n.id === el.dataset.id);
      if (nx) Nexus.definir(nx.id, (Number(nx.valor) || 0) + Number(el.dataset.delta));
    },
    async nexusLimiarNovo(app, ev, el) {
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === el.dataset.id);
      if (!nx) return;
      (nx.limiares ??= []).push({ id: novoId(), v: 50, texto: "", anomalia: false, disparado: (Number(nx.valor) || 0) < 50 });
      await Nexus.salvar(l);
    },
    /** Liga ou desliga na hora a anomalia ligada ao Nexus (sem mexer no valor). */
    async nexusAnomalia(app, ev, el) {
      const nx = Nexus.lista().find((n) => n.id === el.dataset.id);
      if (!nx || !NexusClima.pronto(nx)) return ui.notifications.warn(T("Janela.EscolhaAAnomaliaEA"));
      const ok = el.dataset.ligar === "1" ? await NexusClima.ligar(nx, "") : await NexusClima.desligar(nx, [], { forcar: true });
      if (!ok) ui.notifications.warn(T("Janela.OCalendarioNaoAceitouConfira"));
      atualizarTudo();
    },
    async nexusLimiarApagar(app, ev, el) {
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === el.dataset.id);
      if (!nx) return;
      nx.limiares = (nx.limiares ?? []).filter((x2) => x2.id !== el.dataset.limiar);
      await Nexus.salvar(l);
    }
  },

  ouvintes(app, root) {
    root.querySelectorAll("[data-nexus] [data-nexus-campo]").forEach((el) => el.addEventListener("change", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const k = el.dataset.nexusCampo;
      if (k === "valor") return Nexus.definir(id, el.value);
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === id);
      if (!nx) return;
      nx[k] = el.value;
      await Nexus.salvar(l);
    }));
    root.querySelectorAll("[data-nexus] [data-nexus-alternar]").forEach((el) => el.addEventListener("click", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const l = Nexus.lista();
      const nx = l.find((n) => n.id === id);
      if (!nx) return;
      nx[el.dataset.nexusAlternar] = !nx[el.dataset.nexusAlternar];
      await Nexus.salvar(l);
    }));
    root.querySelectorAll("[data-limiar] [data-limiar-campo]").forEach((el) => el.addEventListener("change", async () => {
      const id = el.closest("[data-nexus]").dataset.nexus;
      const lid = el.closest("[data-limiar]").dataset.limiar;
      const l = Nexus.lista();
      const lim = l.find((n) => n.id === id)?.limiares?.find((x2) => x2.id === lid);
      if (!lim) return;
      const k = el.dataset.limiarCampo;
      lim[k] = el.type === "checkbox" ? el.checked : (k === "v" ? Math.max(0, Math.min(100, Number(el.value) || 0)) : el.value);
      if (k === "v") lim.disparado = (Number(l.find((n) => n.id === id).valor) || 0) < lim.v;
      await Nexus.salvar(l);
    }));
  }
};
