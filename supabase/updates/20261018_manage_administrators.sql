-- Add administrator-management safeguards and detailed audit events to an
-- existing Housing Transition Assistance project.

begin;

create or replace function public.update_user_permissions(
  p_user_id uuid,
  p_role text,
  p_approved boolean,
  p_active boolean
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  target public.profiles%rowtype;
  admin_count integer;
begin
  perform pg_advisory_xact_lock(8246792);
  if actor.role <> 'admin' then raise exception 'Administrator access required.'; end if;
  if p_role not in ('supporter', 'social_worker', 'admin') then raise exception 'Invalid role.'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found.'; end if;
  if target.id = actor.id and (p_role <> 'admin' or not p_active) then
    raise exception 'Ask another active administrator to change your administrator access.';
  end if;
  if target.role = 'admin' and target.active and
    (p_role <> 'admin' or not p_active) then
    select count(*) into admin_count from public.profiles
    where role = 'admin' and active = true;
    if admin_count <= 1 then raise exception 'Keep at least one active administrator.'; end if;
  end if;

  update public.profiles set role = p_role,
    approved = case when p_role = 'social_worker' then p_approved else true end,
    active = p_active, updated_at = now()
  where id = p_user_id;
  perform public._audit(actor.id,
    case
      when target.role <> 'admin' and p_role = 'admin'
        then 'user.administrator_granted'
      when target.role = 'admin' and p_role <> 'admin'
        then 'user.administrator_removed'
      else 'user.permissions_updated'
    end,
    null,
    jsonb_build_object(
      'userId', p_user_id,
      'previousRole', target.role,
      'role', p_role,
      'previousApproved', target.approved,
      'approved', case when p_role = 'social_worker' then p_approved else true end,
      'previousActive', target.active,
      'active', p_active
    ));
end;
$$;

notify pgrst, 'reload schema';
commit;
