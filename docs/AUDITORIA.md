# Auditoria do Journal 4.8.3 → 4.9.0

Referência para comparação e recuperação: `journal-mesa-v4.8.3.zip` (sem alterações). O Calendário da Mesa 4.2.0 não foi tocado (comparado arquivo por arquivo).

Os testes daqui rodam num **Foundry simulado** (node) e, para HTML e download, no **Chromium**. Nada foi executado num Foundry real. A lista do fim é para isso.

## Achados por gravidade

| # | Gravidade | Onde | Achado | Feito na 4.9 |
|---|---|---|---|---|
| 1 | **Alto** | `jornal/json.js` `baixarJson` | Exportar JSON não salvava o arquivo | Corrigido |
| 2 | **Alto** | `jornal/dados.js` `htmlSeguro` | Sem o `cleanHTML` do Foundry, o HTML passava sem limpeza para `innerHTML` | Corrigido |
| 3 | **Alto** | `jornal/redacao.js` | Os segredos ficam numa configuração de mundo, que vai para todos os clientes | Documentado; alternativa proposta (D) |
| 4 | **Médio** | `journal.js` socket `aviso`/`imagem` | Tipo de aviso sem filtro chamava qualquer método; imagem sem validar o caminho | Corrigido |
| 5 | **Médio** | `jornal/json.js` `importarNoJornal` | Edição criada vazia e preenchida depois: uma falha no meio deixava rascunho vazio | Corrigido |
| 6 | **Médio** | `jornal/json.js` | Sem limite de tamanho ou de edições; objetos viravam "[object Object]"; JSON de outra coisa criava edição vazia | Corrigido |
| 7 | **Médio** | `i18nmod.cjs` (ferramenta de idioma) | `"Enter"`, `"Escape"`, `"ForcedDeletion"` e `"JournalDirectory"` passavam por `T()` | Corrigido |
| 8 | **Médio** | `jornal/visual.js` | A descrição do jornal com HTML ia sem limpeza para a ficha | Corrigido |
| 9 | **Baixo** | `journal.js` | Três `T(T(...))` (tradução dupla) | Corrigido |
| 10 | **Baixo** | `journal.js` editor rico e nova pasta | Caíam na alternativa sem nenhum aviso | Aviso único no console |
| 11 | **Baixo** | `lojas/tabelas.js` | A pasta das tabelas era sempre criada em português, mas a dica mostrava o nome traduzido | Corrigido |
| 12 | **Baixo** | `jornal/vinculos.js` | Título "Vínculos" fixo em português | Corrigido |
| 13 | **Baixo** | `jornal/redacao.js`, `publicacao.js` | Dois mestres ao mesmo tempo: gravações concorrentes | Pendente (descrito abaixo) |
| 14 | **Melhoria** | `journal.js` (5.870 linhas) | Arquivo grande demais | 1º passo: `idioma.js` |
| 15 | **Melhoria** | `jornal/*.js` | Seis cópias de `try { fromUuidSync } catch` | `docDe()` |
| 16 | **Melhoria** | `jornal/dados.js` | Cada leitura de edição limpava todo o HTML de novo | Cache |

## Detalhes

### 1. Exportar JSON não salvava (Alto)
- **Evidência:** `document.body.appendChild(a); a.click()`. O Foundry tem um ouvinte de cliques em `a[href]` no corpo da página, que impede o padrão e abre o link em outra janela.
- **Consequência:** o botão de exportar (na página do jornal e no editor) não gerava arquivo.
- **Correção:** `foundry.utils.saveDataToFile`, que o resto do módulo já usava. A reserva dispara o clique num link solto, fora da página.
- **Risco:** baixo; o formato do arquivo é o mesmo.
- **Teste:** no Chromium, com um ouvinte igual ao do Foundry, o código antigo não baixa e o novo baixa. No simulado, a exportação passa pelo `saveDataToFile` sem pôr link na página.

### 2. HTML sem limpeza (Alto)
- **Evidência:** `try { cleanHTML } catch { /* fica como veio */ }`. As flags da página não são limpas pelo servidor, e a folha usa `innerHTML`.
- **Consequência:** se o `cleanHTML` faltar (ou mudar de lugar numa versão do Foundry), `<img onerror>` vindo de um JSON importado roda no navegador de quem lê. Também alcança jogadores que tenham permissão de Dono no Diário do jornal e mexam nas flags.
- **Correção:** `jornal/html.js` limpa sempre, depois do `cleanHTML` quando ele existe. Usa um `<template>`, onde nada carrega nem executa enquanto limpa. A formatação, as seções secretas, os `@UUID` e as imagens ficam.
- **Risco:** baixo/médio; um atributo `style` com `url(...)` é retirado.
- **Teste:** simulado e Chromium (nenhum alerta disparado, formatação mantida).

### 3. Segredos das notícias (Alto, limite da arquitetura)
- **Evidência:** `game.settings.register(..., "jornalSegredos", { scope: "world" })`. O Foundry envia as configurações de mundo para todos os clientes. `segredosDe()` devolver vazio para jogadores só esconde da tela.
- **Consequência:** no console (F12), um jogador lê a veracidade e as notas do mestre com `game.settings.get("journal-mesa","jornalSegredos")`. O mesmo vale para rascunhos e páginas com permissão "Nada": os documentos do mundo também vão para todos.
- **Alternativa proposta (não implementada):** guardar os segredos num **compêndio do mundo** do Journal (um Diário por jornal), com a permissão do compêndio "Nada" para jogadores. O conteúdo de compêndios não vai junto com o mundo: só é carregado quando alguém pede.
  - Migração não destrutiva: copiar do setting para o compêndio e só limpar o setting depois de conferir.
- **Por que não agora:** não consegui confirmar daqui que o servidor do Foundry 14 recusa a leitura de um compêndio sem permissão. Se ele só esconder na interface, a mudança daria trabalho e não daria sigilo.
- **Teste no Foundry real que decide:**
  1. Crie um compêndio de Diários e ponha a permissão "Nada" para Jogador.
  2. Como jogador, no F12, rode `await game.packs.get("world.NOME").getDocuments()`.
  3. Se der erro ou vier vazio, vale implementar.

### 4. Socket (Médio)
- **Evidência:** `ui.notifications[msg.tipo ?? "info"](msg.texto)` e `abrirImagem(msg.src, …)` sem validação. O Foundry não informa quem mandou a mensagem.
- **Correção:** só os tipos info, warn, error e success; texto até 500 caracteres; caminho de imagem por `caminhoSeguro`. Os pedidos ao mestre já eram validados (`motivoRecusa`).
- **Risco:** baixo.
- **Teste:** simulado (tipo inválido vira "info"; texto que não é texto e `javascript:` são ignorados).

### 5 e 6. Importação (Médio)
- **Correção:**
  - A página nasce completa, com nome, texto nativo e flags. JSON inválido não cria nada.
  - Limites de 2 MB, 50 edições e 60 matérias.
  - Avisos de formato, versão, número repetido, veracidade desconhecida e segredos não gravados.
  - O formato `journal-mesa.edicao` v1 não muda; exportar e reimportar continua igual (testado).
- **Risco:** baixo. Um JSON que antes importava uma edição vazia sem reclamar (por exemplo `{}`) agora é recusado.

### 7. Ferramenta de idioma (Médio)
- **Evidência:** o código gerado tinha `e.key === T("Escape")`, `ev.key !== T("Enter")` e `constructor?.name === T("ForcedDeletion")`.
- **Consequência:** hoje as traduções são iguais ao original. Se alguém traduzisse "Enter", o Enter deixaria de funcionar nos formulários.
- **Correção:** `i18nmod.cjs` não embrulha comparações com `.key`, `.code` e `constructor.name`, nem texto já dentro de `T()`.
- **Teste:** comparação do código gerado (só essas linhas mudaram).

### 13. Dois mestres ao mesmo tempo (Baixo, pendente)
- **Evidência:** `naFila` ordena só dentro do mesmo navegador.
- **Consequências possíveis:**
  - Dois mestres salvando segredos no mesmo segundo: o último apaga a mudança do outro.
  - Um mestre clica em Publicar enquanto o principal publica a programada: a edição pode ser anunciada duas vezes.
- **Proposta:** mandar essas gravações para o mestre principal pelo socket (como os pedidos dos jogadores). Não feito, porque é raro e mexe no fluxo de publicação.

### 14. Arquivo grande (Melhoria)
- **Feito:** os textos de idioma saíram para `scripts/idioma.js`. Qualquer parte extraída agora importa `T` direto.
- **Próximos candidatos**, com fronteiras claras:
  - visualizador de permissões e menus da barra lateral (cerca de 130 linhas);
  - medidor dos Nexus e anomalias (cerca de 120);
  - diário de sessão (cerca de 100);
  - Regras da Mesa.
- **Fora disso:** a `JournalApp` (cerca de 3.000 linhas) é uma classe só e não convém dividir de uma vez.
- **Atenção:** o `journal.js` é **gerado**. Edite `journal-antes-i18n.js` e rode `aplicar.py`.

### Erros silenciosos (catch)
Revisei os 110 blocos `catch`.

- **Esperados** (a maioria): cancelar um diálogo, ler configuração antes do `init`, UUID malformado, área de transferência, iframe de PDF, `dragData` que não é JSON.
- **Recuperáveis, já com aviso único** (`avisoUmaVez`): toda a integração com o Calendário.
- **Deveriam avisar**: editor rico, nova pasta e os dois pontos de importar (corrigidos).
- **Deveriam interromper**: a criação da edição em duas etapas (item 5, corrigido).

Nada foi silenciado nem removido.

## Foundry 13 → 14

O que saiu, e por quê:

| Arquivo e função | Código da versão antiga | Por que sobra no v14 | Substituto | Risco |
|---|---|---|---|---|
| `apagarChave`, `chaveApagar`, `gravarJunto` | `game.release.generation >= 14` | Sempre verdadeiro | Só a presença do `ForcedDeletion`; o `-=` continua como reserva | Baixo |
| `TE`, `FP` | `?? globalThis.TextEditor/FilePicker` | Os globais estão obsoletos e os de `foundry.applications` sempre existem | `foundry.applications.ux.TextEditor.implementation`, `apps.FilePicker.implementation` | Baixo |
| `abrirImagem` | `new globalThis.ImagePopout(src, …)` (assinatura v12) | Nunca alcançado no v13+ | `foundry.applications.apps.ImagePopout` | Baixo |
| `abrirPermissoes` | `globalThis.DocumentOwnershipConfig` | Idem | `foundry.applications.apps.DocumentOwnershipConfig` | Baixo |
| Ganchos | `renderChatMessage`, `renderSidebarDirectory`, `getJournalDirectoryEntryContext`, `getJournalDirectoryFolderContext` | Nomes do v12 | `renderChatMessageHTML`, `renderDocumentDirectory`, `getJournalEntryContextOptions`, `getFolderContextOptions` (já registrados) | Baixo |
| Ganchos de render e menu | `html?.[0]`, `li?.[0]` (jQuery) | O v14 entrega HTMLElement | — | Baixo |
| Exportação de dados | `?? globalThis.saveDataToFile` | Global obsoleto | `foundry.utils.saveDataToFile` | Baixo |

Ficaram, de propósito:
- A reserva `-=` do `ForcedDeletion`: aceita no v14, protege contra mudança de API.
- A caixa de texto simples se o `HTMLProseMirrorElement` falhar.
- O teste do `JournalEntrySheet` nos registros de ficha.

Nada disso é do D&D 5e: a compatibilidade com o sistema (5.0.0 a 6.0.6) não mudou.

`module.json`: `minimum: "14"`, `verified: "14.369"`, sem `maximum`, sem declarar o v15.

## Checklist no Foundry 14 real

1. Ativar a 4.9.0 num mundo de teste (cópia do mundo de jogo). O console não deve ter erros do Journal ao carregar.
2. Barra lateral de Diários:
   - os botões Journal e "Página do Journal" aparecem;
   - o botão direito mostra "Abrir no Journal", "Quem vê" e, numa pasta, "Nova página do Journal";
   - as bolinhas de dono aparecem.
3. Jornal:
   - criar um jornal e uma edição, escrever no editor (o editor rico deve abrir, não a caixa simples);
   - publicar, programar, ler e apresentar;
   - abrir as várias páginas da leitura.
4. **Exportar JSON**: o arquivo deve ser salvo (no navegador ou no app do Foundry).
5. Importar esse arquivo de volta e comparar. Importar `{}`: deve recusar. Importar um texto com `<img src=x onerror=alert(1)>`: nenhum alerta ao ler.
6. Jogador conectado:
   - não vê rascunhos;
   - vê a edição publicada e o aviso no chat;
   - abre os vínculos que pode ver.
7. Lojas:
   - comprar, vender, pechincha (cartão no chat) e as tabelas das lojas;
   - a pasta das tabelas existente deve ser reutilizada.
8. Saque do combate, missões e recompensas, diário de sessão (iniciar, encerrar, copiar o registro), Nexus e Linha do tempo com o Calendário 4.2.0.
9. Trocar o idioma para inglês e repetir os itens 3 e 4 rapidamente.
10. Teste do compêndio do item 3, se quiser decidir sobre o sigilo.

## Ainda pendente
- Sigilo real dos segredos (item 3): o dono do módulo decidiu manter como está (limite documentado).
- Dois mestres simultâneos (item 13): o dono do módulo decidiu manter como está.
- Divisão do `journal.js` (item 14): feita na 4.10.0 (núcleo + 8 partes). A `JournalApp` (`partes/janela.js`, cerca de 3.000 linhas) foi dividida na 5.3.0: a janela ficou com ~890 linhas e cada tipo de página tem seu arquivo em `scripts/paginas/`.
