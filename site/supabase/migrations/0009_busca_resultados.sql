-- Busca de resultados com IA (prompt "R" do manual): pra editais já
-- enviados (fase D/DP), guarda o último resultado que a IA achou
-- pesquisando na internet, e um tipo novo de notificação pra avisar o
-- time quando encontrar algo novo.

alter table editais add column resultado_info jsonb;

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mention', 'comment_reply', 'deadline_reminder', 'daily_digest', 'share_granted', 'resultado_encontrado'));
