-- Comentários ancorados + menções, caixa de notificação, camada de
-- canal de entrega (email hoje, whatsapp reservado pra fase 2) e o
-- log de dedupe dos lembretes de prazo.

create table comments (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  plano_item_id uuid references plano_items(id) on delete cascade,
  category_id uuid references plano_categories(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  parent_comment_id uuid references comments(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plano_item_id is not null or category_id is not null)
);

create index idx_comments_plano on comments(plano_id);
create index idx_comments_item on comments(plano_item_id);

create trigger trg_comments_updated_at
  before update on comments
  for each row execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('mention', 'comment_reply', 'deadline_reminder', 'daily_digest', 'share_granted')),
  title text not null,
  body text,
  link_path text,
  source_comment_id uuid references comments(id) on delete cascade,
  source_plano_item_id uuid references plano_items(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread on notifications(user_id, read_at);

create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  digest_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false, -- reservado pra fase 2
  phone_number text
);

create function create_default_notification_preferences()
returns trigger
language plpgsql
as $$
begin
  insert into notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger trg_default_notification_preferences
  after insert on profiles
  for each row execute function create_default_notification_preferences();

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  channel text not null check (channel in ('inapp', 'email', 'whatsapp')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')) default 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table deadline_notifications_log (
  plano_item_id uuid not null references plano_items(id) on delete cascade,
  days_before int not null,
  sent_on date not null,
  primary key (plano_item_id, days_before, sent_on)
);

-- Ao inserir um comentário: notifica cada mencionado + o dono do Plano
-- (se não for o autor). Roda no banco, então funciona não importa por
-- onde o comentário entrou (app, script, SQL manual).
create function handle_new_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mentioned uuid;
  plano_owner uuid;
  link text;
begin
  select owner_id into plano_owner from planos where id = new.plano_id;
  link := '/planos/' || new.plano_id || '?comment=' || new.id;

  foreach mentioned in array new.mentioned_user_ids loop
    if mentioned <> new.author_id then
      insert into notifications (user_id, type, title, body, link_path, source_comment_id, source_plano_item_id)
      values (mentioned, 'mention', 'Você foi marcado num comentário', left(new.body, 200), link, new.id, new.plano_item_id);
    end if;
  end loop;

  if plano_owner is not null and plano_owner <> new.author_id
     and not (plano_owner = any(new.mentioned_user_ids)) then
    insert into notifications (user_id, type, title, body, link_path, source_comment_id, source_plano_item_id)
    values (plano_owner, 'comment_reply', 'Novo comentário no seu Plano', left(new.body, 200), link, new.id, new.plano_item_id);
  end if;

  return new;
end;
$$;

create trigger trg_handle_new_comment
  after insert on comments
  for each row execute function handle_new_comment();
