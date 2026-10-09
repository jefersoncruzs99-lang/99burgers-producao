-- JÁ APLICADA no Supabase em 2026-10-09.
-- Mesmo padrão do painel: usuários logados (dono e líder) têm acesso total.
-- O tablet NÃO acessa as tabelas direto: usa as funções prod_cozinha_* (exigem o código da cozinha).

alter table public.prod_setores            enable row level security;
alter table public.prod_colaboradores      enable row level security;
alter table public.prod_produtos           enable row level security;
alter table public.prod_fichas_tecnicas    enable row level security;
alter table public.prod_ficha_ingredientes enable row level security;
alter table public.prod_modelos_tarefa     enable row level security;
alter table public.prod_tarefas            enable row level security;
alter table public.prod_evidencias         enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'prod_setores','prod_colaboradores','prod_produtos','prod_fichas_tecnicas',
    'prod_ficha_ingredientes','prod_modelos_tarefa','prod_tarefas','prod_evidencias'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_auth_all', t
    );
  end loop;
end $$;
