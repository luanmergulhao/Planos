-- Coluna C do Plano — EMAIL DE/PARA CB.
-- Guarda quais e-mails já viraram tarefa no Plano, pra o mesmo e-mail
-- não ser resumido e adicionado de novo todo dia.

create table if not exists email_resumos (
  -- id do próprio e-mail (Message-ID), que não muda
  message_id text primary key,
  plano_item_id uuid references plano_items(id) on delete set null,
  assunto text not null,
  data_email date not null,
  tarefa text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_email_resumos_data on email_resumos(data_email desc);

alter table email_resumos enable row level security;

-- a equipe lê; quem grava é o servidor, que é quem lê a caixa de e-mail
drop policy if exists "email_resumos_select_all" on email_resumos;
create policy "email_resumos_select_all" on email_resumos
  for select to authenticated using (true);
