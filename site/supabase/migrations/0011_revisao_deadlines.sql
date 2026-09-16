-- Revisão de prorrogação dos deadlines D/DP da linha A.
-- A equipe já fazia isso à mão, anotando "revisado DD/MM" na descrição
-- do evento no Google Agenda. Aqui a IA confere — sozinha uma vez por
-- dia, ou na hora, pelo botão que fica ao lado de cada deadline.

create table if not exists deadline_revisoes (
  id uuid primary key default gen_random_uuid(),
  -- título normalizado (sem prefixo D/DP, datas e horários), pra a
  -- revisão continuar ligada ao edital quando a equipe renomeia o
  -- evento de D pra DP ou troca a data no título
  chave_evento text not null,
  titulo_evento text not null,
  deadline_agenda date not null,
  link_consultado text,
  status text not null check (status in ('mantido', 'prorrogado', 'encerrado', 'nao_confirmado')),
  novo_deadline date,
  novo_deadline_texto text,
  evidencia text,
  fonte_link text,
  revisado_em timestamptz not null default now(),
  revisado_dia date not null,
  unique (chave_evento, deadline_agenda, revisado_dia)
);

create index if not exists idx_deadline_revisoes_dia on deadline_revisoes(revisado_dia desc);

-- O link do edital, colado uma vez ao lado do deadline na linha A e
-- reaproveitado em todas as conferências seguintes.
create table if not exists deadline_links (
  chave_evento text primary key,
  link text not null,
  updated_at timestamptz not null default now()
);

alter table deadline_revisoes enable row level security;
alter table deadline_links enable row level security;

-- revisão: a equipe lê; quem grava é o servidor, que é quem chama a IA
drop policy if exists "deadline_revisoes_select_all" on deadline_revisoes;
create policy "deadline_revisoes_select_all" on deadline_revisoes
  for select to authenticated using (true);

-- link: a equipe inteira lê e grava, igual ao quadro de Editais
drop policy if exists "deadline_links_select_all" on deadline_links;
drop policy if exists "deadline_links_insert" on deadline_links;
drop policy if exists "deadline_links_update" on deadline_links;
drop policy if exists "deadline_links_delete" on deadline_links;
drop policy if exists "deadline_links_write" on deadline_links;

create policy "deadline_links_select_all" on deadline_links
  for select to authenticated using (true);

create policy "deadline_links_write" on deadline_links
  for all to authenticated using (true) with check (true);

-- um link que já sabemos, pra não começar do zero
insert into deadline_links (chave_evento, link)
values ('firjan mosaico rio 2027 multilinguagens', 'https://www.firjan.com.br/editaisculturais')
on conflict (chave_evento) do nothing;
