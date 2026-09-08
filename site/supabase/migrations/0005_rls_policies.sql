-- Modelo de permissão aplicado no banco (não só na aplicação). Regras:
--   * dono ou quem tem plano_shares vê o Plano (categorias/itens/comentários)
--   * só dono ou compartilhado com 'edit' altera conteúdo
--   * só o dono do Plano gerencia quem tem acesso (plano_shares)
--   * quem vê o Plano pode comentar, mesmo em modo 'view' (igual Google Docs)
--   * cada um só lê/edita suas próprias time_logs, exceto managers (veem de todos)
--   * notifications só são lidas/atualizadas pelo próprio destinatário —
--     inseridas só por código de servidor (triggers security definer ou service role)

create or replace function has_plano_access(target_plano_id uuid, require_edit boolean default false)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from planos p
    where p.id = target_plano_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from plano_shares s
          where s.plano_id = p.id
            and s.user_id = auth.uid()
            and (not require_edit or s.permission = 'edit')
        )
      )
  );
$$;

create or replace function is_manager()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select role = 'manager' from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_all_authenticated" on profiles
  for select to authenticated using (true);

create policy "profiles_update_self" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke update on profiles from authenticated;
grant update (full_name, avatar_url) on profiles to authenticated;

-- ---------------------------------------------------------------------
-- planos
-- ---------------------------------------------------------------------
alter table planos enable row level security;

create policy "planos_select" on planos
  for select to authenticated
  using (owner_id = auth.uid() or has_plano_access(id));

create policy "planos_update_owner" on planos
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- plano_categories
-- ---------------------------------------------------------------------
alter table plano_categories enable row level security;

create policy "plano_categories_select" on plano_categories
  for select to authenticated using (has_plano_access(plano_id));

create policy "plano_categories_write" on plano_categories
  for all to authenticated
  using (has_plano_access(plano_id, true))
  with check (has_plano_access(plano_id, true));

-- ---------------------------------------------------------------------
-- plano_items
-- ---------------------------------------------------------------------
alter table plano_items enable row level security;

create policy "plano_items_select" on plano_items
  for select to authenticated using (has_plano_access(plano_id));

create policy "plano_items_write" on plano_items
  for all to authenticated
  using (has_plano_access(plano_id, true))
  with check (has_plano_access(plano_id, true));

-- ---------------------------------------------------------------------
-- plano_shares — só o dono do Plano concede/revoga acesso; o
-- convidado só enxerga a própria linha
-- ---------------------------------------------------------------------
alter table plano_shares enable row level security;

create policy "plano_shares_select" on plano_shares
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from planos p where p.id = plano_id and p.owner_id = auth.uid())
  );

create policy "plano_shares_manage_owner" on plano_shares
  for all to authenticated
  using (exists (select 1 from planos p where p.id = plano_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from planos p where p.id = plano_id and p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------
-- time_logs — cada um só mexe no próprio ponto; manager lê de todos
-- ---------------------------------------------------------------------
alter table time_logs enable row level security;

create policy "time_logs_select" on time_logs
  for select to authenticated using (user_id = auth.uid() or is_manager());

create policy "time_logs_write_self" on time_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- comments — quem vê o Plano pode comentar (mesmo em modo view);
-- só o autor edita/apaga o próprio comentário
-- ---------------------------------------------------------------------
alter table comments enable row level security;

create policy "comments_select" on comments
  for select to authenticated using (has_plano_access(plano_id));

create policy "comments_insert" on comments
  for insert to authenticated
  with check (has_plano_access(plano_id) and author_id = auth.uid());

create policy "comments_update_own" on comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "comments_delete_own" on comments
  for delete to authenticated using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- notifications — só o destinatário lê/marca como lida; inserção é só
-- via trigger security definer (comentários) ou service role (cron)
-- ---------------------------------------------------------------------
alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update_own" on notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

-- ---------------------------------------------------------------------
-- notification_preferences — cada um só vê/edita a própria
-- ---------------------------------------------------------------------
alter table notification_preferences enable row level security;

create policy "notification_preferences_self" on notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_deliveries e deadline_notifications_log são tabelas
-- internas do sistema de automação — só o service role (cron, webhook)
-- mexe nelas; sem policy pra 'authenticated' = acesso negado por padrão.
alter table notification_deliveries enable row level security;
alter table deadline_notifications_log enable row level security;
