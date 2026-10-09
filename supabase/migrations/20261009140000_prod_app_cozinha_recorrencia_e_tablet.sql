-- Recorrência das tarefas, regras de integridade, acesso do tablet por código e fotos.

create extension if not exists pgcrypto with schema extensions;

-- Modelos: responsável padrão, dias da semana (diária), prazo da semanal, ordem
alter table public.prod_modelos_tarefa
  add column if not exists colaborador_padrao_id uuid references public.prod_colaboradores(id) on delete set null,
  add column if not exists dias_semana smallint[] not null default '{1,2,3,4,5,6,0}',
  add column if not exists prazo_dias smallint not null default 6 check (prazo_dias between 0 and 6),
  add column if not exists ordem integer not null default 100;

-- Tarefas: ordem e avaliação (aprovar / reprovar)
alter table public.prod_tarefas
  add column if not exists ordem integer not null default 100,
  add column if not exists avaliado_por uuid references auth.users(id) on delete set null,
  add column if not exists avaliado_em timestamptz,
  add column if not exists motivo_reprovacao text;

-- Uma execução por modelo por data: a recorrência nunca sobrescreve nem duplica
create unique index if not exists uq_prod_tarefas_modelo_data
  on public.prod_tarefas(modelo_id, data_execucao) where modelo_id is not null;

alter table public.prod_tarefas drop constraint if exists prod_tarefas_janela_chk;
alter table public.prod_tarefas add constraint prod_tarefas_janela_chk
  check (janela_inicio is null or janela_fim is null or janela_fim >= janela_inicio);

-- updated_at automático
create or replace function public.prod_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_prod_tarefas_touch on public.prod_tarefas;
create trigger trg_prod_tarefas_touch before update on public.prod_tarefas
  for each row execute function public.prod_touch_updated_at();
drop trigger if exists trg_prod_colab_touch on public.prod_colaboradores;
create trigger trg_prod_colab_touch before update on public.prod_colaboradores
  for each row execute function public.prod_touch_updated_at();
drop trigger if exists trg_prod_produtos_touch on public.prod_produtos;
create trigger trg_prod_produtos_touch before update on public.prod_produtos
  for each row execute function public.prod_touch_updated_at();

-- Integridade: colaborador inativo não recebe tarefa; produto inativo não é programado
create or replace function public.prod_valida_tarefa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.colaborador_id is distinct from old.colaborador_id then
    if new.colaborador_id is not null and exists (
      select 1 from public.prod_colaboradores c where c.id = new.colaborador_id and not c.ativo) then
      raise exception 'Colaborador inativo não pode receber tarefas';
    end if;
  end if;
  if tg_op = 'INSERT' and new.produto_id is not null and exists (
      select 1 from public.prod_produtos p where p.id = new.produto_id and not p.ativo) then
    raise exception 'Produto inativo não pode ser programado';
  end if;
  return new;
end $$;
drop trigger if exists trg_prod_valida_tarefa on public.prod_tarefas;
create trigger trg_prod_valida_tarefa before insert or update on public.prod_tarefas
  for each row execute function public.prod_valida_tarefa();

-- Configuração: código de acesso do tablet (guardado só como hash, sem políticas => invisível)
create table if not exists public.prod_config (
  id text primary key check (id = 'cozinha'),
  codigo_hash text,
  updated_at timestamptz not null default now()
);
alter table public.prod_config enable row level security;

create or replace function public.prod_hoje() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Bahia')::date $$;

create or replace function public.prod_definir_codigo(p_codigo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Não autorizado'; end if;
  if p_codigo is null or length(trim(p_codigo)) < 4 then
    raise exception 'O código precisa ter pelo menos 4 caracteres';
  end if;
  insert into public.prod_config(id, codigo_hash, updated_at)
  values ('cozinha', extensions.crypt(trim(p_codigo), extensions.gen_salt('bf')), now())
  on conflict (id) do update set codigo_hash = excluded.codigo_hash, updated_at = now();
end $$;

create or replace function public.prod_codigo_valido(p_codigo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.prod_config c
    where c.id = 'cozinha' and c.codigo_hash is not null
      and c.codigo_hash = extensions.crypt(coalesce(p_codigo,''), c.codigo_hash)) $$;

-- Gera as tarefas recorrentes de uma data (pode rodar quantas vezes quiser)
create or replace function public.prod_gerar_tarefas(p_data date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_seg date; v_n integer := 0; v_k integer;
begin
  v_seg := p_data - ((extract(isodow from p_data)::int) - 1);
  -- diárias (só nos dias da semana marcados)
  insert into public.prod_tarefas (modelo_id, setor_id, colaborador_id, produto_id, titulo, instrucoes,
    quantidade_planejada, unidade, data_execucao, janela_inicio, janela_fim, duracao_estimada_min,
    exige_foto, exige_aprovacao, ordem)
  select m.id, m.setor_id, case when c.ativo then m.colaborador_padrao_id end,
    m.produto_id, m.titulo, m.descricao, m.quantidade_padrao, m.unidade, p_data, p_data, p_data,
    m.duracao_estimada_min, m.exige_foto, m.exige_aprovacao, m.ordem
  from public.prod_modelos_tarefa m
  left join public.prod_colaboradores c on c.id = m.colaborador_padrao_id
  left join public.prod_produtos p on p.id = m.produto_id
  where m.ativo and m.frequencia = 'diaria'
    and extract(dow from p_data)::smallint = any(m.dias_semana)
    and (m.produto_id is null or p.ativo)
  on conflict (modelo_id, data_execucao) where modelo_id is not null do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;
  -- semanais (uma por semana, a partir da segunda-feira, com prazo em dias)
  insert into public.prod_tarefas (modelo_id, setor_id, colaborador_id, produto_id, titulo, instrucoes,
    quantidade_planejada, unidade, data_execucao, janela_inicio, janela_fim, duracao_estimada_min,
    exige_foto, exige_aprovacao, ordem)
  select m.id, m.setor_id, case when c.ativo then m.colaborador_padrao_id end,
    m.produto_id, m.titulo, m.descricao, m.quantidade_padrao, m.unidade, v_seg, v_seg, v_seg + m.prazo_dias,
    m.duracao_estimada_min, m.exige_foto, m.exige_aprovacao, m.ordem
  from public.prod_modelos_tarefa m
  left join public.prod_colaboradores c on c.id = m.colaborador_padrao_id
  left join public.prod_produtos p on p.id = m.produto_id
  where m.ativo and m.frequencia = 'semanal' and (m.produto_id is null or p.ativo)
  on conflict (modelo_id, data_execucao) where modelo_id is not null do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;
  return v_n;
end $$;

-- ===== Funções do TABLET (todas exigem o código da cozinha) =====

create or replace function public.prod_cozinha_equipe(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := public.prod_hoje();
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  perform public.prod_gerar_tarefas(v_hoje);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'nome', s.nome,
      'colaboradores', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'nome', c.nome,
          'pendentes', (select count(*) from public.prod_tarefas t
             where t.colaborador_id = c.id
               and t.status in ('pendente','em_andamento','reprovada','atrasada')
               and coalesce(t.janela_inicio, t.data_execucao) <= v_hoje)
        ) order by c.nome)
        from public.prod_colaboradores c where c.ativo and c.setor_id = s.id), '[]'::jsonb)
    ) order by s.nome)
    from public.prod_setores s where s.ativo), '[]'::jsonb);
end $$;

create or replace function public.prod_cozinha_tarefas(p_codigo text, p_colaborador uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := public.prod_hoje();
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.atrasada desc, x.ordem, x.titulo)
    from (
      select t.id, t.titulo, t.instrucoes, t.quantidade_planejada, t.quantidade_realizada, t.unidade,
        t.data_execucao, t.janela_inicio, t.janela_fim, t.duracao_estimada_min, t.exige_foto,
        t.exige_aprovacao, t.status, t.inicio_real, t.conclusao_real, t.motivo_reprovacao, t.ordem,
        t.produto_id, p.nome as produto_nome,
        (coalesce(t.janela_fim, t.data_execucao) < v_hoje and t.status not in ('concluida','aguardando_aprovacao')) as atrasada,
        (t.janela_fim is not null and t.janela_fim > coalesce(t.janela_inicio, t.data_execucao)) as semanal,
        exists(select 1 from public.prod_fichas_tecnicas f where f.produto_id = t.produto_id and f.ativa) as tem_ficha
      from public.prod_tarefas t
      left join public.prod_produtos p on p.id = t.produto_id
      where t.colaborador_id = p_colaborador
        and (
          (coalesce(t.janela_inicio, t.data_execucao) <= v_hoje and coalesce(t.janela_fim, t.data_execucao) >= v_hoje)
          or (coalesce(t.janela_fim, t.data_execucao) < v_hoje and t.status in ('pendente','em_andamento','reprovada','atrasada'))
        )
    ) x), '[]'::jsonb);
end $$;

create or replace function public.prod_cozinha_ficha(p_codigo text, p_produto uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  return (
    select jsonb_build_object(
      'produto', p.nome, 'versao', f.versao, 'rendimento', f.rendimento,
      'unidade_rendimento', f.unidade_rendimento, 'modo_preparo', f.modo_preparo,
      'armazenamento', f.armazenamento,
      'ingredientes', coalesce((select jsonb_agg(jsonb_build_object(
          'nome', i.nome, 'quantidade', i.quantidade, 'unidade', i.unidade) order by i.ordem)
        from public.prod_ficha_ingredientes i where i.ficha_id = f.id), '[]'::jsonb))
    from public.prod_fichas_tecnicas f join public.prod_produtos p on p.id = f.produto_id
    where f.produto_id = p_produto and f.ativa
    order by f.versao desc limit 1);
end $$;

create or replace function public.prod_cozinha_iniciar(p_codigo text, p_colaborador uuid, p_tarefa uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  update public.prod_tarefas set status = 'em_andamento', inicio_real = coalesce(inicio_real, now())
  where id = p_tarefa and colaborador_id = p_colaborador and status in ('pendente','reprovada','atrasada');
  if not found then raise exception 'Tarefa não encontrada para este colaborador'; end if;
end $$;

create or replace function public.prod_cozinha_concluir(p_codigo text, p_colaborador uuid, p_tarefa uuid,
  p_quantidade numeric, p_observacoes text, p_foto text) returns text
language plpgsql security definer set search_path = '' as $$
declare t public.prod_tarefas; v_status text;
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  select * into t from public.prod_tarefas where id = p_tarefa and colaborador_id = p_colaborador for update;
  if not found then raise exception 'Tarefa não encontrada para este colaborador'; end if;
  if t.status in ('concluida','aguardando_aprovacao') then raise exception 'Tarefa já foi entregue'; end if;
  if p_quantidade is not null and p_quantidade < 0 then raise exception 'Quantidade inválida'; end if;
  if t.exige_foto and (p_foto is null or p_foto = '') then raise exception 'Esta tarefa precisa de foto'; end if;
  if p_foto is not null and p_foto <> '' and p_foto not like (p_tarefa::text || '/%') then
    raise exception 'Foto inválida';
  end if;
  v_status := case when t.exige_aprovacao then 'aguardando_aprovacao' else 'concluida' end;
  update public.prod_tarefas set
    status = v_status, inicio_real = coalesce(inicio_real, now()), conclusao_real = now(),
    quantidade_realizada = coalesce(p_quantidade, quantidade_planejada),
    observacoes = nullif(trim(coalesce(p_observacoes,'')), ''), motivo_reprovacao = null
  where id = p_tarefa;
  if p_foto is not null and p_foto <> '' then
    insert into public.prod_evidencias(tarefa_id, colaborador_id, caminho_arquivo, tipo)
    values (p_tarefa, p_colaborador, p_foto, 'foto');
  end if;
  return v_status;
end $$;

-- Permissões: só as funções do tablet ficam abertas ao público (e todas checam o código)
revoke all on function public.prod_gerar_tarefas(date) from public, anon;
revoke all on function public.prod_definir_codigo(text) from public, anon;
revoke all on function public.prod_codigo_valido(text) from public;
revoke all on function public.prod_cozinha_equipe(text) from public;
revoke all on function public.prod_cozinha_tarefas(text, uuid) from public;
revoke all on function public.prod_cozinha_ficha(text, uuid) from public;
revoke all on function public.prod_cozinha_iniciar(text, uuid, uuid) from public;
revoke all on function public.prod_cozinha_concluir(text, uuid, uuid, numeric, text, text) from public;
grant execute on function public.prod_gerar_tarefas(date) to authenticated;
grant execute on function public.prod_definir_codigo(text) to authenticated;
grant execute on function public.prod_codigo_valido(text) to anon, authenticated;
grant execute on function public.prod_cozinha_equipe(text) to anon, authenticated;
grant execute on function public.prod_cozinha_tarefas(text, uuid) to anon, authenticated;
grant execute on function public.prod_cozinha_ficha(text, uuid) to anon, authenticated;
grant execute on function public.prod_cozinha_iniciar(text, uuid, uuid) to anon, authenticated;
grant execute on function public.prod_cozinha_concluir(text, uuid, uuid, numeric, text, text) to anon, authenticated;

-- Fotos: bucket privado, só imagens até 5 MB. O tablet só consegue ENVIAR (nunca ler, listar ou apagar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prod-evidencias', 'prod-evidencias', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "prod_evid_upload_tablet" on storage.objects;
create policy "prod_evid_upload_tablet" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'prod-evidencias');
drop policy if exists "prod_evid_leitura_painel" on storage.objects;
create policy "prod_evid_leitura_painel" on storage.objects for select to authenticated
  using (bucket_id = 'prod-evidencias');

-- Setores informados pelo dono
insert into public.prod_setores(nome, descricao) values
  ('Marmitaria', 'Equipe de produção da marmitaria'),
  ('Hamburgueria', 'Equipe de produção da hamburgueria')
on conflict (nome) do nothing;
