-- JÁ APLICADA no Supabase em 2026-10-09.
-- App de tarefas/produção da cozinha (Nove Nove Burgers) | Prefixo: prod_

create table if not exists public.prod_setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.prod_colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor_id uuid references public.prod_setores(id) on delete set null,
  pin text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prod_colab_setor on public.prod_colaboradores(setor_id);

create table if not exists public.prod_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  setor_id uuid references public.prod_setores(id) on delete set null,
  unidade text not null default 'kg',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prod_produtos_setor on public.prod_produtos(setor_id);

create table if not exists public.prod_fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.prod_produtos(id) on delete cascade,
  versao integer not null default 1,
  rendimento numeric not null default 1 check (rendimento > 0),
  unidade_rendimento text not null default 'kg',
  modo_preparo text,
  armazenamento text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_prod_ficha_produto on public.prod_fichas_tecnicas(produto_id);

create table if not exists public.prod_ficha_ingredientes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.prod_fichas_tecnicas(id) on delete cascade,
  nome text not null,
  quantidade numeric not null default 0 check (quantidade >= 0),
  unidade text not null default 'kg',
  ordem integer not null default 1
);
create index if not exists idx_prod_ingr_ficha on public.prod_ficha_ingredientes(ficha_id);
