-- JÁ APLICADA no Supabase em 2026-10-09.

create table if not exists public.prod_modelos_tarefa (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  setor_id uuid references public.prod_setores(id) on delete set null,
  produto_id uuid references public.prod_produtos(id) on delete set null,
  quantidade_padrao numeric check (quantidade_padrao is null or quantidade_padrao >= 0),
  unidade text,
  duracao_estimada_min integer check (duracao_estimada_min is null or duracao_estimada_min >= 0),
  frequencia text not null default 'diaria' check (frequencia in ('diaria','semanal','avulsa')),
  exige_foto boolean not null default false,
  exige_aprovacao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_prod_modelos_setor on public.prod_modelos_tarefa(setor_id);

create table if not exists public.prod_tarefas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references public.prod_modelos_tarefa(id) on delete set null,
  setor_id uuid references public.prod_setores(id) on delete set null,
  colaborador_id uuid references public.prod_colaboradores(id) on delete set null,
  produto_id uuid references public.prod_produtos(id) on delete set null,
  titulo text not null,
  instrucoes text,
  quantidade_planejada numeric check (quantidade_planejada is null or quantidade_planejada >= 0),
  quantidade_realizada numeric check (quantidade_realizada is null or quantidade_realizada >= 0),
  unidade text,
  data_execucao date not null,
  janela_inicio date,
  janela_fim date,
  duracao_estimada_min integer check (duracao_estimada_min is null or duracao_estimada_min >= 0),
  exige_foto boolean not null default false,
  exige_aprovacao boolean not null default false,
  status text not null default 'pendente'
    check (status in ('pendente','em_andamento','aguardando_aprovacao','concluida','reprovada','atrasada')),
  inicio_real timestamptz,
  conclusao_real timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prod_tarefas_data on public.prod_tarefas(data_execucao);
create index if not exists idx_prod_tarefas_colab on public.prod_tarefas(colaborador_id);
create index if not exists idx_prod_tarefas_setor on public.prod_tarefas(setor_id);
create index if not exists idx_prod_tarefas_status on public.prod_tarefas(status);

create table if not exists public.prod_evidencias (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.prod_tarefas(id) on delete cascade,
  colaborador_id uuid references public.prod_colaboradores(id) on delete set null,
  caminho_arquivo text not null,
  tipo text not null default 'foto',
  created_at timestamptz not null default now()
);
create index if not exists idx_prod_evid_tarefa on public.prod_evidencias(tarefa_id);
