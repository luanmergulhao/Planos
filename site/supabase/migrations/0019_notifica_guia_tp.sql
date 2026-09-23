-- Novo tipo de notificação: quando o sweep diário termina de rodar GUIA
-- e TP num edital (ver lib/ai/guia-tp.ts).

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mention', 'comment_reply', 'deadline_reminder', 'daily_digest', 'share_granted', 'resultado_encontrado', 'alinhamento_final', 'guia_tp_pronto'));
