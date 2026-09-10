-- Quadro compartilhado de Triagem/Pesquisa de Edital — diferente dos
-- Planos (que são por pessoa), isso é visto e editado pela equipe
-- toda, sem depender de compartilhar o Plano de ninguém.

create table editais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  link text,
  -- T = em triagem · D = deadline normal (edital já aberto) ·
  -- DP = deadline prorrogado · CONCLUIDO = já submetido ·
  -- DESCARTADO = decidiram não seguir com esse edital
  fase text not null default 'T' check (fase in ('T', 'D', 'DP', 'CONCLUIDO', 'DESCARTADO')),
  deadline_at date,
  observacoes text,
  -- perguntas/respostas da triagem assistida por IA (fase futura) —
  -- reservado agora pra não precisar de outra migration depois
  respostas jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_editais_deadline on editais(deadline_at) where deadline_at is not null;

create trigger trg_editais_updated_at
  before update on editais
  for each row execute function set_updated_at();

-- dedupe do lembrete de prazo do cron — tabela própria (não reusa
-- deadline_notifications_log porque aquela tem FK pra plano_items)
create table edital_deadline_notifications_log (
  edital_id uuid not null references editais(id) on delete cascade,
  days_before int not null,
  sent_on date not null,
  primary key (edital_id, days_before, sent_on)
);

-- ---------------------------------------------------------------------
-- comentários dos editais — mesma cara dos comentários de Plano
-- (resposta encadeada, menção, resolver), só que sem dono de Plano:
-- qualquer um da equipe comenta e resolve.
-- ---------------------------------------------------------------------
create table edital_comments (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references editais(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  parent_comment_id uuid references edital_comments(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_edital_comments_edital on edital_comments(edital_id);

create trigger trg_edital_comments_updated_at
  before update on edital_comments
  for each row execute function set_updated_at();

create function handle_new_edital_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mentioned uuid;
  edital_title text;
  link text;
begin
  select titulo into edital_title from editais where id = new.edital_id;
  link := '/editais?comment=' || new.id;

  foreach mentioned in array new.mentioned_user_ids loop
    if mentioned <> new.author_id then
      insert into notifications (user_id, type, title, body, link_path, source_comment_id)
      values (mentioned, 'mention', 'Você foi marcado num edital', left(new.body, 200), link, new.id);
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_handle_new_edital_comment
  after insert on edital_comments
  for each row execute function handle_new_edital_comment();

create or replace function toggle_edital_comment_resolved(comment_id uuid, new_resolved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update edital_comments set resolved = new_resolved where id = comment_id;
end;
$$;

revoke all on function toggle_edital_comment_resolved(uuid, boolean) from public;
grant execute on function toggle_edital_comment_resolved(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- RLS — time todo autenticado vê e edita; apagar é só de quem criou
-- ou de manager (única fricção, pra evitar exclusão em massa acidental)
-- ---------------------------------------------------------------------
alter table editais enable row level security;

create policy "editais_select_all" on editais
  for select to authenticated using (true);

create policy "editais_insert" on editais
  for insert to authenticated with check (created_by = auth.uid());

create policy "editais_update" on editais
  for update to authenticated using (true) with check (true);

create policy "editais_delete_own_or_manager" on editais
  for delete to authenticated using (created_by = auth.uid() or is_manager());

-- tabela interna do cron — sem policy pra authenticated = acesso negado
alter table edital_deadline_notifications_log enable row level security;

alter table edital_comments enable row level security;

create policy "edital_comments_select_all" on edital_comments
  for select to authenticated using (true);

create policy "edital_comments_insert" on edital_comments
  for insert to authenticated with check (author_id = auth.uid());

create policy "edital_comments_update_own" on edital_comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "edital_comments_delete_own" on edital_comments
  for delete to authenticated using (author_id = auth.uid());
