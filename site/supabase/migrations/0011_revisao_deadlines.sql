-- Revisão diária de prorrogação dos deadlines D/DP da linha A.
-- A equipe já fazia isso à mão, anotando "revisado DD/MM" na descrição
-- do evento no Google Agenda. Aqui a IA confere todo dia sozinha e o
-- resultado aparece dentro da própria linha A do Plano.

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

-- Cache do link de cada edital. Ninguém preenche isso na mão: o site
-- casa o evento da agenda com o edital já cadastrado no quadro de
-- Editais (que a Triagem preenche com link) e guarda aqui pra não
-- precisar procurar de novo todo dia.
create table if not exists deadline_links (
  chave_evento text primary key,
  link text not null,
  updated_at timestamptz not null default now()
);

alter table deadline_revisoes enable row level security;
alter table deadline_links enable row level security;

-- leitura pra equipe; escrita só pelo servidor (service role), que é
-- quem roda a revisão
drop policy if exists "deadline_revisoes_select_all" on deadline_revisoes;
create policy "deadline_revisoes_select_all" on deadline_revisoes
  for select to authenticated using (true);

drop policy if exists "deadline_links_select_all" on deadline_links;
drop policy if exists "deadline_links_insert" on deadline_links;
drop policy if exists "deadline_links_update" on deadline_links;
drop policy if exists "deadline_links_delete" on deadline_links;
create policy "deadline_links_select_all" on deadline_links
  for select to authenticated using (true);

-- um link que já sabemos, pra primeira revisão não sair vazia
insert into deadline_links (chave_evento, link)
values ('firjan mosaico rio 2027 multilinguagens', 'https://www.firjan.com.br/editaisculturais')
on conflict (chave_evento) do nothing;
