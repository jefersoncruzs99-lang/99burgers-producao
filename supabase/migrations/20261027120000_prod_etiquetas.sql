-- JÁ APLICADA no Supabase em 2026-10-27.
-- Etiquetas de validade (60 x 50 mm) impressas pelo tablet da cozinha.
-- Cadastro de validades por item, histórico de cada etiqueta impressa (lote) e funções do tablet.

create table if not exists public.prod_etiqueta_config (
  id text primary key default 'padrao' check (id = 'padrao'),
  empresa text not null default 'NOVE NOVE BURGER''S',
  cnpj text,
  updated_at timestamptz not null default now()
);
insert into public.prod_etiqueta_config (id, cnpj) values ('padrao', '40.161.847/0001-72')
  on conflict (id) do nothing;

create table if not exists public.prod_etiqueta_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null default 'Geral',
  -- preparo = feito na cozinha; aberto = industrializado aberto; descongelado = saiu do freezer
  tipo text not null default 'preparo' check (tipo in ('preparo','aberto','descongelado')),
  produto_id uuid references public.prod_produtos(id) on delete set null,
  temperatura_resfriado text not null default 'até 4 °C',
  dias_resfriado integer check (dias_resfriado between 0 and 3650),
  dias_congelado integer check (dias_congelado between 0 and 3650),
  dias_ambiente integer check (dias_ambiente between 0 and 3650),
  base text,
  observacao text,
  ordem integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prod_etiqueta_itens_produto on public.prod_etiqueta_itens(produto_id);

create table if not exists public.prod_etiquetas (
  id uuid primary key default gen_random_uuid(),
  lote text not null unique,
  item_id uuid references public.prod_etiqueta_itens(id) on delete set null,
  colaborador_id uuid references public.prod_colaboradores(id) on delete set null,
  tarefa_id uuid references public.prod_tarefas(id) on delete set null,
  nome text not null,
  tipo text not null,
  setor text,
  conservacao text not null check (conservacao in ('resfriado','congelado','ambiente')),
  temperatura text not null,
  manipulado_em timestamptz not null default now(),
  validade_dias integer not null check (validade_dias between 0 and 3650),
  vence_em timestamptz not null,
  validade_original date,
  quantidade integer not null default 1 check (quantidade between 1 and 50),
  responsavel text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_prod_etiquetas_data on public.prod_etiquetas(created_at desc);
create index if not exists idx_prod_etiquetas_vence on public.prod_etiquetas(vence_em);

alter table public.prod_etiqueta_config enable row level security;
alter table public.prod_etiqueta_itens  enable row level security;
alter table public.prod_etiquetas       enable row level security;
create policy prod_etiqueta_config_auth_all on public.prod_etiqueta_config for all to authenticated using (true) with check (true);
create policy prod_etiqueta_itens_auth_all  on public.prod_etiqueta_itens  for all to authenticated using (true) with check (true);
create policy prod_etiquetas_auth_all       on public.prod_etiquetas       for all to authenticated using (true) with check (true);

drop trigger if exists trg_prod_etiqueta_itens_touch on public.prod_etiqueta_itens;
create trigger trg_prod_etiqueta_itens_touch before update on public.prod_etiqueta_itens
  for each row execute function public.prod_touch_updated_at();

-- ---------- funções do tablet (exigem o código da cozinha) ----------

create or replace function public.prod_cozinha_etiqueta_itens(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.prod_codigo_valido(p_codigo) then raise exception 'Código da cozinha inválido'; end if;
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome, 'grupo', i.grupo, 'tipo', i.tipo, 'produto_id', i.produto_id,
        'temperatura_resfriado', i.temperatura_resfriado, 'dias_resfriado', i.dias_resfriado,
        'dias_congelado', i.dias_congelado, 'dias_ambiente', i.dias_ambiente, 'observacao', i.observacao
      ) order by i.ordem, i.nome) from public.prod_etiqueta_itens i where i.ativo), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(public.prod_etiqueta_json(e) order by e.created_at desc)
      from (select * from public.prod_etiquetas order by created_at desc limit 15) e), '[]'::jsonb)
  );
end $$;

create or replace function public.prod_etiqueta_json(e public.prod_etiquetas) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'lote', e.lote, 'nome', e.nome, 'tipo', e.tipo, 'setor', e.setor,
    'conservacao', e.conservacao, 'temperatura', e.temperatura,
    'manipulado_em', e.manipulado_em, 'validade_dias', e.validade_dias, 'vence_em', e.vence_em,
    'validade_original', e.validade_original, 'quantidade', e.quantidade, 'responsavel', e.responsavel,
    'empresa', c.empresa, 'cnpj', c.cnpj)
  from (select 1) x left join public.prod_etiqueta_config c on c.id = 'padrao' $$;

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
    where c.id = p_colaborador and c.ativo;
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

-- Consulta pública pelo QR da etiqueta (só o que já está impresso nela)
create or replace function public.prod_etiqueta_por_lote(p_lote text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.prod_etiqueta_json(e) from public.prod_etiquetas e where e.lote = p_lote $$;

revoke all on function public.prod_etiqueta_json(public.prod_etiquetas) from public, anon, authenticated;
revoke all on function public.prod_cozinha_etiqueta_itens(text) from public;
revoke all on function public.prod_cozinha_emitir_etiqueta(text, uuid, uuid, text, integer, integer, date, uuid) from public;
revoke all on function public.prod_etiqueta_por_lote(text) from public;
grant execute on function public.prod_cozinha_etiqueta_itens(text) to anon, authenticated;
grant execute on function public.prod_cozinha_emitir_etiqueta(text, uuid, uuid, text, integer, integer, date, uuid) to anon, authenticated;
grant execute on function public.prod_etiqueta_por_lote(text) to anon, authenticated;

-- ---------- cadastro inicial (base: tabela do art. 44 da Portaria CVS 3/2026) ----------
insert into public.prod_etiqueta_itens
  (nome, grupo, tipo, produto_id, temperatura_resfriado, dias_resfriado, dias_congelado, base, observacao, ordem)
select v.nome, v.grupo, v.tipo,
  (select p.id from public.prod_produtos p where p.nome = v.produto and p.ativo order by p.created_at limit 1),
  v.temp, v.dr::integer, v.dc::integer, v.base, v.obs, v.ordem
from (values
('Maionese Especial','Hamburgueria','preparo','Maionese Especial','até 4 °C','30',null,'Definido pela casa','Base industrial: prazo definido pela casa.',10),
('Molho 99','Hamburgueria','preparo','Molho 99','até 4 °C','2',null,'Maionese e misturas com maionese','Se a receita não levar maionese, passa para 3 dias.',20),
('Geleia de Bacon','Hamburgueria','preparo','Geleia de Bacon','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,30),
('Geleia de Pimenta','Hamburgueria','preparo','Geleia de Pimenta','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,40),
('Geleia de Morango','Hamburgueria','preparo',null,'até 4 °C','3','30','Alimento pronto (pós-cocção)',null,50),
('Bacon Fatiado','Hamburgueria','preparo','Bacon Fatiado','até 4 °C','3','30','Frios e embutidos fatiados ou picados',null,60),
('Bacon Triturado','Hamburgueria','preparo','Bacon triturado','até 4 °C','3','30','Frios e embutidos fatiados ou picados',null,70),
('Blend (porcionado)','Hamburgueria','preparo','Blend','até 4 °C','2','30','Carne moída, temperada ou empanada crua',null,80),
('Smash (porcionado)','Hamburgueria','preparo','Smash','até 4 °C','2','30','Carne moída, temperada ou empanada crua',null,90),
('Frango 99FC (empanado cru)','Hamburgueria','preparo','Frango 99FC','até 4 °C','2','30','Carne moída, temperada ou empanada crua',null,100),
('Costela Desfiada','Hamburgueria','preparo','Costela desfiada','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,110),
('Creme de Cheddar','Hamburgueria','preparo','Creme de Cheddar','até 4 °C','3',null,'Preparação com laticínio',null,120),
('Cheddar de Batata','Hamburgueria','preparo',null,'até 4 °C','3',null,'Preparação com laticínio',null,130),
('Cheddar de Hambúrguer','Hamburgueria','preparo',null,'até 4 °C','3',null,'Preparação com laticínio',null,140),
('Queijo Coalho Empanado','Hamburgueria','preparo','Queijo Empanado','até 4 °C','3','30','Preparação com laticínio',null,150),
('Stick de Queijo','Hamburgueria','preparo','Stick de Queijo','até 4 °C','3','30','Preparação com laticínio',null,160),
('Queijo Gorgonzola (porcionado)','Hamburgueria','preparo','Queijo Gorgonzola','até 4 °C','3',null,'Preparação com laticínio',null,170),
('Cebola Crisp','Hamburgueria','preparo','Cebola crisp','até 4 °C','3',null,'Alimento pronto (pós-cocção)','Guardar em pote bem fechado.',180),
('Couve Crisp','Hamburgueria','preparo','Couve Crisp','até 4 °C','3',null,'Alimento pronto (pós-cocção)','Guardar em pote bem fechado.',190),
('Banana da Terra (pronta)','Hamburgueria','preparo','Banana da terra','até 4 °C','3',null,'Alimento pronto (pós-cocção)',null,200),
('Suco de Morango (preparo)','Hamburgueria','preparo',null,'até 5 °C','3','30','Sucos e polpas',null,210),
('Arroz','Marmitaria','preparo','Arroz','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,220),
('Feijão','Marmitaria','preparo','Feijao','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,230),
('Macarrão','Marmitaria','preparo','Macarrão','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,240),
('Molho de Tomate','Marmitaria','preparo','Molho de tomate','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,250),
('Purê de Batata','Marmitaria','preparo','Purê de batata','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,260),
('Strogonoff de Frango','Marmitaria','preparo','Strogonoff de Frango','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,270),
('Frango Xadrez','Marmitaria','preparo','Frango xadrez','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,280),
('Fígado (pronto)','Marmitaria','preparo','Fígado','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,290),
('Bife de Carne (pronto)','Marmitaria','preparo','Bife de carne','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,300),
('Bife de Carne (cru temperado)','Marmitaria','preparo',null,'até 4 °C','2','30','Carne moída, temperada ou empanada crua',null,310),
('Filé de Frango (pronto)','Marmitaria','preparo','File de frango','até 4 °C','3','30','Alimento pronto (pós-cocção)',null,320),
('Filé de Frango (cru temperado)','Marmitaria','preparo',null,'até 4 °C','2','30','Carne moída, temperada ou empanada crua',null,330),
('Alface Americana','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,340),
('Alface Crespa','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,350),
('Tomate Fatiado','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,360),
('Cebola Fatiada / Picada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,370),
('Cebolinha Picada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,380),
('Salsa Picada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,390),
('Couve Fatiada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,400),
('Limão Cortado','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,410),
('Pimenta Dedo-de-Moça Picada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,420),
('Banana da Terra Descascada','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,430),
('Morango Higienizado','Hortifruti','preparo',null,'até 5 °C','3',null,'Hortifruti higienizado, cortado ou descascado',null,440),
('Queijo Cheddar Fatiado','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,450),
('Cheddar Vigor 2,24 kg','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,460),
('Requeijão Cremoso 1,5 kg','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,470),
('Cream Cheese Catupiry','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,480),
('Queijo Coalho','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,490),
('Queijo Gorgonzola peça','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,500),
('Queijo Azul Tirolez','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados',null,510),
('Leite Integral','Insumos abertos','aberto',null,'até 7 °C','5',null,'Leite e derivados','Muitas marcas pedem 3 dias após aberto. Confira a caixa.',520),
('Bacon Manta / Inteiro','Insumos abertos','aberto',null,'até 4 °C','3','30','Frios e embutidos fatiados ou picados',null,530),
('Linguiça Toscana','Insumos abertos','aberto',null,'até 4 °C','3','30','Carne crua',null,540),
('Costela Desfiada 5 Minutos','Insumos abertos','descongelado',null,'até 4 °C','3',null,'Alimento pronto (pós-cocção)','Depois de descongelado, não volta para o freezer.',550),
('Hambúrguer Vegetal Futuro','Insumos abertos','descongelado',null,'até 4 °C','3',null,'Alimento pronto (pós-cocção)','Depois de descongelado, não volta para o freezer.',560),
('Polpa de Fruta','Insumos abertos','descongelado',null,'até 5 °C','3',null,'Sucos e polpas','Depois de descongelado, não volta para o freezer.',570),
('Morango Congelado','Insumos abertos','descongelado',null,'até 5 °C','3',null,'Sucos e polpas','Depois de descongelado, não volta para o freezer.',580),
('Maionese Bag Hellmann''s','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,590),
('Catchup 3,5 kg','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,600),
('Mostarda 3,6 kg','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,610),
('Molho Barbecue 3,5 kg','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,620),
('Geleia Frutas Vermelhas 2 kg','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,630),
('Nutella 3 kg','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,640),
('Cobertura de Chocolate','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,650),
('Preparado Morango / Amora JEB','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,660),
('Recheio de Amendoim Doremus','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,670),
('Mescla Bluemix','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante',null,680),
('Açaí 10 L','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante','Mantém congelado.',690),
('Sorvete 10 L','Industrializados abertos','aberto',null,'conforme embalagem',null,null,'Prazo após aberto do fabricante','Mantém congelado.',700)
) as v(nome, grupo, tipo, produto, temp, dr, dc, base, obs, ordem)
where not exists (select 1 from public.prod_etiqueta_itens);
