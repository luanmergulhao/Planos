-- Revisão diária de prorrogação dos deadlines da agenda (D/DP).
-- A equipe já fazia isso à mão, anotando "revisado DD/MM" na descrição
-- do evento no Google Agenda; aqui a IA confere e o resultado de cada
-- dia fica guardado.

create table deadline_revisoes (
  id uuid primary key default gen_random_uuid(),
  -- título normalizado (sem prefixo D/DP, datas e horários), pra a
  -- mesma revisão continuar ligada ao edital quando a equipe renomeia
  -- o evento de D pra DP ou troca a data no título
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

create index idx_deadline_revisoes_dia on deadline_revisoes(revisado_dia desc);

-- A agenda não guarda o link do edital, então ele é cadastrado uma vez
-- pela equipe e reaproveitado em todas as revisões seguintes.
create table deadline_links (
  chave_evento text primary key,
  link text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table deadline_revisoes enable row level security;

create policy "deadline_revisoes_select_all" on deadline_revisoes
  for select to authenticated using (true);
-- sem policy de escrita: só o servidor (service role) grava revisão

alter table deadline_links enable row level security;

create policy "deadline_links_select_all" on deadline_links
  for select to authenticated using (true);

create policy "deadline_links_insert" on deadline_links
  for insert to authenticated with check (updated_by = auth.uid());

create policy "deadline_links_update" on deadline_links
  for update to authenticated using (true) with check (updated_by = auth.uid());

create policy "deadline_links_delete" on deadline_links
  for delete to authenticated using (true);
