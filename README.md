# Journal da Mesa

## Sobre como este módulo foi feito

Sei que parte da comunidade não gosta de módulos produzidos com IA, então prefiro ser transparente: este foi desenvolvido com ajuda de IA. Não sou programador.

Tudo começou quando um amigo me disse: “cara, ficou muito mais simples, é só fazer uma macro do que você quer”. Fiz a macro para a minha mesa, fui adaptando conforme a necessidade dos jogos e, no fim, ela virou um módulo. Uso nas minhas próprias sessões e resolvi compartilhar caso seja útil para mais alguém.

Se encontrar bugs ou tiver sugestões, abra uma [issue](https://github.com/Daphenius/journal-mesa/issues). Todo retorno é bem-vindo.

---

**Versão 5.4.6** · Foundry VTT 14 (mínimo; verificado no 14.369) · D&D 5e 5.0 a 6.0.6 · Português e English · Licença MIT · ✅ Testado no Foundry VTT e D&D 5e

Toda versão é testada pelo autor dentro do Foundry VTT, com o D&D 5e, antes de ser publicada. Mesmo assim, faça backup do mundo antes de atualizar.

## Instalação

1. No Foundry, vá em **Módulos Complementares → Instalar Módulo**.
2. Em **URL do Manifesto**, cole `https://github.com/Daphenius/journal-mesa/releases/latest/download/module.json` e clique em **Instalar**.
3. Entre no mundo e ative **Journal da Mesa** em *Gerenciar Módulos*.

Instalado assim, o Foundry avisa quando houver versão nova. À mão: baixe `journal-mesa.zip` na [página de releases](https://github.com/Daphenius/journal-mesa/releases) e extraia em `Data/modules/journal-mesa`. Os diários ficam no mundo, não na pasta do módulo: atualizar ou desativar não apaga nada.

## O que o módulo faz

![Journal da Mesa no Foundry VTT: página de divindade](docs/screenshot.png)

Uma **janela única com abas** para tudo o que o mestre anota sobre o mundo: NPCs, locais, organizações, lojas, missões, divindades, baús, História, Regras da Mesa e jornais. Tudo é Diário nativo do Foundry, nas pastas comuns, com os dados extras em `flags["journal-mesa"]`. É uma alternativa mais simples ao Monk's Enhanced Journal, com um importador que converte os diários dele sem apagar nada (projeto independente, sem relação com o Monk's ou seu autor).

| Jornal do Dia | Loja | Regras da Mesa |
|---|---|---|
| [![Jornal de Notícias: edição aberta na janela de jornal](docs/jornal.png)](docs/jornal.png) | [![Loja com estoque, preços e pechincha](docs/loja.png)](docs/loja.png) | [![Regras da Mesa: tópicos da sessão 0](docs/regras-da-mesa.png)](docs/regras-da-mesa.png) |

**Organização.** Pastas nativas com as cores que você já usa; arraste para ordenar. **Ocultar pasta** (olho riscado) tira a pasta da lista e da aba de Diários sem apagar (volta por *Ocultos*, no rodapé). **Fixar** (alfinete) deixa a página no topo da lista e sempre aberta como aba; cada usuário tem os seus. **Nota do mestre**: lembrete por página, só para o mestre. Botão direito: renomear, quem vê, duplicar, exportar/importar JSON, configurar pasta, apagar.

**Quem vê.** O olho abre a janela *Quem vê* (nível para todos e por jogador). **Limitado** mostra a página sem as caixas de texto, e cada caixa tem o próprio olho para **revelar por partes**. **Bolinhas** com a inicial de quem tem acesso aparecem no Journal e na barra lateral. O **megafone** abre a página na tela dos jogadores que podem vê-la; o botão direito numa imagem mostra só a imagem.

**Links e fichas.** Links `@UUID[...]` abrem no Journal da Mesa, na aba certa. Com "Abrir diários sempre no Journal da Mesa" ligado, qualquer abertura (barra lateral, notas no mapa, macros, outros módulos) vai para o Journal, se o diário usar a ficha padrão ou a ficha "Journal da Mesa"; diários com ficha de outro módulo (Heavy Lore, Monk's...) abrem nela. Páginas PDF abrem no leitor do Foundry com barra de busca.

**Importar.** *Importar JSON* aceita diários exportados pelo Foundry, pelo Monk's ou pelo Journal da Mesa (pasta inteira) e itens. O botão de **quebra-cabeça** converte os diários do Monk's Enhanced Journal para o formato próprio: só copia (flags do Monk's intactas, mesmos IDs, vínculos mantidos) e mostra um relatório no fim. Páginas *Imagem* do Monk's não são convertidas: crie uma página de Imagem apontando para o mesmo arquivo.

## Tipos de página

Criados pelo botão **Nova página** (ou pela API). NPC, Local, Organização, Loja, Missão, Baú e Anotação têm descrição, imagem, **conexões** entre páginas (arraste uma sobre a outra), ator ligado, notas pessoais de cada jogador, a seção **Calendário** (data, repetição, ícone, cor, aviso no chat) e as **notícias relacionadas** dos jornais.

- **NPC** — pessoa do mundo; o ator ligado é a ficha que uma loja usa como vendedor.
- **Local** — cidades, reinos, masmorras, com conexões para quem vive ou manda ali.
- **Organização** — guildas, igrejas, facções e seus membros.
- **Loja** — **estoque da semana** (rolado de uma tabela) e **oferta do dia** por jogador (Achado, Raridade ou Escambo, com preço sorteado). Compra com quantidade; a aba **Vender** mostra o inventário do jogador e a loja paga 65% do valor (o item entra no estoque). **Pechincha** (aperto de mão): Persuasão do jogador contra Persuasão, Intuição ou Enganação do vendedor (ficha do NPC dono ou bônus fixo), uma tentativa por item por dia; as porcentagens de cada resultado ficam em *Configurar* (padrão compra −35/−10/0/+10/+35%; venda 100/75/65/55/40%). **Horário** de abertura, fechamento e folgas: fechada, ninguém compra nem vende. O mestre muda o estoque direto na lista. Compra e venda são desfeitas se algo falhar no meio (o item volta, as moedas voltam, o estoque fica como estava); se nem o desfazer der certo, o mestre recebe um aviso dizendo o que ficou pela metade para acertar à mão. Vender só vale com pelo menos uma unidade na ficha (quantidade zero não conta como uma).
- **Missão** — objetivos, status, **prazo** em dias (vencido, o mestre pode marcar como falha) e **recompensas** (XP, moedas, itens, talentos ou magias arrastados); **Entregar** escolhe quem recebe o quê; um grupo já entregue não é entregue de novo (o XP e as moedas não dobram) — para repetir de propósito, **Reabrir entrega**. Itens deixados na missão continuam com o botão **Pegar** para os jogadores. As missões em andamento aparecem no **rastreador** flutuante.
- **Divindade** — abas *Visão geral* (panteão, domínios, símbolos, mitos), *Fé e clero* (dogmas, tabus, ritos, **dias sagrados** repetidos no calendário) e *Poder e relíquias* (dádivas, castigos, Caminhos e Sequências, relíquias arrastáveis).
- **Baú** — itens e moedas para os jogadores **pegarem**; o mestre pode **dividir as moedas**. Ao encerrar um combate, o módulo oferece criar o baú com o saque dos derrotados (pasta *Saques*, oculto).
- **Anotação** — página livre com os mesmos recursos.
- **História** — acontecimentos do mundo em ordem cronológica, separados por ano (botão para inverter), cada um com data, ícone e cor; todos aparecem na Linha do tempo. Pode haver mais de uma História.
- **Diário de sessão** — botão do livro no rodapé (mestre). Registra compras, vendas, saques, recompensas, missões, prazos, combates, dias que passaram, edições publicadas e limiares dos Nexus; ao encerrar, cria um diário na pasta *Sessões* com tudo por assunto, o seu resumo e, se quiser, um acontecimento na História. *Copiar o registro da sessão* leva o texto para o Transcritor da Mesa (programa à parte).
- **Jornal** — uma publicação do mundo (nome, lema, logotipo, região, organização, três estilos visuais) com **edições**: manchete, Notícias, Rumores, Avisos e Classificados, cada matéria com texto, imagem, autor fictício e **vínculos** com NPCs, locais, organizações, missões, atores ou itens. Estados: Rascunho, **Programada** (publicada quando o dia chega: o cliente do mestre principal confere as edições vencidas ao entrar no mundo e a cada virada de dia — não há publicação em segundo plano com o mundo fechado; se o dia passou enquanto o mundo estava fechado, a edição sai assim que o mestre voltar), Publicada (lida na **janela de jornal** paginada) e Arquivada. Publicar avisa no chat e pode abrir a edição na tela dos jogadores. O mestre marca a **veracidade** de cada matéria e notas que os jogadores nunca veem (*Ver como jogador* confere). Exportar/importar edições em JSON (até 2 MB, 50 edições, 60 matérias; HTML limpo antes de ir para a tela). A aba **Jornais e Notícias** (rodapé) lista todos, com busca e filtros.
- **Regras da Mesa** (aperto de mão no rodapé) — sessão 0 em tópicos. Todos propõem, comentam e marcam *Concordo / Não concordo*, inclusive de forma **anônima** (nem o mestre vê quem foi). O mestre muda o status, adiciona os tópicos comuns com um clique e **Gerar diário** cria o Diário "Regras da Mesa" só com o combinado.
- **Nexus** (aba opcional) — medidor de 0 a 100% por Nexus, com **limiares** que avisam o mestre ao serem cruzados para baixo. Com o Calendário da Mesa, um limiar pode ligar uma **anomalia no clima**; ao subir de volta, ela desliga.
- **Linha do tempo** (rodapé) — o que já aconteceu, por dia e ano (História, eventos, missões concluídas, sessões, Nexus, edições, histórico do calendário) e os **próximos 30 dias** (eventos, prazos, luas, contadores), com filtros. A **pena** registra um item na História; o **+** de cada dia cria um acontecimento.

Também dá para criar direto páginas nativas de **Imagem**, **PDF**, **Regra** e **Evento do calendário**, e um **Diário** comum do Foundry (texto, imagem, PDF, vídeo e os tipos do D&D 5e).

## Integrações

Só o que tem código específico no módulo. Nenhuma é obrigatória.

- **Calendário da Mesa** (4.2 ou mais novo) — meses, dias da semana e eras vêm dele; o **histórico da campanha** entra na Linha do tempo e no diário de sessão; **horário e folgas das lojas** seguem o relógio dele e aparecem no painel do calendário, que também ganha o botão **Linha do tempo**; na virada do dia ele avança o dia das ofertas e na virada da semana pode **renovar o estoque** das lojas; os Nexus ligam **anomalias do clima**. Sem ele, vale o calendário nativo do Foundry; sem calendário nenhum, as datas viram texto e edições não podem ser programadas.
- **Dados em Cena** — na pechincha, a tela de rolagem abre para o jogador (e para o mestre, com o vendedor): ele escolhe vantagem ou desvantagem e clica no d20. Sem o módulo, o jogador clica no cartão do chat.
- **Item Piles** — no Baú aparece **Colocar no mapa**: cria uma pilha na cena com tudo o que está no baú.
- **Translate All** — o botão de idioma nas páginas abre a página nativa, onde fica o botão do Translate All; a tradução é gravada no texto e o Journal mostra na hora.

## Configurações

Em *Configurar Módulos → Journal da Mesa*:

Por usuário: **Tema** (Claro, Vitoriano, Noite), **Mostrar rastreador de missões**, **Abrir diários sempre no Journal da Mesa**, **Editor de descrição** (Foundry ou caixa simples, se o editor não deixar digitar) e **Mostrar quem vê cada documento** (bolinhas).

Do mundo: **Onde colocar páginas novas** (fim ou início da pasta), **Pechincha interativa no chat** (desligada, rola tudo de uma vez), **Perguntar sobre o baú de saque ao fim do combate**, **Medidor dos Nexus** e **Jogadores veem os Nexus**, **Renovar o estoque das lojas a cada nova semana** (com o Calendário da Mesa), **Diário de sessão automático**, **Jornais na Linha do tempo** e o botão **Tabelas de itens das lojas**: cria tabelas prontas a partir de um compêndio (armas, armaduras, equipamento, poções, itens mágicos por raridade), define as tabelas padrão do estoque semanal e das ofertas e escolhe quais aparecem nas lojas.

## API para macros

Tudo fica em `game.modules.get("journal-mesa").api` (depois do `ready`). Leituras devolvem só o que quem chama pode ver; gravações só funcionam no mestre. Código e documentação de cada chamada: `scripts/api.js` e `scripts/jornal/index.js` (`jornais`). O Calendário da Mesa usa `abrir`, `dia.somar`, `renovarEstoques` e `linhaDoTempo`.

| Chamada | Parâmetros | Devolve |
|---|---|---|
| `api.abrir(id?)` | `id`: ID do diário (opcional) | A janela, no diário se ele existir. |
| `api.criarPagina(tipo, pastaId?)` | `tipo`: `person`, `place`, `organization`, `shop`, `quest`, `deus`, `loot`, `journalentry`, `historia`, `jornal`, `diario`, `evento`, `regra`, `imagem`, `pdf`; `pastaId`: ID da pasta | `Promise<{ entry, editar }>` ou `null` se cancelado. |
| `api.bauDoCombate(combat)` | `combat`: ex. `game.combat` (mestre) | `Promise` do Baú criado. |
| `api.importarJson(pastaId?)` | pasta de destino | `Promise<void>`; abre o seletor de arquivo. |
| `api.importarDoMonks({ entradas?, silencioso? })` | `entradas`: diários (`null` = todos); `silencioso`: sem janela | `Promise` do relatório `{ convertidas, porTipo, limitadas, puladas, vinculosQuebrados, falhas }`. |
| `api.dia.get()` | — | Dia atual das ofertas (inteiro, começa em 1). |
| `api.dia.somar(n)` | `n`: dias (pode ser negativo; mestre) | `Promise<number>` com o dia novo. |
| `api.renovarEstoques()` | — (mestre principal, com a opção ligada) | `Promise<boolean>`: `true` se renovou alguma loja. |
| `api.fixados()` | — | IDs dos diários fixados por este usuário. |
| `api.linhaDoTempo(td?)` | `td`: dia do calendário (opcional) | A janela, na Linha do tempo. |
| `api.nexus.lista()` | — | Cópia dos Nexus: `{ id, nome, valor, visivel, icone, cor, zona, anomalia, limiares }`. |
| `api.nexus.definir(id, valor)` | `id` do Nexus; `valor` 0–100 (mestre) | `Promise<void>`; dispara os limiares cruzados. |
| `api.jornais.lista()` | — | Jornais que o usuário pode ler: `{ id, uuid, nome, subtitulo, regiao, estilo }`. |
| `api.jornais.edicoes(id)` | `id` do jornal | Edições que o usuário pode ler: `{ id, uuid, numero, estado, data, td, titulo, materias }`. |
| `api.jornais.abrir(id, pageId?)` | jornal e edição | A janela do Journal na página do jornal. |
| `api.jornais.ler(id, pageId)` | jornal e edição | A janela de jornal (folha impressa) ou `null` sem permissão. |
| `api.jornais.verificarProgramadas()` | — (mestre principal) | `Promise<number>`: quantas edições programadas foram publicadas agora. |
| `api.jornais.secoes()` | — | `{ noticia, rumor, aviso, classificado }` com os rótulos no idioma atual. |

Exemplos de macro:

```js
const api = game.modules.get("journal-mesa").api;
// Abrir uma loja pelo nome e avançar um dia (as ofertas do dia mudam)
api.abrir(game.journal.getName("Taverna do Javali")?.id);
await api.dia.somar(1);
// Criar uma missão numa pasta e abri-la
const r = await api.criarPagina("quest", game.folders.getName("Missões")?.id ?? null);
if (r) api.abrir(r.entry.id);
// Baixar 10% de todos os Nexus (dispara os limiares cruzados)
for (const nx of api.nexus.lista()) await api.nexus.definir(nx.id, nx.valor - 10);
// Ler a última edição publicada do primeiro jornal
const j = api.jornais.lista()[0], ed = api.jornais.edicoes(j.id).filter((e) => e.estado === "publicado").at(-1);
if (ed) api.jornais.ler(j.id, ed.id);
```

## Limitações e privacidade

- **O Foundry envia o mundo inteiro a todos os jogadores.** Documentos (inclusive diários com permissão "Nada" e as flags de qualquer página) e configurações de mundo chegam ao navegador de todos; a permissão só esconde da interface. Um jogador que abra o console (F12) lê qualquer dado escondido, de qualquer módulo. O Journal da Mesa garante que nada disso aparece na janela, na ficha, no chat, na Linha do tempo ou na API; não consegue impedir o console.
- **Segredos do Jornal.** A veracidade das matérias e as notas do mestre ficam na configuração de mundo `journal-mesa.jornalSegredos` (nunca na página da edição). Um jogador consegue lê-la no console com `game.settings.get("journal-mesa", "jornalSegredos")`. Mover para uma flag do diário não mudaria nada (flags também chegam a todos); só um compêndio com permissão restrita resolveria, e isso ainda não foi confirmado no Foundry 14 (`docs/AUDITORIA.md`, item 3). Trate a veracidade como "escondido da tela", não como sigilo.
- **Regras da Mesa anônimas**: o módulo não grava quem propôs ou comentou; nem pelo console dá para saber.
- **Pechincha e pedidos**: o d20 é sorteado no computador do mestre, e todo pedido de compra, venda ou saque é conferido por ele (o ator precisa pertencer a quem pede). Para comprar, vender ou pegar, o jogador precisa de um personagem (ou token selecionado) e o **mestre precisa estar online**.
- Tipos exclusivos do Monk's (Encontro, Ponto de interesse, Evento, Imagem, Lista, Apresentação) abrem com edição limitada: nome, imagem e descrição. Com o Monk's ativo ao mesmo tempo, cada módulo guarda os próprios dados; deixe só um ativo.

## Traduzir o módulo

Os textos ficam em `lang/pt-BR.json` e `lang/en.json`, sob `JMESA`, agrupados por área (`Janela`, `Pechincha`, `Jornal`...) com nomes legíveis (`"Fechar": "Close"`). Para melhorar o inglês, edite `lang/en.json`; para outro idioma, copie `en.json`, traduza os valores mantendo os `{campos}` e inclua o arquivo em `languages` no `module.json`. No código cada texto é `T("Janela.Fechar")`; texto novo entra como `T("Texto em português")` e `node tools/i18n-migrar.mjs` dá a chave a ele nos dois arquivos. `node tests/i18n.test.mjs` confere que os dois idiomas batem.

## Estrutura do código

`scripts/journal.js` é a porta de entrada e carrega o resto:

- `nucleo.js` — dados, permissões, ações do mestre, configurações e inicialização; `api.js` — a API pública, montada no `ready`;
- `partes/` — `janela.js` (a janela: abas, lista, busca, cabeçalho, rodapé, menus, arrastar), `calendario.js` (Calendário da Mesa, datas, horário das lojas), `historia.js` (História e Linha do tempo), `pechincha.js`, `sessao.js` (diário de sessão, Nexus, rastreador), `tempo.js`, `barra.js` (barra lateral nativa), `versao.js`;
- `paginas/` — **um arquivo por tipo de página** (`npc.js`, `loja.js`, `missao.js`, `divindade.js`...) e os painéis `linha-do-tempo.js`, `nexus.js` e `regras.js`; cada um exporta o HTML, as ações, os ouvintes, o que aceita arrastado e os seletores de data. `index.js` registra tudo; `comum.js`, `conexoes.js`, `calendario.js` e `estoque.js` são compartilhados;
- `jornal/` — Jornal de Notícias; `lojas/tabelas.js` — tabelas das lojas; `idioma.js` — `T("Area.Chave")` lê `lang/`.

Fora de `scripts/`: `docs/` (imagens e `AUDITORIA.md`, a auditoria de segurança), `.github/workflows/release.yml` (monta e anexa o ZIP na release), `tests/` (Foundry simulado em Node; `npm test` roda `formato.test.mjs`, `pedidos.test.mjs` e `i18n.test.mjs`) e `tools/i18n-migrar.mjs` (chaves de idioma). `tests/` e `tools/` não vão no ZIP. Um erro no console (F12) mostra em qual arquivo aconteceu.

## Contribuir

Abra uma [issue](https://github.com/Daphenius/journal-mesa/issues) com: versões do Foundry, do D&D 5e e do módulo; outros módulos envolvidos; passo a passo; o que esperava e o que aconteceu; a mensagem do console (F12), se houver. Pull requests são bem-vindos; rode `npm test` antes.

## Licença

**Licença MIT** (veja [`LICENSE`](LICENSE)). Copyright © 2026 Daphenius. Idealizado e desenvolvido por Daphenius, com auxílio de Claude e ChatGPT no código; as funcionalidades, as decisões e os testes no Foundry VTT são do autor. Monk's Enhanced Journal, Item Piles, Translate All, Heavy Lore e Ownership Viewer são módulos de seus respectivos autores, citados só para explicar a compatibilidade.

---

## English summary

**Journal da Mesa** is a single-window journal for Foundry VTT 14 and D&D 5e: NPCs, locations, organizations, shops (weekly stock, daily offers, selling, haggling, opening hours), quests with rewards and deadlines, deities, loot chests, a world History on a timeline, a session log, Table Rules (session 0), optional Nexus meters and in-world newspapers with scheduled issues. Everything is stored as native Foundry journals; the built-in importer converts Monk's Enhanced Journal entries by copying (originals untouched). Optional integrations: Calendário da Mesa, Dados em Cena, Item Piles and Translate All. Macro API in `game.modules.get("journal-mesa").api` (table above). Every release is tested by the author in Foundry VTT with D&D 5e. Manifest URL: `https://github.com/Daphenius/journal-mesa/releases/latest/download/module.json`. Portuguese and English. [Issues](https://github.com/Daphenius/journal-mesa/issues). MIT license.

**How this module was made:** I know part of the community doesn't like AI-made modules, so I'd rather be transparent: this one was developed with the help of AI. I'm not a programmer. It started as a macro for my own table, grew as our games needed more, and ended up as a module. I use it in my own sessions and decided to share it in case it's useful to someone else. If you find bugs or have suggestions, please open an issue. All feedback is welcome.
