-- O Plano de vocês não é uma lista única que cresce pra sempre: cada
-- dia é uma cópia do dia anterior (sem o que foi riscado), e o
-- histórico de cada dia fica guardado e continua editável.

alter table plano_items add column day date not null default current_date;
alter table plano_items add column riscado boolean not null default false;

-- numeração (A1, B2...) agora é por categoria E por dia — cada dia
-- recomeça a copiar os números de onde o dia anterior parou, mas são
-- linhas novas (independentes) por trás
alter table plano_items drop constraint plano_items_category_id_item_number_key;
alter table plano_items add constraint plano_items_category_id_day_item_number_key
  unique (category_id, day, item_number);

drop index if exists idx_plano_items_plano;
create index idx_plano_items_plano_day on plano_items(plano_id, day);

create or replace function set_plano_item_number()
returns trigger
language plpgsql
as $$
begin
  if new.item_number is null then
    select coalesce(max(item_number), 0) + 1
      into new.item_number
      from plano_items
      where category_id = new.category_id
        and day = new.day;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- plano_days: marca o "alinhamento inicial" (começou o dia) e o
-- "alinhamento final" (fechou o dia) de cada dia de cada Plano.
-- ---------------------------------------------------------------------
create table plano_days (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  day date not null,
  alinhamento_inicial_at timestamptz,
  alinhamento_final_at timestamptz,
  started_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (plano_id, day)
);

alter table plano_days enable row level security;

create policy "plano_days_select" on plano_days
  for select to authenticated using (has_plano_access(plano_id));

create policy "plano_days_write" on plano_days
  for all to authenticated
  using (has_plano_access(plano_id, true))
  with check (has_plano_access(plano_id, true));

-- ---------------------------------------------------------------------
-- Riscar é decisão de quem gerencia (a CB), não de quem faz a tarefa —
-- "só excluímos do Planos quando eu risco, na versão copiada pro dia
-- seguinte" — então isso vira uma função própria, igual o resolver
-- de comentário.
-- ---------------------------------------------------------------------
create or replace function set_item_riscado(item_id uuid, new_riscado boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_plano_id uuid;
begin
  if not is_manager() then
    raise exception 'só quem é manager pode riscar uma tarefa';
  end if;

  select plano_id into target_plano_id from plano_items where id = item_id;
  if target_plano_id is null then
    raise exception 'tarefa não encontrada';
  end if;

  if not has_plano_access(target_plano_id) then
    raise exception 'sem acesso a esse Plano';
  end if;

  update plano_items set riscado = new_riscado where id = item_id;
end;
$$;
