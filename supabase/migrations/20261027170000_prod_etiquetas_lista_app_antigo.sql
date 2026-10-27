-- JÁ APLICADA no Supabase em 2026-10-27.
-- Troca o cadastro de etiquetas pela lista do app antigo (grupos da casa + itens da biblioteca que a 99 usa).
-- Guarda a temperatura de cada conservação e trata "0 dia" como válido até o fim do dia.

alter table public.prod_etiqueta_itens
  add column if not exists temperatura_congelado text not null default 'Abaixo de -18 °C',
  add column if not exists temperatura_ambiente text not null default 'Ambiente';

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
  elsif p_conservacao = 'congelado' then v_dias := v_item.dias_congelado; v_temp := v_item.temperatura_congelado;
  elsif p_conservacao = 'ambiente' then v_dias := v_item.dias_ambiente; v_temp := v_item.temperatura_ambiente;
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
    case when v_dias = 0
      -- "0 dia": vale até o fim do dia
      then (date_trunc('day', v_agora at time zone 'America/Bahia') + interval '23 hours 59 minutes') at time zone 'America/Bahia'
      else v_agora + make_interval(days => v_dias) end,
    p_validade_original, p_quantidade, v_colab.nome)
  returning * into v_e;

  return public.prod_etiqueta_json(v_e);
end $$;

-- Cadastro anterior sai (o histórico de etiquetas impressas fica guardado)
delete from public.prod_etiqueta_itens;

insert into public.prod_etiqueta_itens
  (nome, grupo, tipo, produto_id, temperatura_resfriado, temperatura_congelado, temperatura_ambiente,
   dias_resfriado, dias_congelado, dias_ambiente, base, observacao, ordem)
select v.nome, v.grupo, v.tipo,
  (select p.id from public.prod_produtos p where p.nome = v.produto and p.ativo order by p.created_at limit 1),
  v.tr, v.tc, v.ta, v.dr::integer, v.dc::integer, v.da::integer, v.base, v.obs, v.ordem
from (values
('99FC','Produção 99','preparo','Frango 99FC','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,10),
('Alface Americana','Produção 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,20),
('Alface Crespa','Produção 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,30),
('Bacon Triturado','Produção 99','preparo','Bacon triturado','Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,40),
('Banana da Terra','Produção 99','preparo','Banana da terra','Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,50),
('Blend da Casa 180g','Produção 99','preparo','Blend','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,60),
('Cebola Crispy','Produção 99','preparo','Cebola crisp','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'5','Lista do app antigo',null,70),
('Cheddar (Creme de Queijo)','Produção 99','preparo','Creme de Cheddar','Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','4',null,null,'Lista do app antigo',null,80),
('Costela Desfiada','Produção 99','preparo','Costela desfiada','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,90),
('Costela Prensada','Produção 99','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,100),
('Couve Crispy','Produção 99','preparo','Couve Crisp','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'5','Lista do app antigo',null,110),
('Geleia de Bacon','Produção 99','preparo','Geleia de Bacon','Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,120),
('Geleia de Morango','Produção 99','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,130),
('Geleia de Pimenta','Produção 99','preparo','Geleia de Pimenta','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,140),
('Maionese Especial','Produção 99','preparo','Maionese Especial','Máximo 5 °C','Abaixo de -18 °C','Ambiente','30',null,null,'Lista do app antigo',null,150),
('Molho 99','Produção 99','preparo','Molho 99','Máximo 5 °C','Abaixo de -18 °C','Ambiente','30',null,null,'Lista do app antigo',null,160),
('Queijo Coalho Empanado','Produção 99','preparo','Queijo Empanado','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,170),
('Queijo Coalho Fatiado','Produção 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,180),
('Queijo Gorgonzola','Produção 99','preparo','Queijo Gorgonzola','Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,190),
('Sal com Pimenta do Reino','Produção 99','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,200),
('Smash da Casa 100g','Produção 99','preparo','Smash','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,210),
('Stick de Queijo','Produção 99','preparo','Stick de Queijo','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,220),
('Alface Crespa','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,230),
('Bacon Fatiado','Operação 99','preparo','Bacon Fatiado','Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,240),
('Bacon Triturado','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,250),
('Banana da Terra','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,260),
('Cebola Crispy','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,270),
('Cebola em Cubos','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,280),
('Cheddar (Creme de Queijo)','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,290),
('Couve Crispy','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,300),
('Geleia de Amora','Operação 99','aberto',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,310),
('Geleia de Bacon','Operação 99','aberto',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','4',null,null,'Lista do app antigo',null,320),
('Geleia de Morango','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,330),
('Geleia de Pimenta','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,340),
('Molho Barbecue','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,350),
('Queijo Coalho','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,360),
('Queijo Gorgonzola','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,370),
('Queijo Prato','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,380),
('Tomate','Operação 99','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,390),
('Alho Descascado','Produção Marmita','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'7','Lista do app antigo',null,400),
('Alho Triturado','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Lista do app antigo',null,410),
('Batata Inglesa','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,420),
('Bife a Milanesa','Produção Marmita','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,430),
('Bife para Almoço','Produção Marmita','preparo','Bife de carne','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Lista do app antigo',null,440),
('Calabresa','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','30',null,null,'Lista do app antigo',null,450),
('Camarão Seco','Produção Marmita','preparo',null,'Máximo 4 °C','Entre 0 e -5 °C','Ambiente',null,'30',null,'Lista do app antigo','Entre 0 e -5 °C a tabela da vigilância indica 10 dias.',460),
('Carne Seca','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','30',null,null,'Lista do app antigo',null,470),
('Cebola Descascada','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','10',null,null,'Lista do app antigo',null,480),
('Cebola Ralada','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,490),
('Cebola em Cubos','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,500),
('Cebolinha','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,510),
('Coentro Folha','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,520),
('Filé de Frango','Produção Marmita','preparo','File de frango','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,530),
('Frango à Milanesa','Produção Marmita','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,540),
('Fígado','Produção Marmita','preparo','Fígado','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Lista do app antigo',null,550),
('Legumes','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','15',null,null,'Lista do app antigo',null,560),
('Molho de Tomate','Produção Marmita','preparo','Molho de tomate','Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','4',null,null,'Lista do app antigo',null,570),
('Ovos','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','15',null,null,'Lista do app antigo',null,580),
('Pimentão','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','7',null,null,'Lista do app antigo',null,590),
('Queijo Ralado','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','10',null,null,'Lista do app antigo',null,600),
('Salada','Produção Marmita','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'1','Lista do app antigo','Salada picada deve ficar refrigerada.',610),
('Salada de Verdura','Produção Marmita','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,620),
('Strogonoff de Frango','Produção Marmita','preparo','Strogonoff de Frango','Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'5',null,'Lista do app antigo','O app antigo tinha 5 e 30 dias congelado. Ficou 5; ajuste se for o caso.',630),
('Bife a Milanesa','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,640),
('Bife para Almoço','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,650),
('Feijão','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,660),
('Filé de Frango','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,670),
('Frango à Milanesa','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,680),
('Macarrão','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,690),
('Mini Arroz Cozido','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,700),
('Salada de Verdura','Sobra do Dia','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,710),
('Calda de Caramelo','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,720),
('Calda de Chocolate','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,730),
('Calda de Morango','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,740),
('Creme de Pistache','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,750),
('Doce de Leite','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,760),
('Geleia de Morango','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'4','Lista do app antigo',null,770),
('Nutella','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,780),
('Ovomaltine','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'15','Lista do app antigo',null,790),
('Paçoca','Milkshake','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'15','Lista do app antigo',null,800),
('Calda de Abacaxi','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,810),
('Calda de Caramelo','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,820),
('Calda de Chocolate','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,830),
('Calda de Morango','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,840),
('Caldas','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Lista do app antigo',null,850),
('Leite Condensado','Açaiteria 99','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'2','Lista do app antigo','Depois de aberto, guardar na geladeira.',860),
('Chá Mate','Bebidas da Casa','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Lista do app antigo',null,870),
('Pink Lemonade','Bebidas da Casa','preparo',null,'Entre 0 e 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Lista do app antigo',null,880),
('Desengordurante','Limpeza','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Lista do app antigo',null,890),
('Detergente Lavar Prato','Limpeza','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Lista do app antigo',null,900),
('Limpa Alumínio','Limpeza','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Lista do app antigo',null,910),
('Limpa Chapa','Limpeza','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Lista do app antigo',null,920),
('Multiuso Veja','Limpeza','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Lista do app antigo',null,930),
('Catupiry','Laticínios','aberto',null,'Máximo 7 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Biblioteca do app antigo',null,940),
('Cheddar Fatiado','Laticínios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,950),
('Cream Cheese','Laticínios','aberto',null,'Máximo 7 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Biblioteca do app antigo',null,960),
('Creme de Leite','Laticínios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,970),
('Leite','Laticínios','aberto',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Biblioteca do app antigo',null,980),
('Manteiga','Laticínios','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,990),
('Margarina','Laticínios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','30',null,null,'Biblioteca do app antigo',null,1000),
('Queijo Azul','Laticínios','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1010),
('Queijo Cheddar','Laticínios','aberto',null,'Máximo 7 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Biblioteca do app antigo',null,1020),
('Requeijão','Laticínios','aberto',null,'Máximo 7 °C','Abaixo de -18 °C','Ambiente','5',null,null,'Biblioteca do app antigo',null,1030),
('Ketchup','Molhos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','20',null,null,'Biblioteca do app antigo',null,1040),
('Mostarda','Molhos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','20',null,null,'Biblioteca do app antigo',null,1050),
('Amendoim','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1060),
('Arroz','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1070),
('Açúcar Cristal','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1080),
('Açúcar Mascavo','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1090),
('Base para Sorvete','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1100),
('Cobertura de Caramelo','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1110),
('Cobertura de Chocolate','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1120),
('Farinha Panko','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1130),
('Farinha de Rosca','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1140),
('Farinha de Trigo','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1150),
('Farinha para Empanar','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1160),
('Farofa de Amendoim','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1170),
('Granola','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1180),
('Leite em Pó','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1190),
('Maionese','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Biblioteca do app antigo',null,1200),
('Sal Refinado','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1210),
('Vinagre','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'15','Biblioteca do app antigo',null,1220),
('Xarope Monin','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'90','Biblioteca do app antigo',null,1230),
('Óleo','Secos abertos','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'30','Biblioteca do app antigo',null,1240),
('Cebola','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1250),
('Couve Manteiga','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1260),
('Limão Tahiti','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1270),
('Maçã','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1280),
('Morango','Hortifruti','preparo',null,'Máximo 5 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1290),
('Pimenta Dedo de Moça','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1300),
('Salsa','Hortifruti','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1310),
('Anel de Cebola','Congelados','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1320),
('Batata Palito','Congelados','aberto',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1330),
('Hambúrguer Vegetariano','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1340),
('Nuggets de Frango','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1350),
('Polpa de Acerola','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1360),
('Polpa de Caju','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1370),
('Polpa de Tamarindo','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1380),
('Polpa de Umbu','Congelados','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1390),
('Pão Australiano','Pães','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1400),
('Pão Brioche','Pães','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1410),
('Pão Brioche (aberto)','Pães','aberto',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,null,'5','Biblioteca do app antigo',null,1420),
('Bacon','Carnes e frios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente',null,'90',null,'Biblioteca do app antigo',null,1430),
('Carne Moída','Carnes e frios','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','2','30',null,'Biblioteca do app antigo',null,1440),
('Carne Moída (descongelada)','Carnes e frios','descongelado',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Biblioteca do app antigo',null,1450),
('Carne Moída Temperada','Carnes e frios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Biblioteca do app antigo',null,1460),
('Filé de Frango Cozido','Carnes e frios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1470),
('Filé de Frango Empanado','Carnes e frios','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','1','30',null,'Biblioteca do app antigo',null,1480),
('Filé de Frango Temperado','Carnes e frios','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','2',null,null,'Biblioteca do app antigo',null,1490),
('Linguiça Toscana','Carnes e frios','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1500),
('Sorvete','Doces e sorvetes','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente',null,'30',null,'Biblioteca do app antigo',null,1510),
('Arroz Branco','Prontos','preparo',null,'Máximo 4 °C','Entre -12 e -18 °C','Ambiente','3','30',null,'Biblioteca do app antigo',null,1520),
('Ovo Cozido','Prontos','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1530),
('Purê de Batata','Prontos','preparo',null,'Máximo 4 °C','Abaixo de -18 °C','Ambiente','3',null,null,'Biblioteca do app antigo',null,1540),
('Suco Polpa de Fruta','Prontos','preparo',null,'Máximo 5 °C','Abaixo de -18 °C','Ambiente','1',null,null,'Biblioteca do app antigo',null,1550)
) as v(nome, grupo, tipo, produto, tr, tc, ta, dr, dc, da, base, obs, ordem);
