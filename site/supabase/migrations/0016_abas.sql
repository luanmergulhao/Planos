-- Abas extras dentro de um Plano: blocos de notas com nome próprio, pra
-- escrever algo à parte (por exemplo, um prompt pra CB avaliar). Não são
-- por dia, como as tarefas: a aba é do Plano inteiro.
--
-- Quem vê o Plano vê as abas; só quem pode editar o Plano cria, edita e
-- apaga aba (mesma regra das tarefas).

create table plano_abas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  titulo text not null default 'Nova aba',
  conteudo text not null default '',
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_plano_abas_plano on plano_abas(plano_id, sort_order);

create trigger trg_plano_abas_updated_at
  before update on plano_abas
  for each row execute function set_updated_at();

alter table plano_abas enable row level security;

create policy "plano_abas_select" on plano_abas
  for select to authenticated using (has_plano_access(plano_id));

create policy "plano_abas_write" on plano_abas
  for all to authenticated
  using (has_plano_access(plano_id, true))
  with check (has_plano_access(plano_id, true));
