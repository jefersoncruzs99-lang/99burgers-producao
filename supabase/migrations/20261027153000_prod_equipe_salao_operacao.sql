-- JÁ APLICADA no Supabase em 2026-10-27.
-- Salão e Operação usam as etiquetas, mas não as tarefas da cozinha.
-- Cada colaborador diz onde aparece: tarefas e/ou etiquetas.

alter table public.prod_colaboradores
  add column if not exists usa_tarefas boolean not null default true,
  add column if not exists usa_etiquetas boolean not null default true;

-- Tarefas da cozinha: só quem usa tarefas
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
        from public.prod_colaboradores c where c.ativo and c.usa_tarefas and c.setor_id = s.id), '[]'::jsonb)
    ) order by s.nome)
    from public.prod_setores s where s.ativo), '[]'::jsonb);
end $$;

-- Etiquetas: só quem usa etiquetas (cozinha, salão e operação)
create or replace function public.prod_cozinha_equipe_etiquetas(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'nome', s.nome,
      'colaboradores', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'pendentes', 0) order by c.nome)
        from public.prod_colaboradores c where c.ativo and c.usa_etiquetas and c.setor_id = s.id), '[]'::jsonb)
    ) order by s.nome)
    from public.prod_setores s where s.ativo), '[]'::jsonb);
end $$;
revoke all on function public.prod_cozinha_equipe_etiquetas(text) from public;
grant execute on function public.prod_cozinha_equipe_etiquetas(text) to anon, authenticated;

-- Só quem usa etiquetas pode emitir
create or replace function public.prod_cozinha_emitir_etiqueta(
  p_codigo text, p_colaborador uuid, p_item uuid, p_conservacao text,
  p_quantidade integer, p_dias integer default null, p_validade_original date default null,
  p_tarefa uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.prod_etiqueta_itens; v_colab record; v_dias integer; v_temp text;
  v_agora timestamptz := now(); v_dia text; v_seq integer; v_e public.prod_etiquetas;
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  select * into v_item from public.prod_etiqueta_itens where id = p_item and ativo;
  if not found then raise exception 'Item de etiqueta não encontrado'; end if;
  select c.nome, s.nome as setor into v_colab
    from public.prod_colaboradores c left join public.prod_setores s on s.id = c.setor_id
    where c.id = p_colaborador and c.ativo and c.usa_etiquetas;
  if not found then raise exception 'Colaborador não encontrado'; end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 50 then
    raise exception 'Quantidade de etiquetas deve ser de 1 a 50';
  end if;

  if p_conservacao = 'resfriado' then v_dias := v_item.dias_resfriado; v_temp := v_item.temperatura_resfriado;
  elsif p_conservacao = 'congelado' then v_dias := v_item.dias_congelado; v_temp := '-18 °C ou menos';
  elsif p_conservacao = 'ambiente' then v_dias := v_item.dias_ambiente; v_temp := 'Temperatura ambiente';
  else raise exception 'Conservação inválida'; end if;

  -- Sem prazo cadastrado (ex.: industrializado aberto): usa o prazo digitado da embalagem
  if v_dias is null then
    if p_dias is null or p_dias < 0 or p_dias > 3650 then
      raise exception 'Informe a validade em dias (veja a embalagem)';
    end if;
    v_dias := p_dias;
  end if;

  perform pg_advisory_xact_lock(hashtext('prod_etiquetas_lote'));
  v_dia := to_char(v_agora at time zone 'America/Bahia', 'DDMMYY');
  select count(*) + 1 into v_seq from public.prod_etiquetas where lote like v_dia || '-%';

  insert into public.prod_etiquetas (lote, item_id, colaborador_id, tarefa_id, nome, tipo, setor,
    conservacao, temperatura, manipulado_em, validade_dias, vence_em, validade_original, quantidade, responsavel)
  values (v_dia || '-' || lpad(v_seq::text, 3, '0'), v_item.id, p_colaborador, p_tarefa, v_item.nome, v_item.tipo,
    coalesce(v_colab.setor, v_item.grupo), p_conservacao, v_temp, v_agora, v_dias,
    v_agora + make_interval(days => v_dias), p_validade_original, p_quantidade, v_colab.nome)
  returning * into v_e;

  return public.prod_etiqueta_json(v_e);
end $$;

-- Setores e equipe do Salão e da Operação
insert into public.prod_setores (nome)
select v.nome from (values ('Salão'), ('Operação')) v(nome)
where not exists (select 1 from public.prod_setores s where s.nome = v.nome);

insert into public.prod_colaboradores (nome, setor_id, usa_tarefas, usa_etiquetas)
select v.nome, s.id, false, true
from (values
  ('Barbara Santos', 'Salão'),
  ('Giselle Nathalia', 'Salão'),
  ('João Pedro', 'Salão'),
  ('Jullyenne Aquino', 'Salão'),
  ('Wallas de Jesus', 'Salão'),
  ('Bruno Santos', 'Operação'),
  ('Dhonatas de Jesus', 'Operação'),
  ('Erica Oliveira', 'Operação'),
  ('Henrique Neto', 'Operação'),
  ('Livia Santos', 'Operação'),
  ('Marcelo Ramos', 'Operação'),
  ('Ruan Lisboa', 'Operação'),
  ('Vinicius Santos', 'Operação')
) v(nome, setor)
join public.prod_setores s on s.nome = v.setor
where not exists (select 1 from public.prod_colaboradores c where c.nome = v.nome);
