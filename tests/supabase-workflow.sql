-- Regression checks for Supabase database functions.
-- Run only against the disposable database created with supabase-bootstrap.sql.
begin;

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.test',
    '{"first_name":"Alex","last_name":"Admin","phone":"315-555-0101"}'),
  ('10000000-0000-4000-8000-000000000002', 'worker@example.test',
    '{"first_name":"Sam","last_name":"Worker","phone":"315-555-0102","requested_role":"social_worker"}'),
  ('10000000-0000-4000-8000-000000000003', 'supporter@example.test',
    '{"first_name":"Taylor","last_name":"Supporter","phone":"315-555-0103"}'),
  ('10000000-0000-4000-8000-000000000004', 'other@example.test',
    '{"first_name":"Casey","last_name":"Other","phone":"315-555-0104"}');

update public.profiles set role = 'admin', approved = true
where id = '10000000-0000-4000-8000-000000000001';

set local role authenticated;

do $$
declare
  created jsonb;
  v_request_id bigint;
  v_item_id bigint;
  v_commitment_id bigint;
  details jsonb;
  totals record;
begin
  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001', true);
  perform public.update_user_permissions(
    '10000000-0000-4000-8000-000000000002', 'social_worker', true, true);

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000002', true);
  created := public.create_request(
    'A fictional neighbor needs two dining chairs for a new apartment.',
    'Private fictional circumstances visible only to authorized staff.',
    jsonb_build_array(jsonb_build_object('catalogId', 15, 'quantity', 2))
  );
  v_request_id := (created ->> 'id')::bigint;
  details := public.request_details(v_request_id);
  v_item_id := (details #>> '{items,0,id}')::bigint;

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000003', true);
  perform public.commit_items(v_request_id,
    jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'quantity', 2)));
  details := public.request_details(v_request_id);
  v_commitment_id := (details #>> '{commitments,0,id}')::bigint;

  select * into strict totals from public.list_requests('all', created ->> 'number')
    where id = v_request_id::text;
  if totals.needed <> '2' or totals.committed <> '2' then
    raise exception 'Dashboard totals are incorrect after a pledge.';
  end if;

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000004', true);
  begin
    perform public.commit_items(v_request_id,
      jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'quantity', 1)));
    raise exception 'Expected overcommitment to be rejected.';
  exception when others then
    if sqlerrm = 'Expected overcommitment to be rejected.' then raise; end if;
  end;
  details := public.request_details(v_request_id);
  if details #>> '{request,narrative}' is not null then
    raise exception 'Private narrative leaked to an unrelated supporter.';
  end if;
  if jsonb_array_length(details -> 'commitments') <> 0 then
    raise exception 'Another supporter commitment leaked.';
  end if;

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000003', true);
  perform public.reduce_commitment(v_commitment_id, 1);
  details := public.request_details(v_request_id);
  if details #>> '{commitments,0,status}' <> 'committed' or
      (details #>> '{commitments,0,quantity}')::integer <> 1 then
    raise exception 'Commitment reduction did not reconcile.';
  end if;

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000002', true);
  perform public.change_request_status(v_request_id, 'closed');

  perform set_config('request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000004', true);
  begin
    perform public.commit_items(v_request_id,
      jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'quantity', 1)));
    raise exception 'Expected a closed request to reject commitments.';
  exception when others then
    if sqlerrm = 'Expected a closed request to reject commitments.' then raise; end if;
  end;
end;
$$;

rollback;
