/* Journal — painel "Regras da Mesa" (aba especial __regras): combinados da sessão 0, propostos, votados
 * e comentados por todos. As operações vão para o mestre pelo socket (pedir("regras", …)). */
import { T } from "../idioma.js";
import { gerarDiarioRegras } from "../partes/pechincha.js";
import { Dialogo, LIMITES_REGRAS, REGRAS_CATS, REGRAS_STATUS, ehGM, esc, pedir, regrasMesa } from "../nucleo.js";

/** Regras da Mesa: combinados da sessão 0, propostos e discutidos por todos. */
function painelRegras(app) {
  const gm = ehGM();
  const { itens, sessao0 } = regrasMesa();
  const eu = game.user.id;
  const nome = (uid) => (uid ? esc(game.users.get(uid)?.name ?? "?") : `<i>${T("Janela.Anonimo2")}</i>`);
  const quando = (t) => esc(new Date(t).toLocaleDateString(game.i18n.lang));
  const opCat = (sel) => Object.entries(REGRAS_CATS).map(([k, [r]]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(r)}</option>`).join("");
  const contagem = Object.fromEntries(Object.keys(REGRAS_STATUS).map((k) => [k, itens.filter((i) => i.status === k).length]));
  const filtro = REGRAS_STATUS[app.filtroRegras] ? app.filtroRegras : "";
  const card = (i) => {
    const [stRot, stIc] = REGRAS_STATUS[i.status] ?? REGRAS_STATUS.proposta;
    const votos = Object.entries(i.votos ?? {});
    const sim = votos.filter(([, v]) => v === "sim").map(([u]) => u), nao = votos.filter(([, v]) => v === "nao").map(([u]) => u);
    const meu = i.votos?.[eu];
    const pode = gm || (i.autor === eu && i.status === "proposta");
    const nomes = (l) => l.map((u) => esc(game.users.get(u)?.name ?? "?")).join(", ");
    return `<div class="jm-regra st-${esc(i.status)}" data-regra-id="${i.id}">
      <div class="jm-regra-topo">
        <span class="jm-regra-status st-${esc(i.status)}"><i class="${stIc}"></i> ${stRot}</span>
        <b class="jm-regra-titulo">${esc(i.titulo)}</b>
        <small>${T("Comum.Por")} ${nome(i.autor)} · ${quando(i.criado)}</small>
        <span class="jm-sec-ctrl">
          ${gm ? `<select data-regra-status>${Object.entries(REGRAS_STATUS).map(([k, [r]]) => `<option value="${k}" ${k === i.status ? "selected" : ""}>${r}</option>`).join("")}</select>` : ""}
          ${pode ? `<a class="jm-mini-btn" data-regra="editar" data-tooltip="${T("Janela.Editar")}"><i class="fa-solid fa-pen"></i></a>
            <a class="jm-mini-btn" data-regra="apagar" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-trash"></i></a>` : ""}
        </span>
      </div>
      ${i.texto ? `<div class="jm-regra-texto">${esc(i.texto).replace(/\n/g, "<br>")}</div>` : ""}
      <div class="jm-regra-votos">
        <button type="button" class="${meu === "sim" ? "ativo" : ""}" data-regra="votar" data-voto="${meu === "sim" ? "" : "sim"}" data-tooltip="${sim.length ? nomes(sim) : T("Janela.NinguemAinda")}"><i class="fa-solid fa-thumbs-up"></i> ${T("Janela.Concordo")} <b>${sim.length}</b></button>
        <button type="button" class="${meu === "nao" ? "ativo" : ""}" data-regra="votar" data-voto="${meu === "nao" ? "" : "nao"}" data-tooltip="${nao.length ? nomes(nao) : T("Janela.NinguemAinda")}"><i class="fa-solid fa-thumbs-down"></i> ${T("Janela.NaoConcordo")} <b>${nao.length}</b></button>
      </div>
      <details class="jm-regra-coments" ${app.regrasAbertas?.has(i.id) ? "open" : ""} data-regra-det="${i.id}">
        <summary><i class="fa-solid fa-comments"></i> ${(i.comentarios ?? []).length} ${T("Janela.ComentarioS")}</summary>
        ${(i.comentarios ?? []).map((c) => `<div class="jm-regra-coment"><b>${nome(c.autor)}</b> <small>${quando(c.t)}</small>
          ${gm || c.autor === eu ? `<a class="jm-mini-btn" data-regra="apagarComentario" data-cid="${c.id}" data-tooltip="${T("Comum.Apagar")}"><i class="fa-solid fa-xmark"></i></a>` : ""}
          <div>${esc(c.texto).replace(/\n/g, "<br>")}</div></div>`).join("")}
        <div class="jm-regra-novo-coment">
          <textarea rows="2" data-regra-coment placeholder="${T("Janela.OQueVoceAcha")}"></textarea>
          <label class="jm-check"><input type="checkbox" data-regra-coment-anon> ${T("Janela.Anonimo")}</label>
          <button type="button" data-regra="comentar"><i class="fa-solid fa-paper-plane"></i> ${T("Janela.Comentar")}</button>
        </div>
      </details>
    </div>`;
  };
  const secoes = Object.entries(REGRAS_CATS).map(([k, [rot, ic]]) => {
    const l = itens.filter((i) => i.cat === k && (!filtro || i.status === filtro)).sort((a, b) => a.criado - b.criado);
    if (!l.length) return "";
    return `<section class="jm-secao jm-regras-cat"><h3><i class="${ic}"></i> ${esc(rot)} <small>(${l.length})</small></h3>${l.map(card).join("")}</section>`;
  }).join("");
  return `<article class="jm-pagina jm-painel-regras">
    <header class="jm-cabecalho"><div class="jm-cab-texto"><span class="jm-selo"><i class="fa-solid fa-handshake"></i> ${T("Comum.RegrasDaMesa")}</span>
      <h1 class="jm-titulo">${T("Janela.Sessao0")}</h1>
      <div class="jm-sub-linha"><span class="jm-detalhe">${sessao0?.concluida ? `<i class="fa-solid fa-circle-check"></i> ${T("Janela.ConcluidaEm")} ${quando(sessao0.quando)}` : `<i class="fa-solid fa-comments"></i> ${T("Janela.EmConversa")}`}</span></div></div>
      ${gm ? `<div class="jm-cab-botoes">
        <button type="button" data-regra="modelos" data-tooltip="${T("Janela.AdicionarTopicosComunsDeSessao")}"><i class="fa-solid fa-list-check"></i></button>
        <button type="button" data-regra="diario" data-tooltip="${T("Janela.CriarAtualizarODiarioRegras")}"><i class="fa-solid fa-book"></i></button>
        <button type="button" data-regra="concluir" class="${sessao0?.concluida ? "ativo" : ""}" data-tooltip="${sessao0?.concluida ? T("Janela.ReabrirASessao0") : T("Janela.MarcarASessao0Como")}"><i class="fa-solid fa-flag-checkered"></i></button>
      </div>` : ""}
    </header>
    <p class="jm-dica">${T("Janela.TodosPodemProporTopicosComentar")} <b>${T("Janela.Combinado")}</b>. ${T("Janela.PropostasEComentariosAnonimosNao")}</p>
    <nav class="jm-subabas">
      <button type="button" class="${!filtro ? "ativo" : ""}" data-regra="filtro" data-filtro="">${T("Janela.Todos")} <small>${itens.length}</small></button>
      ${Object.entries(REGRAS_STATUS).map(([k, [r, ic]]) => `<button type="button" class="${filtro === k ? "ativo" : ""}" data-regra="filtro" data-filtro="${k}"><i class="${ic}"></i> ${r} <small>${contagem[k]}</small></button>`).join("")}
    </nav>
    ${secoes || `<p class="jm-vazio jm-centro">${itens.length ? T("Janela.NadaComEsseFiltro2") : (gm ? T("Janela.NenhumTopicoAindaUseO") : T("Janela.NenhumTopicoAindaProponhaO"))}</p>`}
    <section class="jm-secao jm-regras-nova"><h3><i class="fa-solid fa-plus"></i> ${T("Janela.NovaProposta")}</h3>
      <div class="jm-form-dialogo">
        <label>${T("Janela.Assunto")} <select data-regra-nova="cat">${opCat("casa")}</select></label>
        <label>${T("Comum.Titulo")} <input type="text" data-regra-nova="titulo" maxlength="${LIMITES_REGRAS.titulo}" placeholder="${T("Janela.ExSemPvPSemCombinar")}"></label>
        <label>${T("Janela.Detalhes")} <textarea rows="3" data-regra-nova="texto" placeholder="${T("Janela.ExpliqueAIdeiaExemplosExcecoes")}"></textarea></label>
        <label class="jm-check"><input type="checkbox" data-regra-nova="anonimo"> ${T("Janela.EnviarAnonimoBomParaLimites")}</label>
        <button type="button" class="primario" data-regra="propor"><i class="fa-solid fa-paper-plane"></i> ${T("Janela.Propor")}</button>
      </div>
    </section>
  </article>`;
}

export default {
  tipo: "__regras",

  html(entry, app) { return painelRegras(app); },

  /** Cliques e campos do painel Regras da Mesa (não usam data-action: tudo passa pelo socket). */
  ouvintes(app, root) {
    const painel = root.querySelector(".jm-painel-regras");
    if (!painel) return;
    painel.querySelectorAll("[data-regra-det]").forEach((d) => d.addEventListener("toggle", () => {
      app.regrasAbertas ??= new Set();
      if (d.open) app.regrasAbertas.add(d.dataset.regraDet); else app.regrasAbertas.delete(d.dataset.regraDet);
    }));
    painel.querySelectorAll("[data-regra-status]").forEach((sel) => sel.addEventListener("change", () => {
      pedir("regras", { userId: game.user.id, op: "status", id: sel.closest("[data-regra-id]").dataset.regraId, status: sel.value });
    }));
    painel.querySelectorAll("[data-regra]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const op = b.dataset.regra;
      const card = b.closest("[data-regra-id]");
      const id = card?.dataset.regraId;
      if (op === "filtro") { app.filtroRegras = b.dataset.filtro; return app.render(); }
      if (op === "diario") return gerarDiarioRegras();
      if (op === "propor") {
        const v = (k) => painel.querySelector(`[data-regra-nova="${k}"]`);
        const titulo = v("titulo").value.trim();
        if (!titulo) return ui.notifications.warn(T("Comum.EscrevaUmTituloParaA"));
        pedir("regras", { userId: game.user.id, op: "propor", cat: v("cat").value, titulo, texto: v("texto").value, anonimo: v("anonimo").checked });
        v("titulo").value = ""; v("texto").value = ""; v("anonimo").checked = false;
        return;
      }
      if (op === "votar") return pedir("regras", { userId: game.user.id, op, id, voto: b.dataset.voto || null });
      if (op === "comentar") {
        const ta = card.querySelector("[data-regra-coment]");
        if (!ta.value.trim()) return;
        (app.regrasAbertas ??= new Set()).add(id);
        pedir("regras", { userId: game.user.id, op, id, texto: ta.value, anonimo: card.querySelector("[data-regra-coment-anon]").checked });
        ta.value = "";
        return;
      }
      if (op === "apagarComentario") return pedir("regras", { userId: game.user.id, op, id, cid: b.dataset.cid });
      if (op === "apagar") {
        const ok = await Dialogo().confirm({ window: { title: T("Janela.ApagarTopico") }, content: `<p>${T("Janela.ApagarEsteTopicoEOs")}</p>` });
        if (ok) pedir("regras", { userId: game.user.id, op, id });
        return;
      }
      if (op === "editar") {
        const item = regrasMesa().itens.find((i) => i.id === id);
        if (!item) return;
        const dados = await Dialogo().prompt({
          window: { title: T("Janela.EditarTopico"), icon: "fa-solid fa-pen" },
          position: { width: 480 },
          content: `<div class="jm-form-dialogo">
            <label>${T("Janela.Assunto")} <select name="cat">${Object.entries(REGRAS_CATS).map(([k, [r]]) => `<option value="${k}" ${k === item.cat ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>${T("Comum.Titulo")} <input type="text" name="titulo" value="${esc(item.titulo)}" maxlength="${LIMITES_REGRAS.titulo}"></label>
            <label>${T("Janela.Detalhes")} <textarea name="texto" rows="5">${esc(item.texto)}</textarea></label></div>`,
          ok: { label: T("Comum.Salvar"), icon: "fa-solid fa-check", callback: (e2, bt) => ({ cat: bt.form.elements.cat.value, titulo: bt.form.elements.titulo.value, texto: bt.form.elements.texto.value }) }
        }).catch(() => null);
        if (dados) pedir("regras", { userId: game.user.id, op, id, ...dados });
        return;
      }
      if (["modelos", "concluir"].includes(op)) return pedir("regras", { userId: game.user.id, op });
    }));
  }
};
