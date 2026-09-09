-- Resolver/reabrir uma thread de comentário precisa ser possível pra
-- qualquer um com acesso ao Plano (ex: o dono resolvendo um comentário
-- que outra pessoa deixou), não só pelo autor do comentário — mas sem
-- abrir a porta pra qualquer um editar o TEXTO do comentário dos
-- outros. RLS por coluna não dá pra condicionar por linha, então isso
-- vira uma função dedicada em vez de um update direto na tabela.

create or replace function toggle_comment_resolved(comment_id uuid, new_resolved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_plano_id uuid;
begin
  select plano_id into target_plano_id from comments where id = comment_id;

  if target_plano_id is null then
    raise exception 'comentário não encontrado';
  end if;

  if not has_plano_access(target_plano_id) then
    raise exception 'sem acesso a esse Plano';
  end if;

  update comments set resolved = new_resolved where id = comment_id;
end;
$$;

revoke all on function toggle_comment_resolved(uuid, boolean) from public;
grant execute on function toggle_comment_resolved(uuid, boolean) to authenticated;
