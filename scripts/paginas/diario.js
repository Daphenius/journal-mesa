/* Journal — Diário comum (tipo "diario"): todas as páginas nativas do Foundry (texto, imagem, PDF, vídeo,
 * regras, listas de magias…) uma abaixo da outra. */
import { T } from "../idioma.js";
import { ICONES_PAGINA, esc, podeVer, podeVerSecao } from "../nucleo.js";
import { botoesAdicionarPagina, controlesPaginaNativa, notas, paginaNativa, primeiraImagem } from "./comum.js";
import { secaoCalendario } from "./calendario.js";

export default {
  tipo: "diario",
  editavel: false,
  fichaNativa: true,
  completa: true,
  imagemCabecalho: (ctx) => primeiraImagem(ctx.a),

  async html(entry, app, ctx) {
    const { a, gm, secao } = ctx;
    const blocos = [await secaoCalendario(ctx)];
    const paginas = a.pages.filter((p) => gm || (podeVer(entry) && (p.testUserPermission(game.user, "OBSERVER") || podeVerSecao(entry, `pg-${p.id}`))));
    ctx.escondidas += a.pages.length - paginas.length;
    for (const p of paginas) {
      const ctrl = controlesPaginaNativa(ctx, p, T("Janela.EditarPagina"), T("Comum.ApagarPagina"));
      blocos.push(secao(esc(p.name), ICONES_PAGINA[p.type] ?? "fa-solid fa-file", await paginaNativa(p), "", `data-page-id="${p.id}"`, ctrl, gm ? `pg-${p.id}` : null));
    }
    blocos.push(ctx.avisoEscondidas());
    if (!paginas.length && gm) blocos.push(secao(T("Janela.Conteudo"), "fa-solid fa-file-lines", `<p class="jm-vazio">${T("Janela.DiarioVazio")}</p>`));
    if (gm) blocos.push(botoesAdicionarPagina());
    blocos.push(notas(paginas[0] ?? null, secao));
    return blocos.join("");
  }
};
