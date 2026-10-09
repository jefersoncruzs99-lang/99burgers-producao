-- JÁ APLICADA no Supabase em 2026-10-09.
-- Correção de segurança do painel: o usuário edita o próprio nome, mas não o papel (admin/operator).
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;
