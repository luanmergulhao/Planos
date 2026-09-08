-- Ponto: 1 linha por sessão logada, mais as views que calculam horas
-- trabalhadas por dia/mês sem esperar a varredura diária do cron.

create table time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  last_seen_at timestamptz not null default now(),
  end_reason text check (end_reason in ('logout', 'timeout', 'still_open')) not null default 'still_open',
  created_at timestamptz not null default now()
);

create index idx_time_logs_user_clockin on time_logs(user_id, clock_in_at desc);
-- só pode existir 1 sessão "ainda aberta" por pessoa por vez
create unique index idx_time_logs_one_open_per_user
  on time_logs(user_id) where clock_out_at is null;

-- Depois de N minutos sem heartbeat, uma sessão aberta é tratada como
-- encerrada no último heartbeat, mesmo antes do cron diário confirmar
-- isso — os números de hora já saem certos na hora de consultar.
create function heartbeat_timeout_minutes()
returns int language sql immutable as $$ select 6 $$;

-- security_invoker=true é essencial aqui: sem isso, a view roda com o
-- privilégio de quem a criou (bypassando a RLS de time_logs) e
-- qualquer pessoa autenticada veria as horas de todo mundo. Com
-- security_invoker, a RLS de time_logs (dono vê só o próprio, manager
-- vê de todos) se aplica normalmente a quem está consultando a view.
create view time_logs_effective
  with (security_invoker = true) as
select
  tl.*,
  coalesce(
    tl.clock_out_at,
    case
      when tl.last_seen_at < now() - (heartbeat_timeout_minutes() || ' minutes')::interval
        then tl.last_seen_at
    end
  ) as effective_clock_out
from time_logs tl;

create view daily_hours
  with (security_invoker = true) as
select
  user_id,
  (clock_in_at at time zone 'America/Sao_Paulo')::date as day,
  sum(effective_clock_out - clock_in_at) as worked
from time_logs_effective
where effective_clock_out is not null
group by 1, 2;

create view monthly_hours
  with (security_invoker = true) as
select
  user_id,
  date_trunc('month', clock_in_at at time zone 'America/Sao_Paulo') as month,
  sum(effective_clock_out - clock_in_at) as worked
from time_logs_effective
where effective_clock_out is not null
group by 1, 2;
