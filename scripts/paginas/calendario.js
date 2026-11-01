/* Journal — seção "Calendário" de uma página (qualquer tipo): data, repetição, ícone, história da data.
 * As regras do calendário em si ficam em partes/calendario.js e partes/historia.js; aqui é só a parte visual. */
import { T } from "../idioma.js";
import { CAL_AVISOS, CAL_CORES_ELEMENTO, CAL_FIM, CAL_ICONES, CAL_ICONES_GRUPOS, CAL_MODOS_MES, CAL_REPETIR, Tempo, calApi, calNota } from "../partes/calendario.js";
import { calHoje, calNormalizar, calProximas, calResumoRepeticao, calSalvar, calTextoDia, calTirar, campoData } from "../partes/historia.js";
import { Dialogo, MOD, TE, ehGM, esc, op, textoParaHtml } from "../nucleo.js";

async function secaoCalendario(ctx) {
  const { entry, app, secao } = ctx;
  const bruta = calNota(entry);
  if (!bruta) return "";
  const n = calNormalizar(bruta);
  const gm = ehGM();
  const api = calApi();
  const prox = calProximas(entry, 3);
  const quando = `<div class="jm-cal-quando">
    <i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>
    <div><b>${esc(calTextoDia(n.td))}${n.hora ? ` · ${esc(n.hora)}` : ""}</b>
      <small>${esc(calResumoRepeticao(entry))}${!api ? T("Janela.CalendarioDaMesaDesativado") : ""}</small>
      ${n.repetir !== "nao" && prox.length ? `<small>${T("Janela.Proximas")}: ${prox.map((td) => esc(Tempo.texto(td))).join(" · ")}</small>` : ""}</div>
  </div>`;
  const historia = String(entry.getFlag(MOD, "historia") ?? "");
  const historiaHtml = historia ? await TE().enrichHTML(textoParaHtml(historia), { secrets: gm, relativeTo: entry }) : "";
  const blocoHistoria = gm
    ? `<label class="jm-cal-historia"><span><i class="fa-solid fa-book-open"></i> ${T("Comum.Historia")}</span>
        <textarea data-historia rows="3" placeholder="${T("Janela.AOrigemDestaDataO")}">${esc(historia)}</textarea></label>`
    : (historiaHtml ? `<div class="jm-cal-historia"><span><i class="fa-solid fa-book-open"></i> ${T("Comum.Historia")}</span><div class="jm-texto">${historiaHtml}</div></div>` : "");
  if (!gm) return secao(T("Janela.Calendario"), "fa-solid fa-calendar-days", quando + blocoHistoria, "jm-cal", "", "", "calendario");

  const semana = Tempo.semana();
  const unidade = { dias: T("Comum.DiaS"), semanas: T("Janela.SemanaS"), meses: T("Janela.MesEs"), anos: T("Janela.AnoS") }[n.repetir];
  const repeticao = `<div class="jm-cal-campos">
      <label>${T("Janela.Repetir")} <select data-cal-campo="repetir">${op(CAL_REPETIR, n.repetir)}</select></label>
      ${n.repetir !== "nao" ? `<label class="curto">${T("Comum.ACada")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="cada" value="${n.cada}"> ${unidade}</span></label>` : ""}
      ${["meses", "anos"].includes(n.repetir) ? `<label>${T("Janela.QualDia")} <select data-cal-campo="modoMes">${op(CAL_MODOS_MES, n.modoMes)}</select></label>` : ""}
      <label class="curto">${T("Janela.Dura")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="duracao" value="${n.duracao}"> ${T("Comum.DiaS")}</span></label>
    </div>
    ${n.repetir === "semanas" && semana.length ? `<div class="jm-cal-semana">${semana.map((nome, i) =>
      `<label class="jm-dia-sem ${n.diasSemana.includes(i) ? "marcado" : ""}"><input type="checkbox" data-cal-semana="${i}" ${n.diasSemana.includes(i) ? "checked" : ""}>${esc(nome)}</label>`).join("")}</div>` : ""}
    ${n.repetir !== "nao" ? `<div class="jm-cal-campos">
      <label>${T("Janela.Termina")} <select data-cal-campo="fim.tipo">${op(CAL_FIM, n.fim.tipo)}</select></label>
      ${n.fim.tipo === "data" ? `<label>${T("Janela.Em")} ${campoData("calFim", n.fim.td)}</label>` : ""}
      ${n.fim.tipo === "vezes" ? `<label class="curto">${T("Janela.DepoisDe")} <span class="jm-linha-curta"><input type="number" min="1" data-cal-campo="fim.vezes" value="${n.fim.vezes}"> ${T("Janela.VezEs")}</span></label>` : ""}
    </div>` : ""}`;
  const corpo = `${quando}
    ${Tempo.ok() ? `<div class="jm-cal-data"><span>${T("Janela.ComecaEm")}:</span>${campoData("cal", n.td)}</div>` : ""}
    <div class="jm-cal-mover">
      <span>${T("Janela.Mover")}:</span>
      ${[[-7, "−7"], [-1, "−1"], [1, "+1"], [7, "+7"]].map(([d, r]) => `<button type="button" data-action="calMover" data-dias="${d}" data-tooltip="${d > 0 ? T("Janela.Adiar") : T("Janela.Antecipar")} ${Math.abs(d)} ${T("Comum.DiaS")}">${r}</button>`).join("")}
      <button type="button" data-action="calHoje" data-tooltip="${T("Janela.MarcarParaHoje")}"><i class="fa-solid fa-calendar-check"></i> ${T("Comum.Hoje2")}</button>
      ${api ? `<button type="button" data-action="calAbrir" data-tooltip="${T("Janela.AbrirOCalendario")}"><i class="fa-solid fa-calendar-days"></i></button>` : ""}
    </div>
    ${repeticao}
    <div class="jm-cal-campos">
      <label>${T("Janela.Hora")} <input type="text" data-cal-campo="hora" value="${esc(n.hora)}" placeholder="HH:MM"></label>
      <label class="curto">${T("Janela.Cor")} <input type="color" data-cal-campo="cor" value="${n.cor}"></label>
      <label>${T("Janela.Aviso")} <select data-cal-campo="aviso">${op(CAL_AVISOS, n.aviso)}</select></label>
    </div>
    <details class="jm-cal-icones" ${app.iconesAbertos ? "open" : ""}>
      <summary><i class="fa-solid ${n.icone}" style="color:${n.cor}"></i> ${T("Comum.Icone")}: <b>${esc(CAL_ICONES[n.icone])}</b> <small>${T("Janela.CliqueParaTrocar")}</small></summary>
      ${CAL_ICONES_GRUPOS.map(([g, lista]) => `<div class="jm-cal-icones-grupo"><small>${esc(g)}</small><div class="jm-cal-icones-grade">${lista.map(([k, r]) =>
        `<button type="button" class="${k === n.icone ? "ativo" : ""}" data-action="calIcone" data-icone="${k}" data-tooltip="${esc(r)}"><i class="fa-solid ${k}" ${CAL_CORES_ELEMENTO[k] ? `style="color:${CAL_CORES_ELEMENTO[k]}"` : ""}></i></button>`).join("")}</div></div>`).join("")}
    </details>
    ${blocoHistoria}`;
  return secao(T("Janela.Calendario"), "fa-solid fa-calendar-days", corpo, "jm-cal", "", `<a class="jm-mini-btn" data-action="calTirar" data-tooltip="${T("Janela.TirarDoCalendarioAPagina")}"><i class="fa-solid fa-calendar-xmark"></i></a>`, "calendario");
}

const acoes = {
  calAdicionar(app) { calSalvar(app._entry(), {}); },
  async calTirar(app) {
    const e = app._entry();
    const ok = await Dialogo().confirm({ window: { title: T("Janela.TirarDoCalendario") }, content: `<p>${T("Janela.Tirar")} <b>${esc(e.name)}</b> ${T("Janela.DoCalendarioAPaginaContinua")}</p>` });
    if (ok) calTirar(e);
  },
  calMover(app, ev, el) { const n = calNota(app._entry()); if (n) calSalvar(app._entry(), { td: Number(n.td) + Number(el.dataset.dias) }); },
  async calIcone(app, ev, el) {
    const e = app._entry(); const n = calNota(e); if (!n) return;
    const icone = el.dataset.icone;
    const mud = { icone };
    const corAtual = String(n.cor ?? "").toLowerCase();
    const corDeElemento = Object.values(CAL_CORES_ELEMENTO).includes(corAtual);
    if (CAL_CORES_ELEMENTO[icone] && (!corAtual || corAtual === "#c9a227" || corAtual === "#d6a92b" || corDeElemento)) mud.cor = CAL_CORES_ELEMENTO[icone];
    app.iconesAbertos = false;
    await calSalvar(e, mud);
  },
  calHoje(app) { calSalvar(app._entry(), { td: calHoje() }); },
  calAbrir() { calApi()?.abrir?.(); }
};

/* seletores de data (data-data="cal" / "calFim") */
const data = {
  cal(app, td) { const e = app._entry(); if (!e) return; return calSalvar(e, { td }); },
  calFim(app, td) { const e = app._entry(); if (!e) return; const n = calNormalizar(calNota(e)); return calSalvar(e, { fim: { ...n.fim, tipo: "data", td } }); }
};

function ouvintes(app, root) {
  root.querySelector("[data-historia]")?.addEventListener("change", (ev) => {
    const e = app._entry(); if (!e) return;
    e.update({ [`flags.${MOD}.historia`]: ev.target.value });
  });
  root.querySelector(".jm-cal-icones")?.addEventListener("toggle", (ev) => { app.iconesAbertos = ev.target.open; });
  root.querySelectorAll("[data-cal-campo]").forEach((el) => el.addEventListener("change", () => {
    const k = el.dataset.calCampo;
    let v = el.value;
    if (k === "hora" && v && !/^\d{1,2}:\d{2}$/.test(v.trim())) return ui.notifications.warn(T("Janela.UseOFormatoHHMM2"));
    if (["cada", "duracao", "fim.vezes"].includes(k)) v = Math.max(1, Math.trunc(Number(v) || 1));
    const e = app._entry();
    const n = calNormalizar(calNota(e));
    if (k.startsWith("fim.")) return calSalvar(e, { fim: { ...n.fim, [k.split(".")[1]]: v } });
    calSalvar(e, { [k]: typeof v === "string" ? v.trim() : v });
  }));
  root.querySelectorAll("[data-cal-semana]").forEach((el) => el.addEventListener("change", () => {
    const e = app._entry();
    const dias = [...root.querySelectorAll("[data-cal-semana]:checked")].map((x) => Number(x.dataset.calSemana));
    if (!dias.length) { el.checked = true; return ui.notifications.warn(T("Janela.EscolhaPeloMenosUmDia")); }
    calSalvar(e, { diasSemana: dias });
  }));
}

export { acoes, data, ouvintes, secaoCalendario };
