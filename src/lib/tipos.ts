export type StatusTarefa =
  | "pendente"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "concluida"
  | "reprovada"
  | "atrasada";

export const ROTULO_STATUS: Record<StatusTarefa, string> = {
  pendente: "A fazer",
  em_andamento: "Fazendo",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Feita",
  reprovada: "Refazer",
  atrasada: "Atrasada",
};

export interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Colaborador {
  id: string;
  nome: string;
  setor_id: string | null;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  setor_id: string | null;
  unidade: string;
  ativo: boolean;
}

export interface ModeloTarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  setor_id: string | null;
  produto_id: string | null;
  colaborador_padrao_id: string | null;
  quantidade_padrao: number | null;
  unidade: string | null;
  duracao_estimada_min: number | null;
  frequencia: "diaria" | "semanal" | "avulsa";
  dias_semana: number[];
  prazo_dias: number;
  exige_foto: boolean;
  exige_aprovacao: boolean;
  ordem: number;
  ativo: boolean;
}

export interface Tarefa {
  id: string;
  modelo_id: string | null;
  setor_id: string | null;
  colaborador_id: string | null;
  produto_id: string | null;
  titulo: string;
  instrucoes: string | null;
  quantidade_planejada: number | null;
  quantidade_realizada: number | null;
  unidade: string | null;
  data_execucao: string;
  janela_inicio: string | null;
  janela_fim: string | null;
  duracao_estimada_min: number | null;
  exige_foto: boolean;
  exige_aprovacao: boolean;
  status: StatusTarefa;
  inicio_real: string | null;
  conclusao_real: string | null;
  observacoes: string | null;
  motivo_reprovacao: string | null;
  ordem: number;
}

/** Tarefa como o tablet recebe (função prod_cozinha_tarefas). */
export interface TarefaCozinha extends Pick<
  Tarefa,
  | "id"
  | "titulo"
  | "instrucoes"
  | "quantidade_planejada"
  | "quantidade_realizada"
  | "unidade"
  | "data_execucao"
  | "janela_inicio"
  | "janela_fim"
  | "duracao_estimada_min"
  | "exige_foto"
  | "exige_aprovacao"
  | "status"
  | "motivo_reprovacao"
  | "produto_id"
> {
  produto_nome: string | null;
  atrasada: boolean;
  semanal: boolean;
  tem_ficha: boolean;
}

export interface EquipeCozinha {
  id: string;
  nome: string;
  colaboradores: { id: string; nome: string; pendentes: number }[];
}

export interface MetaEstoque {
  id: string;
  produto_id: string;
  meta: number;
  ciclo: "semanal" | "quinzenal";
  dia_producao: number;
  semana_base: string;
  responsavel_id: string | null;
  duracao_estimada_min: number | null;
  ordem: number;
  ativo: boolean;
}

export interface ItemContagem {
  produto_id: string;
  produto: string;
  unidade: string;
  meta: number;
  ciclo: "semanal" | "quinzenal";
  produz_semana: boolean;
  quantidade: number | null;
  a_produzir: number | null;
  setor: string | null;
}

export interface ContagemSemana {
  semana: string;
  status: "nova" | "rascunho" | "confirmada";
  confirmada_em: string | null;
  contado_por: string | null;
  itens: ItemContagem[];
}

export interface FichaCozinha {
  produto: string;
  versao: number;
  rendimento: number;
  unidade_rendimento: string;
  modo_preparo: string | null;
  armazenamento: string | null;
  ingredientes: { nome: string; quantidade: number; unidade: string }[];
}
