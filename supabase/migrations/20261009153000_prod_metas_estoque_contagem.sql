-- Metas de estoque (semanal / quinzenal) + contagem semanal que gera as tarefas de produção.
-- Produção = meta − quantidade contada (nunca negativa).

create table public.prod_metas_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null unique references public.prod_produtos(id) on delete cascade,
  meta numeric not null check (meta > 0),
  ciclo text not null default 'semanal' check (ciclo in ('semanal','quinzenal')),
  -- dia da semana em que produz (1 = segunda ... 7 = domingo)
  dia_producao smallint not null default 1 check (dia_producao between 1 and 7),
  -- quinzenal: segunda-feira de uma semana em que produz (a partir dela, semana sim, semana não)
  semana_base date not null default (date_trunc('week', (now() at time zone 'America/Bahia'))::date),
  responsavel_id uuid references public.prod_colaboradores(id) on delete set null,
  duracao_estimada_min integer check (duracao_estimada_min is null or duracao_estimada_min >= 0),
  ordem integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prod_contagens (
  id uuid primary key default gen_random_uuid(),
  semana date not null unique check (extract(isodow from semana) = 1),
  status text not null default 'rascunho' check (status in ('rascunho','confirmada')),
  colaborador_id uuid references public.prod_colaboradores(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  confirmada_em timestamptz,
  created_at timestamptz not null default now()
);

create table public.prod_contagem_itens (
  id uuid primary key default gen_random_uuid(),
  contagem_id uuid not null references public.prod_contagens(id) on delete cascade,
  produto_id uuid not null references public.prod_produtos(id) on delete cascade,
  quantidade numeric not null check (quantidade >= 0),
  meta numeric,
  a_produzir numeric,
  unique (contagem_id, produto_id)
);
create index idx_prod_contagem_itens_contagem on public.prod_contagem_itens(contagem_id);

-- Tarefa gerada pela meta: no máximo uma por meta por dia
alter table public.prod_tarefas add column meta_id uuid references public.prod_metas_estoque(id) on delete set null;
create unique index uq_prod_tarefas_meta_data on public.prod_tarefas(meta_id, data_execucao) where meta_id is not null;

create trigger trg_prod_metas_touch before update on public.prod_metas_estoque
  for each row execute function public.prod_touch_updated_at();

alter table public.prod_metas_estoque  enable row level security;
alter table public.prod_contagens      enable row level security;
alter table public.prod_contagem_itens enable row level security;
create policy prod_metas_estoque_auth_all  on public.prod_metas_estoque  for all to authenticated using (true) with check (true);
create policy prod_contagens_auth_all      on public.prod_contagens      for all to authenticated using (true) with check (true);
create policy prod_contagem_itens_auth_all on public.prod_contagem_itens for all to authenticated using (true) with check (true);

-- A meta produz nesta semana? (semanal: sempre; quinzenal: semana sim, semana não a partir da semana_base)
create or replace function public.prod_meta_produz_na_semana(p_ciclo text, p_base date, p_semana date) returns boolean
language sql immutable set search_path = '' as $$
  select p_ciclo = 'semanal'
      or (p_ciclo = 'quinzenal'
          and mod(abs((p_semana - date_trunc('week', p_base)::date) / 7), 2) = 0) $$;

-- Aplica a contagem confirmada: cria / ajusta / remove as tarefas de produção da semana.
-- Tarefas que já começaram ou foram entregues nunca são alteradas.
create or replace function public.prod_aplicar_contagem(p_contagem uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_semana date; v_hoje date := public.prod_hoje(); v_n integer := 0;
  m record; v_qtd numeric; v_falta numeric; v_data date; v_produz boolean; v_tarefa public.prod_tarefas;
begin
  select semana into v_semana from public.prod_contagens where id = p_contagem;
  if v_semana is null then raise exception 'Contagem não encontrada'; end if;

  for m in
    select me.*, p.nome as produto_nome, p.unidade, p.setor_id, p.ativo as produto_ativo,
           c.ativo as resp_ativo
    from public.prod_metas_estoque me
    join public.prod_produtos p on p.id = me.produto_id
    left join public.prod_colaboradores c on c.id = me.responsavel_id
    where me.ativo
  loop
    select quantidade into v_qtd from public.prod_contagem_itens
      where contagem_id = p_contagem and produto_id = m.produto_id;
    v_produz := public.prod_meta_produz_na_semana(m.ciclo, m.semana_base, v_semana);
    v_falta := case when v_qtd is null or not v_produz then 0
                    else round(greatest(m.meta - v_qtd, 0), 2) end;

    update public.prod_contagem_itens set meta = m.meta, a_produzir = case when v_produz then v_falta end
      where contagem_id = p_contagem and produto_id = m.produto_id;

    -- dia de produção nesta semana (se já passou, vai para hoje)
    v_data := greatest(v_semana + (m.dia_producao - 1), v_hoje);

    select * into v_tarefa from public.prod_tarefas t
      where t.meta_id = m.id and t.data_execucao between v_semana and v_semana + 6
      order by t.data_execucao limit 1;

    if v_tarefa.id is not null then
      if v_tarefa.status = 'pendente' and v_tarefa.inicio_real is null then
        if v_falta > 0 then
          update public.prod_tarefas set quantidade_planejada = v_falta
            where id = v_tarefa.id;
        else
          delete from public.prod_tarefas where id = v_tarefa.id;
        end if;
        v_n := v_n + 1;
      end if;
    elsif v_falta > 0 and m.produto_ativo then
      insert into public.prod_tarefas (meta_id, setor_id, colaborador_id, produto_id, titulo, instrucoes,
        quantidade_planejada, unidade, data_execucao, janela_inicio, janela_fim, duracao_estimada_min, ordem)
      values (m.id, m.setor_id, case when m.resp_ativo then m.responsavel_id end, m.produto_id,
        'Produzir ' || m.produto_nome,
        'Meta ' || trim(trailing '.' from to_char(m.meta, 'FM999999990.##')) || ' ' || m.unidade || ' · contado '
          || trim(trailing '.' from to_char(v_qtd, 'FM999999990.##')) || ' ' || m.unidade,
        v_falta, m.unidade, v_data, v_data, v_data, m.duracao_estimada_min, m.ordem);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.prod_aplicar_contagem(uuid) from public, anon, authenticated;

-- Salva (e opcionalmente confirma) a contagem da semana atual. Itens: [{"produto_id":..., "quantidade":...}]
create or replace function public.prod_salvar_contagem_interno(p_itens jsonb, p_colaborador uuid, p_usuario uuid, p_confirmar boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_semana date := public.prod_hoje() - (extract(isodow from public.prod_hoje())::int - 1);
        v_id uuid; v_item jsonb; v_q numeric; v_n integer := 0; v_faltando integer;
begin
  insert into public.prod_contagens (semana) values (v_semana)
    on conflict (semana) do nothing;
  select id into v_id from public.prod_contagens where semana = v_semana for update;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    if (v_item->>'quantidade') is null or (v_item->>'quantidade') = '' then continue; end if;
    v_q := (v_item->>'quantidade')::numeric;
    if v_q < 0 then raise exception 'Quantidade não pode ser negativa'; end if;
    if not exists (select 1 from public.prod_metas_estoque me
                   where me.produto_id = (v_item->>'produto_id')::uuid and me.ativo) then
      raise exception 'Produto fora da lista de metas';
    end if;
    insert into public.prod_contagem_itens (contagem_id, produto_id, quantidade)
    values (v_id, (v_item->>'produto_id')::uuid, v_q)
    on conflict (contagem_id, produto_id) do update set quantidade = excluded.quantidade;
  end loop;

  update public.prod_contagens set colaborador_id = coalesce(p_colaborador, colaborador_id),
    usuario_id = coalesce(p_usuario, usuario_id) where id = v_id;

  if p_confirmar then
    select count(*) into v_faltando from public.prod_metas_estoque me
      join public.prod_produtos p on p.id = me.produto_id
      where me.ativo and p.ativo and not exists (select 1 from public.prod_contagem_itens i
        where i.contagem_id = v_id and i.produto_id = me.produto_id);
    if v_faltando > 0 then
      raise exception 'Faltam % produto(s) para contar', v_faltando;
    end if;
    update public.prod_contagens set status = 'confirmada', confirmada_em = now() where id = v_id;
    v_n := public.prod_aplicar_contagem(v_id);
  end if;
  return jsonb_build_object('contagem_id', v_id, 'tarefas_ajustadas', v_n);
end $$;
revoke all on function public.prod_salvar_contagem_interno(jsonb, uuid, uuid, boolean) from public, anon, authenticated;

-- Versão do painel (usuário logado)
create or replace function public.prod_salvar_contagem(p_itens jsonb, p_confirmar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Não autorizado'; end if;
  return public.prod_salvar_contagem_interno(p_itens, null, auth.uid(), p_confirmar);
end $$;
revoke all on function public.prod_salvar_contagem(jsonb, boolean) from public, anon;
grant execute on function public.prod_salvar_contagem(jsonb, boolean) to authenticated;

-- Versão do tablet (exige o código da cozinha)
create or replace function public.prod_cozinha_salvar_contagem(p_codigo text, p_colaborador uuid, p_itens jsonb, p_confirmar boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  if p_colaborador is null or not exists (select 1 from public.prod_colaboradores where id = p_colaborador and ativo) then
    raise exception 'Escolha quem está fazendo a contagem';
  end if;
  return public.prod_salvar_contagem_interno(p_itens, p_colaborador, null, p_confirmar);
end $$;
revoke all on function public.prod_cozinha_salvar_contagem(text, uuid, jsonb, boolean) from public;
grant execute on function public.prod_cozinha_salvar_contagem(text, uuid, jsonb, boolean) to anon, authenticated;

-- Lista para a tela de contagem do tablet (semana atual)
create or replace function public.prod_cozinha_contagem(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_semana date := public.prod_hoje() - (extract(isodow from public.prod_hoje())::int - 1);
        v_cont public.prod_contagens;
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  select * into v_cont from public.prod_contagens where semana = v_semana;
  return jsonb_build_object(
    'semana', v_semana,
    'status', coalesce(v_cont.status, 'nova'),
    'confirmada_em', v_cont.confirmada_em,
    'contado_por', (select nome from public.prod_colaboradores where id = v_cont.colaborador_id),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'produto_id', p.id, 'produto', p.nome, 'unidade', p.unidade, 'meta', me.meta, 'ciclo', me.ciclo,
        'produz_semana', public.prod_meta_produz_na_semana(me.ciclo, me.semana_base, v_semana),
        'quantidade', i.quantidade, 'a_produzir', i.a_produzir,
        'setor', s.nome) order by s.nome, me.ordem, p.nome)
      from public.prod_metas_estoque me
      join public.prod_produtos p on p.id = me.produto_id
      left join public.prod_setores s on s.id = p.setor_id
      left join public.prod_contagem_itens i on i.contagem_id = v_cont.id and i.produto_id = p.id
      where me.ativo and p.ativo), '[]'::jsonb));
end $$;
revoke all on function public.prod_cozinha_contagem(text) from public;
grant execute on function public.prod_cozinha_contagem(text) to anon, authenticated;
