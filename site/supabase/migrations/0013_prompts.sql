-- Os prompts da IA saem de dentro do código e passam a morar aqui, pra
-- a equipe ler e editar pelo site sem depender de quem programa.
-- Se um prompt for apagado, o código volta a usar o texto padrão.

create table if not exists prompts (
  id text primary key,
  nome text not null,
  descricao text,
  conteudo text not null,
  -- nomes que podem ser usados como {{variavel}} dentro do texto
  variaveis text[] not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table prompts enable row level security;

-- a equipe toda lê e edita: é o conteúdo do trabalho delas, não
-- configuração de sistema
drop policy if exists "prompts_select_all" on prompts;
create policy "prompts_select_all" on prompts
  for select to authenticated using (true);

drop policy if exists "prompts_write" on prompts;
create policy "prompts_write" on prompts
  for all to authenticated using (true) with check (true);
