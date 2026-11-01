/* Journal — página de Anotação (tipo "journalentry"): texto livre, com as seções comuns. */
import { T } from "../idioma.js";

export default {
  tipo: "journalentry",
  tituloDescricao: () => T("Janela.Anotacao"),
  html() { return ""; }
};
