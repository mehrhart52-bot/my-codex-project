-- Stop new receipt tracking while retaining historical database records.

begin;

revoke all on function public.receive_items(bigint, integer)
  from public, anon, authenticated;
drop function if exists public.receive_items(bigint, integer);

create or replace function public.reduce_commitment(
  p_commitment_id bigint,
  p_quantity integer
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  parent_request bigint;
  commitment public.commitments%rowtype;
  previous integer;
  next_status text;
begin
  select i.request_id into parent_request
  from public.commitments c join public.request_items i on i.id = c.item_id
  where c.id = p_commitment_id;
  if parent_request is null then raise exception 'Commitment not found.'; end if;
  perform id from public.requests where id = parent_request for update;
  select * into commitment from public.commitments
  where id = p_commitment_id for update;

  if not (commitment.supporter_id = actor.id or actor.role = 'admin') then
    raise exception 'You cannot manage this commitment.';
  end if;
  if commitment.status <> 'committed' then
    raise exception 'Only active commitments can be reduced.';
  end if;
  if p_quantity < 0 or p_quantity >= commitment.quantity or
    p_quantity < commitment.received then
    raise exception 'Choose a smaller valid commitment total.';
  end if;

  previous := commitment.quantity;
  next_status := case when p_quantity = 0 then 'cancelled'
    when p_quantity = commitment.received then 'received' else 'committed' end;
  update public.commitments set quantity = p_quantity, status = next_status,
    updated_at = now() where id = p_commitment_id;
  perform public._audit(actor.id,
    case when p_quantity = 0 then 'commitment.cancelled' else 'commitment.reduced' end,
    parent_request,
    jsonb_build_object('commitmentId', p_commitment_id, 'previous', previous,
      'quantity', p_quantity));
end;
$$;

notify pgrst, 'reload schema';
commit;
