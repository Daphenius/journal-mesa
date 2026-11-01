/* Journal da Mesa — API pública para macros e outros módulos.
 *
 * Fica em game.modules.get("journal-mesa").api, montada no "ready" pelo núcleo (nucleo.js). Este
 * arquivo só organiza e documenta: a lógica continua nos arquivos de origem (nucleo.js, partes/,
 * jornal/), que entram aqui pelo objeto `dep`. O README ("API para macros") descreve cada chamada.
 *
 * Regra geral: tudo respeita quem chama. Leituras devolvem só o que o usuário pode ver; gravações
 * (dia, estoques, Nexus) só funcionam no mestre e devolvem sem fazer nada para os jogadores.
 *
 * Quem usa de fora: o Calendário da Mesa chama abrir(), dia.somar(), renovarEstoques() e
 * linhaDoTempo(td); o Dados em Cena é chamado PELO Journal (pechincha), não o contrário. */

/**
 * @typedef {object} NexusMedidor
 * @property {string} id        Identificador do Nexus (gerado ao criar).
 * @property {string} nome      Nome mostrado no medidor.
 * @property {number} valor     Valor atual, de 0 a 100.
 * @property {boolean} visivel  Se os jogadores veem este medidor (com "Jogadores veem os Nexus" ligado).
 * @property {string} icone     Classe do ícone (ex.: "fa-droplet").
 * @property {string} cor       Cor do medidor (hex).
 * @property {string} zona      Zona do clima do Calendário da Mesa (quando a anomalia vale numa zona).
 * @property {string} anomalia  Anomalia do clima ligada ao Nexus ("" = nenhuma).
 * @property {Array<{v: number, anomalia?: boolean, disparado?: boolean}>} limiares  Limiares (valor em %).
 */

/**
 * Monta o objeto da API a partir das funções do núcleo. Chamado uma vez, no "ready".
 * @param {object} dep  Funções do núcleo (ver nucleo.js, Hooks.once("ready")).
 * @returns {object}    O objeto que vai em game.modules.get("journal-mesa").api.
 */
export function montarApi(dep) {
  const { MOD, ehGM, diaAtual, abrirJournal, criarBauDoCombate, importarJson, importarDoMonks, criarTipo, renovarEstoques, fixados, obterJanela, Nexus, apiJornais } = dep;
  return {
    /**
     * Abre a janela do Journal da Mesa. Com `id`, abre o Diário nesse id numa aba (se existir no mundo).
     * @param {string} [id]  ID do JournalEntry (game.journal). Sem id, só abre/mostra a janela.
     * @returns {JournalApp}  A janela do Journal.
     * @example game.modules.get("journal-mesa").api.abrir();
     * @example game.modules.get("journal-mesa").api.abrir(game.journal.getName("Taverna do Javali").id);
     */
    abrir: abrirJournal,

    /**
     * Cria um Baú de saque com os itens e moedas dos inimigos derrotados de um combate (mestre).
     * O baú vai para a pasta "Saques", oculto. Sem derrotados, só avisa.
     * @param {Combat} combat  O combate (ex.: game.combat).
     * @returns {Promise<JournalEntry|void>}
     * @example await game.modules.get("journal-mesa").api.bauDoCombate(game.combat);
     */
    bauDoCombate: criarBauDoCombate,

    /**
     * Abre a janela de escolher arquivo e importa um JSON (diários do Foundry, do Monk's ou do
     * Journal da Mesa — pasta inteira inclusive — e itens, que vão para a aba Itens).
     * @param {string|null} [pastaId]  Pasta de destino (ID de Folder); null = raiz.
     * @returns {Promise<void>}
     * @example await game.modules.get("journal-mesa").api.importarJson();
     */
    importarJson,

    /**
     * Converte diários no formato do Monk's Enhanced Journal para o formato próprio (só copia; as
     * flags do Monk's ficam). Sem argumentos, percorre todos os diários do mundo.
     * @param {object} [opcoes]
     * @param {JournalEntry[]|null} [opcoes.entradas=null]  Só estes diários (null = todos).
     * @param {boolean} [opcoes.silencioso=false]  true = sem a janela do relatório no fim.
     * @returns {Promise<{convertidas: Array, porTipo: object, limitadas: Array, puladas: number, vinculosQuebrados: Array, falhas: Array}>}
     * @example const rel = await game.modules.get("journal-mesa").api.importarDoMonks({ silencioso: true }); console.log(rel.porTipo);
     */
    importarDoMonks,

    /**
     * Cria uma página nova de um tipo do Journal da Mesa (o mesmo que o botão "Nova página").
     * Tipos: "person" (NPC), "place" (Local), "organization", "shop" (Loja), "quest" (Missão),
     * "deus" (Divindade), "loot" (Baú), "journalentry" (Anotação), "historia", "jornal", "diario",
     * "evento" (precisa de calendário), "regra", "imagem" e "pdf" (os dois abrem o seletor de arquivo).
     * @param {string} tipo  Um dos tipos acima.
     * @param {string|null} [pastaId=null]  Pasta de destino (ID de Folder); null = raiz.
     * @returns {Promise<{entry: JournalEntry, editar: boolean}|null>}  null se o tipo não existir ou o usuário cancelar.
     * @example const r = await game.modules.get("journal-mesa").api.criarPagina("shop"); game.modules.get("journal-mesa").api.abrir(r.entry.id);
     */
    criarPagina: criarTipo,

    /** Dia do mundo das ofertas diárias e da pechincha ("uma tentativa por item por dia"). O Calendário da Mesa usa `somar` na virada do dia. */
    dia: {
      /**
       * Dia atual do Journal (número inteiro, começa em 1).
       * @returns {number}
       * @example game.modules.get("journal-mesa").api.dia.get();
       */
      get: () => diaAtual(),
      /**
       * Soma `n` dias (pode ser negativo; nunca fica abaixo de 1). Só o mestre; para jogadores devolve o dia atual sem mudar.
       * @param {number} n  Dias a somar.
       * @returns {Promise<number>}  O dia depois da soma.
       * @example await game.modules.get("journal-mesa").api.dia.somar(1);
       */
      somar: async (n) => { if (!ehGM()) return diaAtual(); const v = Math.max(1, diaAtual() + Math.trunc(Number(n) || 0)); await game.settings.set(MOD, "dia", v); return v; }
    },

    /**
     * Renova o estoque de todas as lojas que têm tabela de estoque semanal — só no mestre principal e
     * só com "Renovar o estoque das lojas a cada nova semana" ligado. O Calendário da Mesa chama na virada da semana.
     * @returns {Promise<boolean>}  true se renovou alguma loja (o Calendário então não manda o lembrete).
     * @example if (!(await game.modules.get("journal-mesa").api.renovarEstoques())) ui.notifications.info("Nada para renovar.");
     */
    renovarEstoques,

    /**
     * IDs dos diários que este usuário fixou (cada usuário tem os seus).
     * @returns {string[]}
     * @example game.modules.get("journal-mesa").api.fixados().map((id) => game.journal.get(id)?.name);
     */
    fixados: () => [...fixados()],

    /** Jornal de Notícias: só o que o usuário pode ler (sem veracidade, notas do mestre ou rascunhos de outros). Ver jornal/index.js (apiJornais). */
    jornais: apiJornais,

    /**
     * Abre a Linha do tempo na janela do Journal, rolando até o dia `td` se vier (o Calendário da Mesa 4.2+ usa no painel do dia).
     * @param {number|null} [td=null]  Dia do calendário (contagem de dias do Calendário da Mesa / Foundry); null = hoje.
     * @returns {JournalApp}
     * @example game.modules.get("journal-mesa").api.linhaDoTempo();
     */
    linhaDoTempo: (td = null) => { const j = obterJanela(); j.abrirLinha(td); return j; },

    /** Medidores dos Nexus (precisa de "Medidor dos Nexus" ligado nas configurações). */
    nexus: {
      /**
       * Cópia da lista de Nexus (mudar o resultado não altera nada). Vazia com o medidor desligado.
       * @returns {NexusMedidor[]}
       * @example game.modules.get("journal-mesa").api.nexus.lista().forEach((n) => console.log(n.nome, n.valor));
       */
      lista: () => (Nexus.ligado() ? Nexus.lista() : []),
      /**
       * Muda o valor de um Nexus (0 a 100; arredonda e limita). Só o mestre. Dispara os limiares
       * cruzados para baixo (aviso, anomalia do clima, histórico) e rearma os que voltam a subir.
       * @param {string} id  ID do Nexus (ver `lista()`).
       * @param {number} valor  Novo valor em %.
       * @returns {Promise<void>}
       * @example const nx = game.modules.get("journal-mesa").api.nexus.lista()[0]; await game.modules.get("journal-mesa").api.nexus.definir(nx.id, nx.valor - 10);
       */
      definir: (id, valor) => Nexus.definir(id, valor)
    }
  };
}
