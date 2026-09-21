-- Espelho das planilhas do Drive (inscritos e triagem).
--
-- Quem escreve aqui é só a rota /api/sync/planilha (chave de serviço),
-- chamada por um script dentro da própria planilha. As colunas de login e
-- senha são cortadas antes de sair da planilha e de novo na rota.
--
-- Guarda cada linha como jsonb {cabeçalho: valor} pra não depender de
-- saber as colunas de antemão; depois a gente mapeia pro quadro `editais`.

create table planilhas_linhas (
  planilha text not null check (planilha in ('inscritos', 'triagem')),
  aba text not null,
  linha int not null,             -- número da linha na aba do Google
  dados jsonb not null,
  sincronizado_em timestamptz not null default now(),
  primary key (planilha, aba, linha)
);

create table planilhas_sync (
  planilha text primary key check (planilha in ('inscritos', 'triagem')),
  ultima_sync timestamptz not null default now(),
  -- { "Nome da aba": { "linhas": 120, "colunas": [...], "descartadas": [...] } }
  abas jsonb not null default '{}'::jsonb
);

alter table planilhas_linhas enable row level security;
alter table planilhas_sync enable row level security;

create policy "planilhas_linhas_select" on planilhas_linhas
  for select to authenticated using (true);

create policy "planilhas_sync_select" on planilhas_sync
  for select to authenticated using (true);
