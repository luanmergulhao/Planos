-- Perfis, Planos, categorias e itens (tarefas numeradas por categoria)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles: espelha auth.users, criado automaticamente no signup/convite
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'manager')),
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- planos: 1 por pessoa
-- ---------------------------------------------------------------------
create table planos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  title text not null default 'Meu Plano',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- plano_categories: as linhas A, B, C ... G1 — dados, não enum fixo,
-- pra permitir evoluir as categorias sem alterar código
-- ---------------------------------------------------------------------
create table plano_categories (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  code text not null,       -- 'A', 'B', ... 'G1'
  label text not null,      -- 'PRÓX. DEADLINES', 'TRIAGEM', ...
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (plano_id, code)
);

-- ---------------------------------------------------------------------
-- plano_items: as tarefas de fato. item_number é sempre
-- max(item_number)+1 dentro da categoria, calculado atomicamente por
-- trigger (nunca digitado à mão) — código exibido = category.code || item_number
-- ---------------------------------------------------------------------
create table plano_items (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  category_id uuid not null references plano_categories(id) on delete cascade,
  item_number int not null,
  content jsonb not null default '{}'::jsonb,
  -- content shape (livre): { texto, data_prazo, link, status, responsavel }
  deadline_at date,   -- espelho de content.data_prazo, mantido pelo app em toda escrita
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'urgente')),
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, item_number)
);

create index idx_plano_items_plano on plano_items(plano_id);
create index idx_plano_items_deadline on plano_items(deadline_at) where deadline_at is not null;

create function set_plano_item_number()
returns trigger
language plpgsql
as $$
begin
  if new.item_number is null then
    select coalesce(max(item_number), 0) + 1
      into new.item_number
      from plano_items
      where category_id = new.category_id;
  end if;
  return new;
end;
$$;

create trigger trg_set_plano_item_number
  before insert on plano_items
  for each row execute function set_plano_item_number();

-- bump planos.updated_at/updated_by whenever an item changes — powers
-- the "editado por X há Y min" indicator without extra app-side writes
create function touch_plano()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  affected_plano_id uuid;
  actor uuid;
begin
  affected_plano_id := coalesce(new.plano_id, old.plano_id);
  actor := coalesce(new.updated_by, new.created_by, old.updated_by);
  update planos
     set updated_at = now(),
         updated_by = actor
   where id = affected_plano_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_touch_plano_on_item
  after insert or update or delete on plano_items
  for each row execute function touch_plano();

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_plano_items_updated_at
  before update on plano_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Categorias padrão (A–G1) criadas automaticamente pra todo Plano novo
-- ---------------------------------------------------------------------
create function seed_default_categories()
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
    (new.id, 'G', 'TAREFAS DO DIA / ABRIR', 7),
    (new.id, 'G1', 'INTELIGÊNCIA ARTIFICIAL', 8);
  return new;
end;
$$;

create trigger trg_seed_default_categories
  after insert on planos
  for each row execute function seed_default_categories();

-- ---------------------------------------------------------------------
-- toda pessoa nova ganha automaticamente 1 Plano com as categorias padrão
-- ---------------------------------------------------------------------
create function create_plano_for_new_profile()
returns trigger
language plpgsql
as $$
begin
  insert into planos (owner_id, title)
  values (new.id, 'Plano de ' || coalesce(new.full_name, new.email));
  return new;
end;
$$;

create trigger trg_create_plano_for_new_profile
  after insert on profiles
  for each row execute function create_plano_for_new_profile();
