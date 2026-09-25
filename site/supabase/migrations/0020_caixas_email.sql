-- Contas de e-mail por Plano: cada Plano lê uma ou mais caixas do Google
-- (pela senha de app) e traz pra linha C o que os remetentes da lista
-- mandaram — por padrão, os dois e-mails da CB.
--
-- A senha de app fica cifrada pelo servidor (lib/email/cripto.ts) e a
-- tabela não tem policy nenhuma: só o servidor (service role) lê e grava.
-- A tela pede a lista pela API, que nunca devolve a senha.

create table if not exists plano_caixas_email (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  email text not null,
  senha_cifrada text not null,
  remetentes text[] not null default array['candida.dnarchiveproject@gmail.com', 'candida@transeuntismundi.com'],
  ultima_leitura_at timestamptz,
  ultimo_erro text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (plano_id, email)
);

alter table plano_caixas_email enable row level security;

-- O mesmo e-mail pode chegar em Planos diferentes (a CB manda pra mais de
-- uma conta): o "já resumido" passa a ser por Plano, não global.
alter table email_resumos add column if not exists plano_id uuid references planos(id) on delete cascade;

update email_resumos r
set plano_id = i.plano_id
from plano_items i
where i.id = r.plano_item_id and r.plano_id is null;

alter table email_resumos drop constraint if exists email_resumos_pkey;
create unique index if not exists email_resumos_msg_plano
  on email_resumos (message_id, plano_id) nulls not distinct;
