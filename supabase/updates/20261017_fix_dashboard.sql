-- For an existing development project: replace only the dashboard function.
-- New projects should use the complete supabase/schema.sql instead.
begin;

create or replace function public.list_requests(
  p_status text default 'open',
  p_search text default ''
)
returns table (
  id text,
  number text,
  owner_id uuid,
  summary text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  owner_name text,
  needed text,
  committed text,
  received text
)
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
begin
  if p_status not in ('open', 'closed', 'all') then p_status := 'open'; end if;
  return query
  select r.id::text, r.number, r.owner_id, r.summary, r.status,
    r.created_at, r.updated_at,
    case when actor.role = 'admin' or r.owner_id = actor.id
      then p.first_name || ' ' || p.last_name else '' end,
    sum(i.quantity)::text,
    coalesce(sum(c.committed), 0)::text,
    coalesce(sum(c.received), 0)::text
  from public.requests r
  join public.profiles p on p.id = r.owner_id
  join public.request_items i on i.request_id = r.id
  left join (
    select cm.item_id, sum(cm.quantity) as committed, sum(cm.received) as received
    from public.commitments cm group by cm.item_id
  ) c on c.item_id = i.id
  where (p_status = 'all' or r.status = p_status)
    and (r.number ilike '%' || left(coalesce(p_search, ''), 120) || '%'
      or r.summary ilike '%' || left(coalesce(p_search, ''), 120) || '%')
  group by r.id, p.id
  order by r.id desc;
end;
$$;

NOTIFY pgrst, 'reload schema';
commit;
