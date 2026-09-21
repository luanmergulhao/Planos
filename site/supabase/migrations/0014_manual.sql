-- Manual da equipe dentro do site.
--
-- Somente leitura: ninguém escreve nessas tabelas pelo site, só o script de
-- importação (chave de serviço), a partir do .docx do Google Docs.
--
-- As senhas do manual NÃO ficam no texto: o script tira cada senha do HTML,
-- deixa um marcador no lugar e guarda o valor em manual_segredos, que só
-- quem tem profiles.pode_ver_segredos consegue ler (a política vale no
-- banco, não só na tela).

create table manual_secoes (
  id uuid primary key default gen_random_uuid(),
  ordem int not null,
  grupo text,               -- nome da aba do Google, quando a seção fica dentro de uma
  titulo text not null,
  html text not null,
  em_revisao boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create index idx_manual_secoes_ordem on manual_secoes(ordem);

create table manual_segredos (
  id int primary key,
  secao_id uuid not null references manual_secoes(id) on delete cascade,
  valor text not null
);

-- quem pode ver as senhas: a CB (manager) por padrão; o resto é liberado
-- à mão, pessoa por pessoa, e cada um NÃO consegue se liberar sozinho
-- (o update em profiles só aceita full_name e avatar_url — ver 0005).
alter table profiles add column pode_ver_segredos boolean not null default false;
update profiles set pode_ver_segredos = true where role = 'manager';

alter table manual_secoes enable row level security;
alter table manual_segredos enable row level security;

create policy "manual_secoes_select" on manual_secoes
  for select to authenticated using (true);

create policy "manual_segredos_select" on manual_segredos
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.pode_ver_segredos));
