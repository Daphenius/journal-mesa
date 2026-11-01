/* Journal — página de História (tipo "historia"): acontecimentos em ordem cronológica (cada um é uma
 * página nativa com data, ícone e cor), ligados à Linha do tempo. */
import { T } from "../idioma.js";
import { Tempo } from "../partes/calendario.js";
import { HIST_ICONES, acontecimento, campoData, ordenarAcontecimentos, paginasHistoria, registrarNaHistoria } from "../partes/historia.js";
import { ICONES_PAGINA, MOD, esc } from "../nucleo.js";
import { botoesAdicionarPagina, controlesPaginaNativa, notas, paginaNativa, primeiraImagem } from "./comum.js";
import { secaoCalendario } from "./calendario.js";

export default {
  tipo: "historia",
  editavel: false,
  fichaNativa: true,
  completa: true,
  imagemCabecalho: (ctx) => primeiraImagem(ctx.a),

  async html(entry, app, ctx) {
    const { a, gm, secao, chipPagina } = ctx;
    const blocos = [await secaoCalendario(ctx)];
    const paginas = paginasHistoria(entry);
    ctx.escondidas += a.pages.length - paginas.length;
    const hoje = Tempo.ok() ? Tempo.hoje() : null;
    const comData = paginas.filter((p) => acontecimento(p).td != null).length;
    blocos.push(`<div class="jm-hist-barra">
      ${gm ? `<button type="button" data-action="histNovo"><i class="fa-solid fa-feather-pointed"></i> ${T("Janela.NovoAcontecimento")}</button>` : ""}
      <button type="button" class="sec" data-action="histOrdem" data-tooltip="${T("Janela.TrocarAOrdem")}"><i class="fa-solid ${app.histDesc ? "fa-arrow-up-wide-short" : "fa-arrow-down-short-wide"}"></i> ${app.histDesc ? T("Janela.MaisRecentesPrimeiro") : T("Janela.MaisAntigosPrimeiro")}</button>
      ${Tempo.ok() ? `<button type="button" class="sec" data-action="histLinha" data-tooltip="${T("Janela.AbrirALinhaDoTempo")}"><i class="fa-solid fa-timeline"></i> ${T("Janela.LinhaDoTempo")}</button>` : ""}
      <span class="jm-hist-conta">${paginas.length} ${T("Janela.AcontecimentoS")}${paginas.length !== comData ? ` · ${paginas.length - comData} ${T("Janela.SemData")}` : ""}</span>
    </div>`);
    let anoAtual;
    for (const p of ordenarAcontecimentos(paginas, app.histDesc)) {
      const ac = acontecimento(p);
      const ano = ac.td != null && Tempo.ok() ? Tempo.partes(ac.td).ano : null;
      if (ano !== anoAtual) { blocos.push(`<div class="jm-hist-ano"><span>${ano != null ? `${T("Comum.Ano")} ${esc(ano)}` : T("Janela.SemData2")}</span></div>`); anoAtual = ano; }
      let origem = "";
      if (ac.origem.startsWith("JournalEntry.")) {
        const doc = fromUuidSync(ac.origem);
        const id = doc?.documentName === "JournalEntry" ? doc.id : doc?.parent?.id;
        if (id) origem = chipPagina(id, "origem");
      }
      const naLinha = ac.td != null && hoje != null && ac.td <= hoje + 30;
      const quando = `<div class="jm-hist-quando">
        <i class="fa-solid ${ac.icone}" style="color:${ac.cor}"></i>
        <div><b>${ac.td != null ? esc(Tempo.ok() ? Tempo.texto(ac.td) : `${T("Comum.Dia")} ${ac.td}`) : T("Janela.SemData2")}</b>
          ${ac.td != null && Tempo.ok() ? `<small>${esc(Tempo.relativo(ac.td))}${ac.td > hoje ? T("Janela.AindaVaiAcontecer") : ""}</small>` : ""}</div>
        ${origem ? `<div class="jm-hist-origem">${origem}</div>` : ""}
      </div>`;
      const edicao = gm ? `<details class="jm-hist-ed" data-hist-ed="${p.id}" ${app.histAbertos.has(p.id) ? "open" : ""}>
          <summary><i class="fa-solid fa-sliders"></i> ${T("Janela.DataIconeECor")}</summary>
          <div class="jm-hist-ed-campos">
            ${Tempo.ok() ? `<label>${T("Comum.Data")} ${campoData("hist", ac.td ?? hoje, `data-page="${p.id}"`)}</label>
              ${ac.td != null ? `<button type="button" class="sec" data-action="histSemData" data-page="${p.id}" data-tooltip="${T("Janela.TirarADataSaiDa")}"><i class="fa-solid fa-calendar-xmark"></i></button>` : `<span class="jm-dica">${T("Janela.EscolhaUmaDataParaPor")}</span>`}` : ""}
            <label>${T("Comum.Icone")} <select data-hist-campo="icone" data-page="${p.id}">${Object.entries(HIST_ICONES).map(([k, r]) => `<option value="${k}" ${k === ac.icone ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>${T("Janela.Cor")} <input type="color" data-hist-campo="cor" data-page="${p.id}" value="${ac.cor}"></label>
          </div></details>` : "";
      const ctrl = `${naLinha ? `<a class="jm-mini-btn" data-action="histLinha" data-td="${ac.td}" data-tooltip="${T("Janela.VerEsteDiaNaLinha")}"><i class="fa-solid fa-timeline"></i></a>` : ""}${controlesPaginaNativa(ctx, p, T("Janela.EditarOTexto"), T("Janela.ApagarAcontecimento"))}`;
      blocos.push(secao(esc(p.name), ICONES_PAGINA[p.type] ?? "fa-solid fa-file", quando + edicao + await paginaNativa(p),
        "jm-hist-item", `data-page-id="${p.id}" style="--hist-cor:${ac.cor}"`, ctrl, gm ? `pg-${p.id}` : null));
    }
    blocos.push(ctx.avisoEscondidas());
    if (!paginas.length) blocos.push(`<p class="jm-vazio jm-centro">${gm ? `${T("Janela.NenhumAcontecimentoAindaCrieUm")} <i class="fa-solid fa-feather-pointed"></i> ${T("Janela.AoLadoDeCadaItem")}` : T("Janela.NadaRegistradoAinda")}</p>`);
    if (gm) blocos.push(botoesAdicionarPagina());
    blocos.push(notas(paginas[0] ?? null, secao));
    return blocos.join("");
  },

  acoes: {
    async histNovo(app) {
      const r = await registrarNaHistoria({ historiaId: app.ativa });
      if (!r) return;
      if (r.entry.id !== app.ativa) return app.abrirPagina(r.entry.id, { pagina: r.page.id });
      app._rolarPara = { pagina: r.page.id };
      app.render();
    },
    histOrdem(app) { app.histDesc = !app.histDesc; app.render(); },
    histLinha(app, ev, el) {
      const td = el.dataset.td != null ? Number(el.dataset.td) : null;
      app.abrirLinha(td, td != null ? "tudo" : "historia");
    },
    async histSemData(app, ev, el) {
      await app._entry()?.pages.get(el.dataset.page)?.update({ [`flags.${MOD}.acontecimento.td`]: null });
    }
  },

  /* seletor de data de um acontecimento (data-page = id da página) */
  data: {
    async hist(app, td, caixa) {
      const e = app._entry();
      if (!e) return;
      const p = e.pages.get(caixa.dataset.page);
      if (p) await p.update({ [`flags.${MOD}.acontecimento.td`]: td });
    }
  },

  ouvintes(app, root) {
    root.querySelectorAll("[data-hist-ed]").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) app.histAbertos.add(d.dataset.histEd); else app.histAbertos.delete(d.dataset.histEd);
    }));
    root.querySelectorAll("[data-hist-campo]").forEach((el) => el.addEventListener("change", () => {
      const p = app._entry()?.pages.get(el.dataset.page);
      if (p) p.update({ [`flags.${MOD}.acontecimento.${el.dataset.histCampo}`]: el.value });
    }));
  }
};
