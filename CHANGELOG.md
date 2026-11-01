# Histórico de versões — Journal da Mesa

## 5.4.6

### Corrigido
- **Mensagem errada ao jogador quando a compra falha e o estorno também falha.** Se a loja não conseguia gravar a baixa do estoque e, na sequência, a devolução das moedas também falhava, o mestre recebia o alerta certo para acertar à mão, mas o jogador ainda lia "nada foi cobrado. Tente de novo" — mesmo com as moedas descontadas. Agora, nesse caso, o jogador lê: "A operação falhou e nem tudo pôde ser desfeito. Confira com o mestre antes de tentar de novo." Quando o estorno funciona, a mensagem continua a de antes. Achado da mesma revisão externa da 5.4.5; coberto por teste de regressão.

## 5.4.5

Correções vindas de uma **revisão externa** do código (feita por outra IA, a pedido do autor), que apontou quatro problemas reproduzidos num Foundry simulado e três pontos de documentação. Nada muda no uso normal da mesa; o que muda é o que acontece quando alguém tenta burlar um pedido ou quando uma gravação falha no meio.

- **Pedidos conferem o tipo da página.** Um pedido "pegar" (de baú) mandado à mão pelo console, mas apontando para uma **loja**, levava o item de graça: o item ia para a ficha e sumia do estoque sem cobrar nada. Agora o mestre confere, pelo tipo real da página, o que cada ação aceita: pegar só em baú; comprar, vender, rolar a oferta e pechinchar só em loja; pegar recompensa só em missão. Também confere a origem da compra (estoque da semana ou oferta do dia) e os dados obrigatórios de cada pedido (qual item, qual grupo de recompensa, qual ficha). Pedido fora disso é recusado com aviso ao jogador e nada muda. Os botões normais da janela continuam funcionando igual.
- **Vender item com quantidade zero.** Um item na ficha com quantidade 0 era vendido como se fosse uma unidade (a loja pagava e ganhava o item). Agora quantidade zero, negativa ou inválida não vende (aviso "Você não tem nenhuma unidade desse item"), e a aba Vender nem lista esses itens. Item sem campo de quantidade (talento, magia, item simples) vale uma unidade, como antes. Venda parcial e venda da última unidade continuam iguais.
- **Compra desfeita por inteiro quando algo falha.** Se a gravação do estoque (ou da oferta do dia) falhasse depois de o item já estar na ficha e o ouro já cobrado, ficava assim: item entregue, ouro cobrado, estoque sem baixa. Agora a compra é entrega → cobrança → baixa do estoque, e qualquer falha desfaz os passos anteriores (o item sai da ficha, o ouro volta); o jogador recebe "nada foi cobrado". O mesmo vale para pegar item de baú e de recompensa: se o baú ou a missão não gravar, o item criado na ficha é apagado. Se nem o desfazer der certo (muito raro), o mestre recebe um aviso vermelho dizendo exatamente o que ficou pela metade, para acertar à mão.
- **Recompensa de missão não é entregue duas vezes.** Clicar em Entregar numa recompensa já entregue dava o XP e as moedas de novo. Agora um grupo entregue mostra **Reabrir entrega** no lugar de Entregar; para repetir de propósito, o mestre reabre (com confirmação) e entrega outra vez. Dois cliques rápidos contam como um. Os itens deixados na missão continuam com o botão **Pegar**. E a entrega passou a ser itens → XP e moedas → página da missão: se algo falhar, o que já tinha sido feito é desfeito e a recompensa não fica marcada como entregue.
- Documentação: o comentário da compra no código agora descreve o que a reversão cobre de verdade; o README explica que edições programadas do Jornal são publicadas quando o mestre principal está com o mundo aberto (ao entrar e na virada do dia), não em segundo plano; `docs/AUDITORIA.md` marca como históricas as instruções sobre `journal-antes-i18n.js` e `aplicar.py` (que não existem mais) e aponta para `tools/i18n-migrar.mjs`.
- Testes: novo `node tests/pedidos.test.mjs` (118 verificações) cobre os quatro casos acima pelo mesmo caminho que o mestre usa (pedido → validação → ação), inclusive com falhas injetadas em cada passo da compra e da entrega. `node tests/formato.test.mjs` continua com 134 e `node tests/i18n.test.mjs` passa a 9.294 (1.393 chaves, 1.306 chamadas). O Foundry simulado ganhou `Actor.updateDocuments`, `deleteEmbeddedDocuments` e a saída de item da ficha ao apagar. Tudo isso é validação em Node; o autor testa no Foundry antes de publicar.

## 5.4.0

- **README novo, organizado por funcionalidade.** O README foi reescrito do zero: saiu o histórico espalhado pelos títulos ("(4.4)", "(4.7)"...), que já está aqui no CHANGELOG, e entrou uma seção curta para cada coisa que o módulo faz: instalação, cada tipo de página (NPC, Local, Loja, Missão, Divindade, Baú, História, Diário de sessão, Jornal, Regras da Mesa, Nexus, Linha do tempo), as integrações que realmente existem no código (Calendário da Mesa, Dados em Cena, Item Piles, Translate All), as configurações, a API para macros, limitações e privacidade, como traduzir e como o código está organizado. Ficou com cerca de metade do tamanho (de 38 KB para 20 KB).
- **API documentada.** Tudo o que o módulo oferece em `game.modules.get("journal-mesa").api` (abrir, criar página, baú do combate, importar JSON e do Monk's, dia das ofertas, renovar estoques, fixados, Linha do tempo, Nexus e jornais) está numa tabela no README, com os parâmetros, o que devolve e exemplos de macro. No código, a API passou a ficar organizada no arquivo novo `scripts/api.js`, com a explicação de cada chamada; **o funcionamento não mudou** (as funções são as mesmas, só foram reunidas num lugar só). O Calendário da Mesa continua usando as mesmas chamadas.
- **Segredos do Jornal: aviso claro.** A veracidade das matérias e as notas do mestre continuam numa configuração de mundo, e o README agora diz sem rodeios que um jogador consegue lê-las pelo console (F12). Mover para uma flag do diário não resolveria, porque o Foundry também manda as flags de todos os diários para todos os jogadores; por isso nada foi movido. Veja "Limitações e privacidade" no README.
- Testes: `node tests/formato.test.mjs` continua passando (134 verificações) e `node tests/i18n.test.mjs` também (1.372 chaves, 1.280 chamadas conferidas).

## 5.3.0

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- **Reorganização interna: cada tipo de página tem seu arquivo.** O arquivo da janela (`scripts/partes/janela.js`, que tinha mais de 3.000 linhas) foi dividido: a janela em si ficou com as abas, a lista de pastas, a busca, o cabeçalho e a barra de baixo; o conteúdo e os botões de cada tipo de página (NPC, Local, Organização, Loja, Missão, Divindade, Baú, Anotação, História, Jornal, Diário e Monk's) e dos painéis (Linha do tempo, Nexus, Regras da Mesa) foram para `scripts/paginas/`, um arquivo por tipo. **Nada muda para quem joga**: as mesmas telas, os mesmos botões, os mesmos textos nos dois idiomas.
- Para quem mexe no código: o README explica a nova pasta `scripts/paginas/` (veja [Arquivos do código](README.md#arquivos-do-código-53)). A janela do Journal passou a ser criada num lugar só do núcleo (`obterJanela()`).
- Testes: `node tests/formato.test.mjs` continua passando (134 verificações) e `node tests/i18n.test.mjs` também (1.372 chaves, 1.280 chamadas conferidas — duas a menos porque dois trechos repetidos viraram um). Além disso, o HTML gerado pelo código novo foi comparado com o da 5.2.0, página por página, num Foundry simulado: saiu idêntico.

## 5.2.0

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- **Limpeza interna.** Foi removido o código que só existia para funcionar no Foundry 12 e 13 (o módulo exige o Foundry 14 desde a 4.9) e para versões antigas do Calendário da Mesa. Para as integrações com o calendário (histórico da campanha na Linha do tempo e no diário de sessão, anomalias dos Nexus) agora é preciso o **Calendário da Mesa 4.2 ou mais novo**; o `module.json` passa a indicar isso. Eventos já salvos no formato antigo do calendário continuam sendo lidos normalmente.
- Também saíram várias proteções que não serviam para nada (leituras de configuração embrulhadas em "se der erro, ignora", verificações de coisas que o Foundry 14 sempre tem) e trechos repetidos em vários arquivos viraram um só. **Nada muda para quem joga.**
- Pequeno acerto: "Permitir que role de novo" (limpar a oferta do dia de um jogador) agora apaga a oferta em vez de marcá-la como do "dia 0".
- Testes: `node tests/formato.test.mjs` continua passando (134 verificações) e `node tests/i18n.test.mjs` também (1.372 chaves, 1.282 chamadas conferidas).

## 5.1.0

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- **Tradução reorganizada.** Os textos da interface continuam em `lang/pt-BR.json` e `lang/en.json`, mas agora cada um tem um nome legível por área (`Janela.Fechar`, `Pechincha.Empate`, `Tabelas.Armas`...) em vez do código calculado de antes. **Nada muda para quem joga**: os mesmos textos, nos mesmos lugares, nos dois idiomas.
- **Para quem quiser traduzir**: basta editar `lang/en.json` (ou copiar para outro idioma) — o nome de cada chave diz onde o texto aparece. Veja [Traduzir o módulo](README.md#traduzir-o-módulo) no README.
- Textos que ainda não tinham versão em inglês (avisos do console sobre o Calendário, "modo simples", "sem ProseMirror") ganharam tradução; 15 textos que não eram mais usados em lugar nenhum foram apagados dos arquivos de idioma.
- Nomes das tabelas prontas das lojas e da pasta delas continuam saindo no idioma do mestre; a pasta criada antes da 4.9 (em português) segue sendo reconhecida.
- Ferramentas: `tools/i18n-migrar.mjs` dá chave a texto novo e confere os arquivos; `npm test` (ou `node tests/i18n.test.mjs`) confere que os dois idiomas têm as mesmas chaves, que toda chamada no código tem texto nos dois e que os `{campos}` batem. Nenhuma das duas vai no ZIP da release.
- Testes: `node tests/formato.test.mjs` continua passando (134 verificações); `node tests/i18n.test.mjs` é novo (1.373 chaves, 1.284 chamadas conferidas).

## 5.0.1

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- **Compra mais segura.** O item vai para a ficha antes de o ouro ser cobrado; se a cobrança falhar, o item é tirado de volta e o jogador recebe o aviso de que nada foi cobrado. Antes, uma falha entre a cobrança e a entrega podia deixar o personagem sem o ouro e sem o item.
- **Venda mais segura.** A venda segue a ordem item sai da ficha → jogador recebe o ouro → item entra no estoque da loja, e qualquer falha no meio desfaz os passos anteriores. Nem item duplicado na loja, nem jogador sem o item e sem o ouro.
- **Datas e ordem alfabética no idioma do Foundry.** A data real no diário de sessão, nas Regras da Mesa e no nome do baú do combate, e a ordem das pastas, páginas, magias e itens à venda seguiam sempre o formato brasileiro; agora seguem o idioma escolhido no Foundry.
- **Mais textos traduzidos.** Frases que ainda apareciam em português na interface em inglês (compras, vendas e saques no chat e no diário de sessão, "Buscar...", "Trocar imagem", "esgotado", "un.", "peso", "jogador", "dia N", "Sessão N", "Clique para ver os dados", unidades de repetição no calendário, entre outras) passaram para os arquivos de idioma.
- **Janela de arquivo cancelada.** Cancelar a escolha de imagem/PDF ao criar uma página, ou a escolha do arquivo em Importar JSON, não deixa mais a ação pendurada: ela simplesmente termina.
- **Ficha "Journal da Mesa" e abertura automática.** A ficha do módulo agora respeita a página e a âncora pedidas pelo link (antes só abria o diário), e a interceptação da ficha padrão (opção "Abrir diários sempre no Journal da Mesa") ficou mais estrita: só abre no Journal o que a regra de fichas aceita; todo o resto passa pela ficha original, com o resultado dela.
- Pequenos ajustes internos: dois ganchos de fim de combate viraram um; remoção de ficha ligada usa o mesmo caminho de exclusão do resto do módulo; código sem uso removido (lista de tipos do Monk's, rolagem de d20 antiga, importações sobrando); comentários antigos sobre "formato do Monk's" atualizados; o relatório da conversão vai para o console como informação, não como log. `AUDITORIA.md` foi para a pasta `docs/`.
- Testes: `node tests/formato.test.mjs` continua passando (1 arquivo, 134 verificações).

## 5.0.0

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação. A conversão do Monk's foi testada uma vez num mundo real e deu certo na primeira tentativa; só as páginas do tipo Imagem do Monk's ficaram para trás e foram transferidas à mão.
- **Formato próprio.** O Journal da Mesa passou a guardar os dados das páginas (tipo, conexões, estoque, objetivos, recompensas, moedas, ator ligado, notas pessoais) em `flags["journal-mesa"].dados`, em vez do formato do Monk's Enhanced Journal. Quantidade e preço dos itens de estoque ficam em `flags["journal-mesa"]` do item (`qtd`, `preco` em po, `de`). O módulo não depende mais do formato de outro módulo.
- **Conversão automática.** Ao abrir o mundo na 5.0, o mestre principal vê quantos diários estão no formato do Monk's (inclusive os que o próprio Journal da Mesa gravou até a 4.10) e pode converter na hora ou depois. A conversão só copia: as flags do Monk's ficam intactas, os IDs não mudam e os vínculos entre páginas continuam valendo.
- **Importar do Monk's.** Botão de quebra-cabeça ao lado de Importar JSON (só o mestre) e `api.importarDoMonks()`. Diários que chegam depois no formato do Monk's (compêndios, Monk's ativo) são convertidos sozinhos; Importar JSON converte os exportados pelo Monk's.
- **Relatório da conversão**: páginas convertidas por tipo, páginas já no formato novo (não tocadas), tipos só do Monk's (edição limitada) e vínculos quebrados.
- Testes: Foundry simulado em Node (`tests/`) com 134 verificações da conversão, da migração, da criação de páginas, de compra, venda, saque, estoque semanal, recompensas e notas.
- Correção: "Nova página em…" agora traduz o "em" ("in") na interface em inglês.
- Aviso com o Monk's ativo atualizado: cada módulo guarda os próprios dados.

## 4.10.5

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- Novo nome: **Journal da Mesa** (o `id` continua `journal-mesa`, então diários, configurações e dados salvos nos mundos não mudam). O nome aparece na janela, no botão da barra lateral, na ficha de diário, nas configurações e nos avisos, nos dois idiomas. As pastas que o módulo já criou nos mundos ("Journal — tabelas das lojas" e a pasta de itens) mantêm o nome.
- Pronto para publicar no GitHub: licença MIT, `module.json` com Daphenius como autor e links de manifesto, download, licença, README, changelog e Issues; motivos nas recomendações do Item Piles e do Translate All.
- Automação de release: ao publicar uma release, o GitHub monta `journal-mesa.zip` (com o `module.json` na raiz) e anexa os dois arquivos.
- README: instalação pelo manifesto, suporte e sugestões, licença e créditos, aviso de que o projeto é independente do Monk's Enhanced Journal, resumo em inglês, captura de tela e frases menos absolutas.
- Sem mudança de funcionamento.

## 4.10.4

Revisão da 4.10.3 (correção do editor do jornal feita por fora):
- **Mantido:**
  - o editor rico com o UUID da página;
  - o CSS que devolve o layout flexível à caixa de texto (o `display: block` antigo achatava a área de digitação);
  - o clique na área vazia levando ao campo;
  - o botão **Edição direta** e a troca automática para a edição direta quando o editor abre vazio ou sem área para digitar.
- **Ajustado:**
  - os textos do botão "Edição direta" e da dica passam pelos arquivos de idioma (estavam fixos no código, com teste de `game.i18n.lang`);
  - o aviso do console agora fala em "edição direta".
- **Testes:** os dois testes do editor foram atualizados para o formato novo (leitor por caixa; rede de segurança também para área sem tamanho). 105 de 105 com e sem o Calendário, 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo (simulado).

## 4.10.3 — Correção específica do editor visual do Jornal (Foundry 14)

- **Somente Jornal de Notícias > Editar edição**: usa no ProseMirror o UUID da página e parâmetros equivalentes aos do editor de descrições já funcional no Journal-da-Mesa.
- Corrige o CSS que forçava `display: block` no ProseMirror, preservando o espaço clicável e o layout flexível da área de texto.
- Encaminha cliques na área vazia para o campo ProseMirror; não força `save()` a cada tecla, reduzindo interferências na digitação.
- Adiciona o botão de segurança **Edição direta** quando o editor visual estiver presente mas não aceitar texto. Ele edita HTML renderizado, sem exigir o modo *Source HTML*.
- Mantém o conteúdo da manchete e das matérias em memória até o clique explícito em Salvar. Não altera publicação, calendário, lojas nem outros recursos.
- Auditoria estática de sintaxe e ZIP; requer teste real no Foundry 14 e validação de persistência.

## 4.10.2 — Correção pontual da edição de matérias (Foundry 14)

- Ajuste restrito ao **Jornal de Notícias**, no editor aberto por **Editar** em cada edição.
- Leitura explícita do conteúdo do ProseMirror ao salvar ou trocar de etapa, evitando o campo aparentemente vazio e a perda de alterações não sincronizadas.
- Se o ProseMirror não disponibilizar uma área editável, troca para campo HTML editável que preserva o conteúdo formatado (sem exibir tags HTML).
- Sem alterações em lojas, missões, calendários, permissões ou leitura das edições.
- A correção requer validação manual no Foundry VTT 14; testes estáticos não confirmam a interface em execução.

## 4.10.0

**O journal.js foi dividido em partes**, para facilitar achar e corrigir erros. Antes eram 5.900 linhas num arquivo só. Agora o console (F12) mostra em qual parte o erro aconteceu (por exemplo `partes/pechincha.js:120`). O funcionamento não muda.

- `scripts/journal.js` é só a porta de entrada (o module.json continua carregando ele).
- `scripts/nucleo.js` tem utilidades, dados, ações do mestre, configurações e inicialização.
- `scripts/partes/`:
  - `janela.js`: a janela principal;
  - `calendario.js`: integração com o Calendário da Mesa, datas e horário das lojas;
  - `historia.js`: História e Linha do tempo;
  - `pechincha.js`: negociação com o dono da loja;
  - `sessao.js`: diário de sessão, Nexus e rastreador de missões;
  - `tempo.js`: passagem do tempo e atualizações;
  - `barra.js`: barra lateral nativa;
  - `versao.js`: cache dos dados.
- As partes trocam funções só por importações explícitas. Nenhuma parte importa a porta de entrada, então um endereço com `?v=` no carregamento não duplica o módulo.
- Conferido:
  - o código é o mesmo, linha por linha (só distribuído);
  - os textos traduzidos são os mesmos;
  - os 27 ganchos do Foundry têm os mesmos 41 ouvintes, na mesma ordem;
  - nenhuma parte usa nome de outra sem importar.
- Testes: 105 de 105 com e sem o Calendário, 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo (simulado).

## 4.9.1

- **Corrigido: o texto já escrito no jornal não aparecia no editor e não dava para editar.** Três mudanças no editor do jornal:
  - O editor rico não recebe mais o documento da edição (`documentUUID`). O texto do jornal fica nas flags, não num campo do documento, e o editor passa a usar só o texto entregue, como o editor principal do Journal.
  - A janela, ao se redesenhar, só relê as caixas de texto que a pessoa usou. Um editor que ainda estava carregando podia responder vazio e apagar o texto da matéria.
  - Rede de segurança: se o editor rico abrir sem o texto (ou sem área para digitar) quando a matéria tem texto, ele vira sozinho uma caixa simples com o texto. Um aviso fica no console (F12).
- Preparação para dividir o journal.js: a janela principal passa a ser criada por uma função só (`obterJanela`), e o estado do dia e da sessão por funções da passagem do tempo. O funcionamento não muda.
- Testes: 105 de 105 com e sem o Calendário, 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo (simulado; o editor rico real só existe no Foundry).

## 4.9.0

**Foundry 14 passa a ser o mínimo.** Quem usa o Foundry 13 fica na 4.8.3. Nenhum dado muda: settings, flags e documentos são os mesmos.

Corrigido
- **Exportar JSON não salvava o arquivo.** O link de download era posto na página e o Foundry intercepta cliques em links no corpo da página (abre em outra janela). Agora o Journal usa o `saveDataToFile` do Foundry, como o resto do módulo já fazia, e avisa "Exportando…".
- **HTML das matérias**: a limpeza dependia do `cleanHTML` do Foundry e, se ele faltasse, deixava o texto como veio. Agora o Journal limpa sempre (novo `scripts/jornal/html.js`): tira script, iframe, svg, form, atributos `on*`, `srcdoc` e links `javascript:`/`vbscript:`/`data:` (fica só `data:image` em imagens). A formatação do editor fica. Vale para a folha, a página nativa e a descrição do jornal.
- **Importação JSON**: a edição é criada já completa, numa gravação só (antes: página vazia, depois o conteúdo; uma falha no meio deixava um rascunho vazio). Limites de 2 MB, 50 edições e 60 matérias (com aviso). Recusa JSON sem nada de edição. Campos que não são texto viram vazio, em vez de "[object Object]". Avisos novos: formato desconhecido, versão mais nova, número de edição repetido, veracidade desconhecida, segredos não gravados. "Importar aqui", com várias edições no JSON, avisa que entra só a primeira.
- **Socket**: os avisos e imagens enviados pelo socket aceitam só os tipos info/warn/error/success, só texto (até 500 caracteres) e só caminhos de imagem sem esquemas perigosos. Antes, um tipo qualquer chamava qualquer método de `ui.notifications`.
- **Teclas e nomes técnicos traduzidos por engano**: a ferramenta de idioma embrulhava `"Enter"`, `"Escape"`, `"ForcedDeletion"` e `"JournalDirectory"` em `T()`. Uma tradução diferente dessas palavras quebraria o Enter, o Esc e a limpeza de listas. Também tirados três `T(T(...))` duplicados. A ferramenta agora ignora comparações com `ev.key`, `ev.code` e `constructor.name`.
- A pasta "Journal — tabelas das lojas" é criada no idioma do mestre e achada por uma marca (as pastas antigas, em português, continuam sendo encontradas).
- A janela "Vínculos" agora tem título traduzido.

Foundry 14 (código só do v13 ou anterior, retirado)
- `game.release.generation >= 14` (3 lugares): sempre verdadeiro no v14. O `ForcedDeletion` continua com o `-=` como reserva, se ele faltar ou falhar.
- Globais antigos `TextEditor`, `FilePicker`, `ImagePopout`, `DocumentOwnershipConfig` e `saveDataToFile`: agora só os de `foundry.applications.*` e `foundry.utils.*`.
- Ganchos de nomes antigos: `renderChatMessage`, `renderSidebarDirectory`, `getJournalDirectoryEntryContext` e `getJournalDirectoryFolderContext` (no v14 valem `renderChatMessageHTML`, `renderDocumentDirectory`, `getJournalEntryContextOptions` e `getFolderContextOptions`, que já estavam registrados).
- Elementos jQuery (`html[0]`) nos ganchos: o v14 entrega HTMLElement.

Manutenção
- Os textos de idioma do journal.js (`T`, `TF`, `traduzirNoLugar`) saíram para `scripts/idioma.js`: é o primeiro passo para tirar partes do journal.js sem passar funções de mão em mão.
- `docDe(uuid)` no lugar de seis cópias de `try { fromUuidSync } catch`.
- Cache das últimas 400 limpezas de HTML (cada leitura de edição normaliza o texto todo; as relacionadas leem todas as edições).
- O editor do jornal e a janela de nova pasta avisam no console, uma vez, quando caem na alternativa (editor simples, pasta sem diálogo).
- Testes: 103 de 103 no Foundry simulado, com e sem o Calendário (15 novos: limpeza de HTML, importação perigosa e estranha, limites, socket, exportação), 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo. A limpeza de HTML e o download também foram verificados no Chromium. Nada disso foi testado num Foundry real.

## 4.8.3

- **Tiradas todas as menções de IA do Jornal**: sai o botão "Copiar modelo para a IA" da janela de importação (e o texto de instruções que ele copiava); as dicas de importação agora falam só do JSON exportado, em português e inglês. A importação continua igual (arquivo ou texto colado, com ou sem ```json em volta).
- A dica do diário de sessão sobre o Transcritor da Mesa também deixou de citar IA.
- Testes: 88 de 88 com e sem o Calendário (saiu o teste do modelo para IA), 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo. O Calendário 4.2.0 continua sem alterações.

## 4.8.2

- **Corrigido: erro ao clicar em Ler um jornal** ("Journal: failed at newspaper (ler)… can't access property style, this[#element] is undefined"). A janela de leitura pedia para vir para a frente logo depois de mandar desenhar; o Foundry desenha sem esperar, e na primeira abertura a janela ainda não existia. Agora só traz para a frente uma janela que já está aberta.
- Testes: o Foundry simulado agora desenha as janelas sem esperar, como o real, e dá esse mesmo erro se alguém trouxer para a frente uma janela que ainda não existe; o teste novo falha na 4.8.1 e passa na 4.8.2. 89 de 89 com e sem o Calendário, 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo.


## 4.8.1

- **Saiu a gravação de voz** do diário de sessão (botão do microfone, selo REC, configurações "Gravação de voz do diário de sessão" e "Onde salvar a gravação"). Grave com a ferramenta que preferir (Discord/Craig, OBS...) e use o **Transcritor da Mesa** (programa à parte, fora do Foundry) para transcrever e apontar os acontecimentos.
- Na janela de encerrar a sessão: **Copiar o registro da sessão** (texto simples do que o Journal anotou: compras, missões, Nexus...) para o campo Contexto do Transcritor; o Resumo aceita colar o diário que o Transcritor copia ("Copiar para o Journal").
- Configurações antigas da gravação ficam guardadas no mundo sem efeito (nada é apagado).
- Testes: 88 de 88 com e sem o Calendário, 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo.


## 4.8.0

### Jornal: editor mais simples
- O editor da edição virou um passo a passo: **Capa → Manchete → Notícias → Rumores → Avisos públicos → Classificados → Final → Prévia**, com o menu à esquerda (com quantas matérias há em cada seção) e uma explicação curta no topo de cada etapa.
- Nas seções, só uma matéria fica aberta; as outras viram cartões com o título e o começo do texto (clique para abrir). Matéria aberta mostra só o essencial: título, texto e "Quem ou o que aparece nesta notícia". Categoria, autor, imagem e mudar de seção ficam em "Mais opções"; veracidade e nota ficam em "Só o mestre vê".
- Etapa **Final** com a lista do que já está pronto; **Prévia** mostra a edição como os jogadores vão ver, inclusive o que ainda não foi salvo.
- Saiu o botão **Ver como jogador** (a Prévia e a janela de leitura cumprem esse papel).

### Jornal: JSON
- **Exportar JSON** de uma edição (botão na edição e no editor) — serve de modelo para as próximas.
- **Nova edição a partir desta**: copia o conteúdo como rascunho com o próximo número.
- **Importar edição** direto no jornal (página do jornal e cartão na aba Jornais): colar o texto ou escolher o arquivo; cria uma edição rascunho para cada edição do JSON. Aceita a resposta de uma IA como vier (com ```json em volta), nomes de seção em português ou inglês, texto simples (parágrafos viram HTML) e vínculos **pelo nome** (NPC, local, ator); nome que não existe ou repetido é avisado.
- **Importar JSON nesta edição** (no editor): troca o conteúdo da edição aberta, sem salvar até você salvar.
- **Copiar modelo para a IA**: copia as instruções, o formato, os nomes dos NPCs, locais, organizações, missões e divindades do mundo e as últimas edições do jornal, prontos para pedir uma edição a uma IA.

### Diário de sessão: gravação de voz
- Botão do **microfone** no rodapé do Journal (mestre): grava o áudio da sessão (.webm Opus, ~30 kb/s, umas 4 horas ≈ 55 MB). Fontes à escolha: microfone do mestre, vozes do áudio e vídeo do Foundry (cada jogador conectado no A/V do Foundry entra na gravação), som de outra aba (ex.: Discord no navegador).
- **Todos são avisados**: mensagem no chat ao começar e ao terminar, e o selo **REC** aparece no Journal dos jogadores enquanto grava. Configuração **"Gravação de voz do diário de sessão"** para desligar o recurso; **"Onde salvar a gravação"**: baixar no computador, enviar ao servidor do Foundry ou os dois.
- Pausar/continuar, relógio no botão. Encerrar a sessão para e salva a gravação; o diário da sessão lista as gravações (com link, se foi ao servidor).
- **Sem perda**: os pedaços vão para o navegador a cada 10 s; se a página fechar no meio, ao voltar o Journal oferece salvar o que foi gravado.
- **Copiar pedido para a IA** (na janela de encerrar a sessão): instruções para transcrever e organizar o diário (resumo, acontecimentos, NPCs, lugares, itens, ganchos, frases), com o registro automático da sessão como guia. A resposta vai no campo Resumo.

### Arquivos
- Novos: `scripts/jornal/json.js`, `scripts/sessao/gravacao.js`.
- Alterados: `scripts/jornal/{editor,visual,index,leitura}.js`, `scripts/journal.js`, `styles/*.css`, `lang/*.json`, `module.json`.

### Testes
- Foundry simulado: 92 de 92 com e sem o Calendário (17 novos: exportar, importar texto de IA, vínculo por nome, várias edições, JSON inválido, nova a partir desta, modelo para IA, 8 etapas, cartões, botão e selo da gravação, pedido para IA), 5 de 5 em inglês, 23 de 23 Nexus/Linha do tempo.
- Chromium com microfone simulado: gravar, pausar, continuar, parar → arquivo .webm baixado, 2 avisos no chat, gravação anexada à sessão; recarregar a página no meio → recuperação oferecida e salva uma vez só.
- Pendente no Foundry real: gravar com as vozes do A/V do Foundry e com o app desktop do Foundry (o app pode não permitir o som de outra aba).


## 4.7.2

### Inglês no módulo inteiro
- Na 4.7.1 só o Jornal de Notícias estava traduzido. Agora todo o Journal segue o idioma do Foundry: lojas, saques, missões, recompensas, divindades, História, Linha do tempo, Nexus, Regras da Mesa, diário de sessão, avisos, janelas e configurações.
- Como: os textos continuam escritos em português no código e passam por `T()`; a chave é um código curto calculado do texto (`JMESA.t…`, o mesmo esquema do Calendário da Mesa). `lang/en.json` e `lang/pt-BR.json` têm ~990 textos cada. As listas fixas (tipos, status, ícones, modelos da sessão 0...) e os nomes/dicas das configurações são traduzidos quando o Foundry carrega o idioma.
- Frases com números foram reescritas inteiras ("in 3 days", "3 days left", "overdue by 2 days") em vez de pedaços.
- Verificação: todas as telas do Journal (cada tipo de página, cada aba da loja e da divindade, modo edição, Linha do tempo, Nexus, Regras da Mesa, Jornais, tela inicial) renderizadas com o Foundry em inglês: nenhuma palavra acentuada sobrou. O que continua em português vem do mundo ou de outro módulo: nomes dos dias e meses do seu calendário, e textos do Calendário da Mesa (que tem a tradução dele).

### Jornal: foto do vínculo na notícia
- Ligar um NPC, local, organização, divindade, loja ou ator com imagem já põe a **foto com o nome** (e o papel do NPC ou o tipo do local) dentro da matéria. A câmera no vínculo liga e desliga a foto. Vínculo sem foto continua como etiqueta.
- O jogador só vê a foto e o nome de quem ele já pode ver no Journal.

### Lojas
- **Dias de folga travados (corrigido)**: com "Respeitar horário e folgas" desligado (o padrão), os dias ficavam com `pointer-events: none`, sem aviso. Agora são sempre clicáveis; marcar uma folga com o horário desligado liga a opção e avisa.
- **Tabelas de itens das lojas** (Configurações do módulo › Escolher tabelas): quais tabelas aparecem nas lojas, tabela padrão do estoque semanal e das ofertas diárias (para as lojas sem tabela própria), e **Criar tabelas prontas** a partir de um compêndio de itens (o do D&D 5e, por exemplo): armas, armaduras e escudos, equipamento de aventura, poções e consumíveis, itens mágicos comuns, incomuns, raros, muito raros e lendários, na pasta "Journal — tabelas das lojas". Os resultados apontam para o compêndio; criar de novo não duplica.

### Arquivos
- Novo: `scripts/lojas/tabelas.js`.
- Alterados: `scripts/journal.js` (textos por `T()`, folga, tabelas padrão), `scripts/jornal/{dados,leitura,editor}.js` (fotos), `styles/journal.css`, `styles/jornal.css`, `lang/*.json`, `module.json`.

### Testes
- Foundry simulado: 75 de 75 com e sem o Calendário (10 novos: fotos, NPC escondido, tabelas prontas, filtro e padrão, folga), 5 de 5 em inglês, 23 de 23 da ligação Nexus/Linha do tempo, varredura de 37 telas em inglês.
- Pendente no Foundry real: criar tabelas prontas com o compêndio de verdade do D&D 5e (os nomes dos campos de raridade e tipo foram conferidos no formato do sistema, mas não num mundo real).


## 4.7.1

Correções e melhorias do Jornal de Notícias. Calendário da Mesa 4.2.0 sem nenhuma alteração.

### Corrigido
- **A janela de edição não rolava.** Causa: o editor usava a classe da janela principal, e `.jm-janela .window-content` tem `overflow: hidden` (a janela principal rola por dentro dos painéis, o editor não tem painel). Medido no Chromium com uma janela de 500 px: 4.222 px de conteúdo presos em 469 px. Agora o conteúdo do editor rola com o mouse, o rodapé com Salvar fica sempre à vista e as caixas de texto longas rolam por dentro.
- **Não dava para vincular matérias.** Causas: (1) a área de vínculos fica no fim de cada matéria, justamente a parte que a falta de rolagem escondia; (2) o único caminho era uma lista dentro da matéria ou arrastar; (3) Enter num campo de texto enviava o formulário (o navegador podia recarregar a página e perder a edição); (4) as Notícias relacionadas só mostravam edições publicadas, então ligar algo num rascunho parecia não ter efeito. Agora: botão **Vincular** com janela de busca por grupos (NPCs, locais, organizações, missões, divindades, lojas, eventos do calendário, outros diários, personagens, atores e itens), vários de uma vez, campo para colar UUID e arrastar e soltar; cada vínculo mostra nome e tipo, abre o documento e pode ser removido; Enter não envia mais nada; o mestre vê nas Notícias relacionadas também os rascunhos e programadas (com o estado); jogador continua vendo só o publicado e só os vínculos que já pode abrir.

### Novo
- **Modo de leitura**: janela própria com a edição como jornal impresso — cabeçalho, faixa da edição, manchete com imagem e capitular, coluna de destaques, Outras notícias, Rumores e Anúncios e avisos; o que não cabe vai para as páginas seguintes, em colunas. Rolagem com o mouse, botões de página e de edição anterior/próxima, "Ler a edição" no aviso do chat, "Apresentar" abre a leitura nos jogadores. A página do jornal no Journal usa a mesma folha (com as marcas do mestre). Folha responsiva por largura da janela (container queries).
- **Idioma**: pasta `lang/` (pt-BR e en). Todos os textos do Jornal de Notícias e os nomes dos temas passam por `game.i18n`; se o módulo for atualizado sem reiniciar o mundo, o Journal carrega o idioma sozinho.

### Mudado
- Tema **"Vitoriano (LOTD)" agora se chama "Tema Vitoriano"** (inglês: Victorian Theme). O id interno continua `lotd`: quem usa o tema não perde nada. Também saiu "(LOTD)" da dica de Caminhos da Divindade.

### Arquivos
- Novos: `scripts/jornal/i18n.js`, `leitura.js`, `leitor.js`, `vinculos.js`, `lang/pt-BR.json`, `lang/en.json`.
- Alterados: `scripts/jornal/editor.js`, `visual.js`, `index.js`, `dados.js`, `publicacao.js`, `styles/jornal.css`, `scripts/journal.js` (temas, textos do jornal na Linha do tempo e na aba), `module.json` (versão e idiomas).

### Testes
- Foundry simulado: 65 de 65 com o Calendário, 65 de 65 sem ele, 5 de 5 com o Foundry em inglês (nenhum texto do jornal em português), 23 de 23 da ligação Nexus/Linha do tempo.
- Chromium: rolagem do editor medida antes e depois; folhas renderizadas nos três estilos e em tela estreita.
- Pendente no Foundry real: o checklist da entrega.


## 4.7.0

### Jornal de Notícias — Imprensa do Mundo
- Novo tipo de página **Jornal** e aba **Jornais e Notícias** (botão do jornal no rodapé). Veja o README.
- Publicações com identidade (nome, subtítulo, lema, logotipo, descrição, região, organização, estilo, cor). Quem lê é a permissão do próprio Diário do jornal.
- Edições com manchete, matérias em quatro seções (notícias, rumores, avisos, classificados), rodapé, imagens, autores fictícios e ligações a NPCs, personagens, locais, organizações, missões e eventos do calendário. Editor em janela própria, com a caixa de texto do Foundry e reordenação das matérias.
- Três estilos visuais sobre os mesmos dados: Clássico Medieval, Gazeta Elegante, Jornal Clandestino.
- Estados rascunho → programada → publicada → arquivada; publicação automática na data (pulos grandes de tempo, mundo fechado, sem duplicar), aviso no chat só para quem pode ler, apresentar aos conectados.
- Veracidade e notas do mestre fora da página publicada; "Ver como jogador".
- "Notícias relacionadas" nas páginas ligadas; edições na Linha do tempo (filtro Jornais, pena para a História); edições no diário de sessão.
- API `api.jornais` (só leitura do que o usuário pode ler).

### Como foi feito
- Código novo em `scripts/jornal/` (dados, redação, publicação, visual, editor, ligação) e `styles/jornal.css`. O `journal.js` ganhou só os pontos de ligação: tipo "jornal", aba, botão do rodapé, ação `jornal`, item na Linha do tempo, "Notícias relacionadas", verificação das programadas no "ready" e na virada do dia, ação de socket `jornalApresentar` e a API.
- Calendário da Mesa 4.2.0 sem nenhuma alteração. O Journal usa o que já usava dele: `api.datas` (hoje, partes, meses, tdDe) pelo objeto `Tempo` do Journal, e o gancho nativo `updateWorldTime` para a virada do dia.
- Nada existente mudou de comportamento: lojas, saques, missões, recompensas, História, Linha do tempo, Nexus, Regras da Mesa, sessões, permissões e configurações seguem iguais. Nenhum dado é migrado.
- Segurança: só o mestre grava (o servidor do Foundry recusa a alteração de página por quem não é dono); não existe pedido de jogador para publicar; a mensagem de apresentar só abre o que quem recebe já pode ler; caminhos de imagem com `javascript:` são descartados; textos curtos são escapados; o HTML rico passa pelo `cleanHTML` do Foundry quando existe.
- Limite conhecido: o Foundry envia todos os dados do mundo a todos os clientes; segredos ficam fora da interface, não do console (README).

### Testes
- Foundry simulado com o Journal e o Calendário 4.2.0 (`teste-jornal.mjs`): 50 de 50, com e sem o Calendário — criação, segredos fora da página e da API, jogadora sem acesso a rascunho, servidor recusando publicação por jogadora, publicar uma vez só, permissão herdada, aviso no chat, estilos, vínculos privados escondidos, relacionadas, apresentar só aos conectados, arquivar, programada com pulo de 40 dias, sem automático avisando uma vez, mundo fechado + 3 verificações simultâneas, mestre não principal, Linha do tempo, painel do mestre e da jogadora, janela principal, editor salvando matéria e segredo, apagar edição levando os segredos, despublicar.
- `teste-ligacao.mjs` (4.6): 23 de 23.
- Pendente no Foundry real: o checklist do README de entrega.

## 4.6.0

Ligação com o Calendário da Mesa atualizada (Calendário 4.2.0 recomendado; com versões antigas tudo continua funcionando como antes).

### Nexus
- **A anomalia voltou a funcionar no padrão do Calendário.** Desde o Calendário 2.10 a anomalia cobrindo uma região inteira vem desligada, e o Nexus só sabia ligar desse jeito: o limiar avisava, mas o clima não mudava. Agora cada Nexus escolhe **onde** a anomalia vale: **na região da anomalia** (padrão; liga o "Usar como região" dela) ou **numa região inteira** (o jeito antigo, que precisa da opção do Calendário). Nexus antigos com região escolhida continuam no jeito antigo.
- Selo **ativa/inativa** e botão para ligar ou desligar a anomalia na hora. Aviso no medidor quando falta a opção do Calendário ou quando a barra de Anomalias está desligada.
- Dois Nexus com a mesma anomalia: ela só desliga quando os dois voltam acima dos limiares.
- **Histórico do medidor**: cada limiar cruzado (caindo ou voltando) fica guardado (até 60) e aparece na Linha do tempo. O diário de sessão também anota a volta.
- Lista de anomalias mostra quais já estão com a região ligada.
- API: `api.nexus.lista()`, `api.nexus.definir(id, valor)`.

### Linha do tempo
- Filtro **Nexus** (e no "Tudo"): limiares cruzados, com a pena para registrar na História.
- **Próximos 30 dias** com os **eventos das luas** (eclipses, luas cheias juntas, noite sem luas) e os **contadores do calendário** que terminam.
- Com **vários calendários**, mostra só os eventos do calendário em uso (como a grade do Calendário).
- O cabeçalho do ano usa o ano do Calendário com a **era** (ex.: "Ano 1023 DR", com o nome da era ao lado).
- Abrir num dia sem nada leva ao dia mais próximo que aparece.
- Redesenha sozinha quando o histórico, os contadores ou as anomalias do Calendário mudam.
- API: `api.linhaDoTempo(td)` (usada pelo botão no painel do dia do Calendário 4.2).

### Preservação
- Nenhuma configuração nova; os Nexus salvos ganham só os campos `onde` e `historico` quando mudam. Formato do Monk's intocado.

### Testes
- Foundry simulado com os dois módulos (`teste-ligacao.mjs`): 23 de 23. Pendente no Foundry: anomalia como região no mapa de verdade, Linha do tempo com eclipses e contadores, dois calendários.

## 4.5.0

- **Pechincha com o Dados em Cena**: com o módulo ativo, a pechincha abre a tela de rolagem só para o jogador e o mestre (Persuasão contra a perícia do vendedor). O jogador escolhe vantagem/desvantagem e clica; o Dados em Cena sorteia no mestre (modo seguro) e o resultado vai para o cartão do chat. Quem não rolar em 5 minutos ganha os botões no cartão.
- **Sem o Dados em Cena**: o jogador clica no cartão do chat; o mestre sorteia com a **ficha** do personagem (bônus, efeitos e vantagens do D&D 5e; antes era d20 + bônus calculado à mão) e o Dice So Nice mostra os dados com as cores do jogador.
- Vendedor com ficha: rolado pela ficha dele; sem ficha: d20 + o bônus configurado na loja.
- Testes (Foundry simulado): 33 de 33, incluindo os dois caminhos da pechincha. Pendente no Foundry: pechincha com o Dados em Cena ativo e com ele desativado.

## 4.4.0

Correções da auditoria da 4.3.0 (IDs do relatório de auditoria), Fixar, Regras da Mesa e abertura de diários sempre no Journal.

### Correções

| ID | Problema original | Correção |
| --- | --- | --- |
| J1 | O mestre executava compras, vendas, saques e notas confiando no `userId` e na ficha enviados pelo cliente. Reproduzido: a Ana comprava usando a ficha do Beto. A rolagem da pechincha vinha pronta do jogador. | `motivoRecusa` confere usuário, dono da ficha, acesso à página, quantidade e o id usado na chave da nota. O mestre rola a pechincha (o jogador escolhe normal/vantagem/desvantagem). Limitação: o Foundry não informa quem enviou a mensagem; forjar o id de outro usuário e usar a ficha dele exige o console. |
| J2 | Pedidos simultâneos rodavam em paralelo: dois jogadores levavam o último item (reproduzido). | Todos os pedidos ao mestre passam por uma fila (`executarPedido`). |
| I2 | `Sessao.registrar` lia e regravava a sessão sem coordenação. | Fila "sessao"; iniciar, descartar e encerrar na mesma fila. |
| I1 | Loja só do Monk's: o Journal mostrava aberta, mas a compra era recusada fora do horário. | `horarioLoja` usa a API do Calendário quando ativo; sem ele, a mesma regra. |
| J3 | Conversão de listas antigas e troca de estoque usavam duas gravações (apagar, depois gravar). | `garantirObjeto` em uma gravação; `substituirMapa` e `gravarJunto` apagam e gravam na mesma atualização (ForcedDeletion no v14, `-=` no v13, com reserva). |
| J4 | Texto da descrição digitado nos últimos 400 ms se perdia quando a janela era redesenhada. | O pendente é gravado antes de redesenhar ou fechar, e o editor novo nasce com ele. |
| J5 | Gravações em laço (moedas, recompensas). | `Actor.updateDocuments` para as fichas, itens criados por ficha em paralelo, página da missão numa gravação. |
| J6 | `analisar()` refeito várias vezes por Diário a cada redesenho. | Cache invalidado por qualquer criação/alteração/exclusão de Diário ou página. |
| J7 | Erros da API do Calendário viravam silenciosamente a regra local. | `avisoUmaVez` registra no console uma vez por sessão. |
| J8 | Duração da sessão com hora fixa de 3.600 s. | Usa minutos por hora e segundos por minuto do calendário. |
| J9 | Ícone vindo do Calendário entrava cru no HTML. | `esc()` e `iconeSeguro`. |
| I4 | Leitura direta do setting `historico` do Calendário. | Usa `api.historico()`/`historicoVisivel()` do Calendário 2.6, com reserva. Nova API: `dia.get()`, `dia.somar(n)`, `renovarEstoques()`, `fixados()`. |
| I5 | O Calendário chamava `renovarEstoques()`, que não existia. | Implementado; só renova com a nova opção "Renovar o estoque das lojas a cada nova semana" (padrão desligado = comportamento antigo). |

### Novo

- **Abrir sempre no Journal**: qualquer abertura da ficha padrão de um diário (notas no mapa, links, macros, outros módulos) abre no Journal, na página certa. "Abrir na ficha padrão" continua abrindo a ficha do Foundry.
- **Fixar**: páginas fixadas por usuário, no topo da lista e sempre abertas como abas.
- **Regras da Mesa (sessão 0)**: tópicos por assunto, propostas e comentários (inclusive anônimos), Concordo/Não concordo, status decidido pelo mestre, tópicos comuns com um clique e Diário "Regras da Mesa" com os combinados.

### Monk's Enhanced Journal

O Journal não contém código do Monk's: ele só lê e grava dados no mesmo formato (`flags["monks-enhanced-journal"]`), para os mundos existentes continuarem funcionando com ou sem o Monk's. Isso é compatibilidade de formato, não cópia. Trocar o formato agora apagaria, na prática, os dados das lojas, missões e conexões já criadas, então ele foi mantido.

### Testes

Feitos (Node 22, Foundry simulado, `teste-jm.mjs`, 26 de 26): validação dos pedidos (6 casos); compra simultânea do último item (um leva, o outro é avisado, uma só cobrança); regra de horário igual à do Calendário; troca de estoque e conversão de lista em uma gravação; Regras da Mesa (propostas simultâneas, anonimato, permissões, votos simultâneos, status, modelos); pechincha ignorando resultado enviado pelo jogador; fixar/desafixar. Os cenários J1 e J2 falham na 4.3.0.

Pendentes (precisam do Foundry): v13 e v14; nota no mapa abrindo no Journal na página certa; ficha de outro módulo continuando na janela dele; editor com outra pessoa editando ao mesmo tempo; entregar recompensa a 4 heróis; Regras da Mesa com 2 jogadores conectados; fixados num segundo computador (escopo "user" do v13).
