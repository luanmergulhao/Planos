-- A CB (manager) passa a ver o Plano de qualquer pessoa, sem precisar que
-- cada dono compartilhe o próprio Plano com ela à mão. Só leitura: manager
-- não ganha edição do Plano de outra pessoa por causa disso (require_edit
-- continua exigindo dono ou plano_shares com permission='edit').
--
-- Como has_plano_access() é a mesma função usada em planos/plano_categories/
-- plano_items/plano_abas, um único create or replace já vale pras quatro.

create or replace function has_plano_access(target_plano_id uuid, require_edit boolean default false)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from planos p
    where p.id = target_plano_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from plano_shares s
          where s.plano_id = p.id
            and s.user_id = auth.uid()
            and (not require_edit or s.permission = 'edit')
        )
        or (not require_edit and is_manager())
      )
  );
$$;
