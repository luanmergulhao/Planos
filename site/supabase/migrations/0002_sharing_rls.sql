-- Compartilhamento: quem além do dono pode ver/editar um Plano
-- (as políticas de RLS que aplicam isso ficam em 0005_rls_policies.sql,
-- depois que todas as tabelas relevantes já existirem)

create table plano_shares (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  permission text not null check (permission in ('view', 'edit')),
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (plano_id, user_id)
);

create index idx_plano_shares_user on plano_shares(user_id);
