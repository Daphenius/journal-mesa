/* Jornal de Notícias — idioma.
 * Textos em lang/pt-BR.json e lang/en.json, sob "JMESA". t("Jornal.Publicar") devolve o texto do idioma
 * do Foundry (com {campos} trocados). O Foundry só lê a pasta lang/ ao iniciar o mundo: se o módulo foi
 * atualizado e a página só recarregada, garantirIdioma() carrega o arquivo sozinho, para nunca aparecer
 * uma chave crua. Sem tradução no idioma escolhido, o Foundry usa o inglês. */
const PREFIXO = "JMESA";

export function t(chave, dados) {
  const k = `${PREFIXO}.${chave}`;
  try {
    if (game.i18n?.has?.(k)) return dados ? game.i18n.format(k, dados) : game.i18n.localize(k);
  } catch { /* sem i18n ainda */ }
  return chave.split(".").pop();
}

let carregando = null;
export function garantirIdioma() {
  if (game.i18n.has(`${PREFIXO}.Jornal.Titulo`)) return Promise.resolve();
  carregando ??= (async () => {
    const lang = String(game.i18n.lang);
    const arquivo = lang.startsWith("pt") ? "pt-BR" : "en";
    for (const a of [...new Set([arquivo, "en"])]) {
      try {
        const r = await fetch(new URL(`../../lang/${a}.json`, import.meta.url).href);
        if (!r.ok) continue;
        const dados = await r.json();
        const destino = a === arquivo ? game.i18n.translations : (game.i18n._fallback ??= {});
        foundry.utils.mergeObject(destino, dados, { inplace: true, overwrite: false });
      } catch (err) { console.warn("Journal da Mesa | não consegui carregar o idioma", a, err); }
    }
  })();
  return carregando;
}
