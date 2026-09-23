-- Quando alguém finaliza o dia (ALINHAMENTO FINAL), avisa quem é manager
-- (a CB) — vira uma notification normal, então passa pelo mesmo roteamento
-- de canal (in-app, e-mail, whatsapp) que menção/comentário já usam. Não
-- avisa o próprio manager quando ele finaliza o Plano dele mesmo.

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mention', 'comment_reply', 'deadline_reminder', 'daily_digest', 'share_granted', 'resultado_encontrado', 'alinhamento_final'));

create function handle_alinhamento_final()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  dono uuid;
  nome_dono text;
  link text;
  destinatario record;
begin
  -- só dispara na transição pra finalizado (não em toda atualização da linha)
  if new.alinhamento_final_at is null or (tg_op = 'UPDATE' and old.alinhamento_final_at is not null) then
    return new;
  end if;

  select owner_id into dono from planos where id = new.plano_id;
  select coalesce(full_name, email) into nome_dono from profiles where id = dono;
  link := '/planos/' || new.plano_id || '?dia=' || new.day;

  for destinatario in select id from profiles where role = 'manager' and id <> dono loop
    insert into notifications (user_id, type, title, body, link_path)
    values (
      destinatario.id,
      'alinhamento_final',
      'Alinhamento final — ' || coalesce(nome_dono, '?'),
      'O Plano de ' || coalesce(nome_dono, '?') || ' foi finalizado hoje (' || to_char(new.day, 'DD/MM') || ').',
      link
    );
  end loop;

  return new;
end;
$$;

create trigger trg_handle_alinhamento_final
  after insert or update on plano_days
  for each row execute function handle_alinhamento_final();
