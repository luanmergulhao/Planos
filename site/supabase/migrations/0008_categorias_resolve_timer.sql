-- 1) Categoria G1 (Inteligência Artificial) era uma tarefa, não uma
-- categoria própria — o Plano vai só de A a G daqui pra frente.
create or replace function seed_default_categories()
returns trigger
language plpgsql
as $$
begin
  insert into plano_categories (plano_id, code, label, sort_order) values
    (new.id, 'A', 'PRÓX. DEADLINES', 1),
    (new.id, 'B', 'BUSCA R', 2),
    (new.id, 'C', 'EMAIL DE/PARA CB', 3),
    (new.id, 'D', 'INCÊNDIO', 4),
    (new.id, 'E', 'TRIAGEM', 5),
    (new.id, 'F', 'TAREFAS RÁPIDAS', 6),
    (new.id, 'G', 'TAREFAS DO DIA / ABRIR', 7);
  return new;
end;
$$;

-- remove a categoria G1 de Planos que já existem (e as tarefas dela
-- junto, via cascade — só existe enquanto era teste)
delete from plano_categories where code = 'G1';

-- ---------------------------------------------------------------------
-- 2) "Nunca aplicar RESOLVIDO, apenas a CB pode fazer" — só manager
-- resolve/reabre comentário, não qualquer um com acesso.
-- ---------------------------------------------------------------------
create or replace function toggle_comment_resolved(comment_id uuid, new_resolved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_plano_id uuid;
begin
  if not is_manager() then
    raise exception 'só quem é manager pode marcar como resolvido';
  end if;

  select plano_id into target_plano_id from comments where id = comment_id;

  if target_plano_id is null then
    raise exception 'comentário não encontrado';
  end if;

  if not has_plano_access(target_plano_id) then
    raise exception 'sem acesso a esse Plano';
  end if;

  update comments set resolved = new_resolved where id = comment_id;
end;
$$;

create or replace function toggle_edital_comment_resolved(comment_id uuid, new_resolved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_manager() then
    raise exception 'só quem é manager pode marcar como resolvido';
  end if;

  update edital_comments set resolved = new_resolved where id = comment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Cronômetro por tarefa (substitui o Toggl) — nome da tarefa +
-- início/fim. Diferente de time_logs (que é a sessão de login/logout):
-- isso é granular, por atividade, ligado/desligado manualmente.
-- ---------------------------------------------------------------------
create table task_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  description text not null,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_task_time_entries_user_started on task_time_entries(user_id, started_at desc);
-- só 1 cronômetro rodando por pessoa por vez
create unique index idx_task_time_entries_one_running_per_user
  on task_time_entries(user_id) where stopped_at is null;

alter table task_time_entries enable row level security;

create policy "task_time_entries_select" on task_time_entries
  for select to authenticated using (user_id = auth.uid() or is_manager());

create policy "task_time_entries_write_self" on task_time_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
