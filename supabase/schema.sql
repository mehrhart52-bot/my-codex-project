-- Housing Transition Assistance — Supabase database setup
-- Run this entire file in a new Supabase project's SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null unique check (email = lower(email)),
  phone text not null check (char_length(phone) between 7 and 30),
  role text not null check (role in ('supporter', 'social_worker', 'admin')),
  approved boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog (
  id integer generated always as identity primary key,
  name text not null unique
);

insert into public.catalog(name) values
  ('Bed'), ('Mattress'), ('Bed Frame'), ('Bedding'), ('Pillows'),
  ('Dishes'), ('Glasses'), ('Silverware'), ('Pots and Pans'),
  ('Cooking Utensils'), ('Microwave'), ('Television'), ('Lamp'),
  ('Kitchen Table'), ('Dining Chairs'), ('Sofa'), ('Coffee Table'),
  ('End Table'), ('Dresser'), ('Towels'), ('Other')
on conflict (name) do nothing;

create table if not exists public.requests (
  id bigint generated always as identity primary key,
  number text generated always as
    ('HTA-' || lpad(id::text, greatest(5, char_length(id::text)), '0')) stored unique,
  owner_id uuid not null references public.profiles(id),
  narrative text not null check (char_length(narrative) between 10 and 10000),
  summary text not null check (char_length(summary) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.request_items (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.requests(id),
  catalog_id integer not null references public.catalog(id),
  name text not null check (char_length(name) between 1 and 120),
  quantity integer not null check (quantity between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists request_items_request_idx
  on public.request_items(request_id);

create table if not exists public.commitments (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.request_items(id),
  supporter_id uuid not null references public.profiles(id),
  quantity integer not null check (quantity between 0 and 10000),
  received integer not null default 0 check (received >= 0 and received <= quantity),
  status text not null default 'committed'
    check (status in ('committed', 'received', 'cancelled')),
  check (
    (status = 'cancelled' and quantity = 0 and received = 0) or
    (status = 'committed' and quantity > received) or
    (status = 'received' and quantity > 0 and quantity = received)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commitments_item_idx on public.commitments(item_id);
create index if not exists commitments_supporter_idx
  on public.commitments(supporter_id);

create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  commitment_id bigint not null references public.commitments(id),
  quantity integer not null check (quantity between 1 and 10000),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_history (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  request_id bigint references public.requests(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'requested_role' = 'social_worker'
      then 'social_worker'
    else 'supporter'
  end;

  insert into public.profiles(
    id, first_name, last_name, email, phone, role, approved
  ) values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'New'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 'User'),
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 'Not provided'),
    requested_role,
    requested_role = 'supporter'
  );

  insert into public.audit_history(actor_id, action, details)
  values (new.id, 'account.registered', jsonb_build_object('requestedRole', requested_role));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set email = lower(new.email), updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

create or replace function public.guard_commitment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_request bigint;
  request_status text;
  needed integer;
  reserved bigint;
begin
  if tg_op = 'UPDATE' and
    (new.item_id <> old.item_id or new.supporter_id <> old.supporter_id) then
    raise exception 'Commitment identity is immutable.';
  end if;

  select request_id into parent_request
  from public.request_items where id = new.item_id;
  select status into request_status
  from public.requests where id = parent_request for update;
  select quantity into needed
  from public.request_items where id = new.item_id;
  select coalesce(sum(quantity), 0) into reserved
  from public.commitments
  where item_id = new.item_id and id <> new.id;

  if reserved + new.quantity > needed then
    raise exception 'An item is no longer available in that quantity. Refresh and try again.';
  end if;
  if request_status = 'closed' and
    (tg_op = 'INSERT' or new.quantity > old.quantity) then
    raise exception 'This request is closed.';
  end if;
  return new;
end;
$$;

drop trigger if exists commitment_quantity_guard on public.commitments;
create trigger commitment_quantity_guard
  before insert or update on public.commitments
  for each row execute function public.guard_commitment();

create or replace function public.guard_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  reserved bigint;
begin
  if new.request_id <> old.request_id then
    raise exception 'Item request is immutable.';
  end if;
  perform id from public.requests where id = new.request_id for update;
  select coalesce(sum(quantity), 0) into reserved
  from public.commitments where item_id = new.id;
  if new.quantity < reserved then
    raise exception 'Quantity cannot be lower than existing commitments.';
  end if;
  return new;
end;
$$;

drop trigger if exists item_quantity_guard on public.request_items;
create trigger item_quantity_guard
  before update on public.request_items
  for each row execute function public.guard_item();

create or replace function public._current_profile()
returns public.profiles
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype;
begin
  select * into actor
  from public.profiles
  where id = auth.uid() and active = true;
  if not found then
    raise exception 'Please sign in with an active account.';
  end if;
  return actor;
end;
$$;

create or replace function public._audit(
  p_actor uuid,
  p_action text,
  p_request bigint default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public, pg_temp
as $$
  insert into public.audit_history(actor_id, action, request_id, details)
  values (p_actor, p_action, p_request, p_details);
$$;

create or replace function public.create_request(
  p_summary text,
  p_narrative text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  created public.requests%rowtype;
  item jsonb;
  catalog_name text;
  final_name text;
  amount integer;
begin
  if not (actor.role = 'admin' or
    (actor.role = 'social_worker' and actor.approved)) then
    raise exception 'Only approved social workers and administrators can create requests.';
  end if;
  if char_length(trim(p_summary)) not between 10 and 2000 or
    char_length(trim(p_narrative)) not between 10 and 10000 then
    raise exception 'Complete both request descriptions.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or
    jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one household item.';
  end if;

  insert into public.requests(owner_id, summary, narrative)
  values (actor.id, trim(p_summary), trim(p_narrative))
  returning * into created;

  for item in select value from jsonb_array_elements(p_items) loop
    amount := (item ->> 'quantity')::integer;
    if amount not between 1 and 10000 then
      raise exception 'Item quantities must be positive whole numbers.';
    end if;
    select name into catalog_name from public.catalog
    where id = (item ->> 'catalogId')::integer;
    if catalog_name is null then raise exception 'Choose an item from the catalog.'; end if;
    final_name := case when catalog_name = 'Other'
      then nullif(trim(item ->> 'name'), '') else catalog_name end;
    if final_name is null or char_length(final_name) > 120 then
      raise exception 'Specify the Other item.';
    end if;
    insert into public.request_items(request_id, catalog_id, name, quantity)
    values (created.id, (item ->> 'catalogId')::integer, final_name, amount);
  end loop;

  perform public._audit(actor.id, 'request.created', created.id);
  return jsonb_build_object('id', created.id::text, 'number', created.number);
end;
$$;

create or replace function public.edit_request(
  p_request_id bigint,
  p_summary text,
  p_narrative text,
  p_items jsonb,
  p_new_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  req public.requests%rowtype;
  item jsonb;
  existing_count integer;
  submitted_count integer;
  catalog_name text;
  final_name text;
  amount integer;
begin
  select * into req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if not (actor.role = 'admin' or
    (actor.role = 'social_worker' and actor.approved and req.owner_id = actor.id)) then
    raise exception 'You cannot edit this request.';
  end if;
  if req.status <> 'open' then raise exception 'Reopen the request before editing it.'; end if;
  if char_length(trim(p_summary)) not between 10 and 2000 or
    char_length(trim(p_narrative)) not between 10 and 10000 then
    raise exception 'Complete both request descriptions.';
  end if;

  select count(*) into existing_count from public.request_items
  where request_id = p_request_id;
  select count(distinct (value ->> 'id')::bigint) into submitted_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if existing_count <> jsonb_array_length(coalesce(p_items, '[]'::jsonb)) or
    existing_count <> submitted_count or exists (
      select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
      where not exists (
        select 1 from public.request_items i
        where i.id = (x.value ->> 'id')::bigint and i.request_id = p_request_id
      )
    ) then
    raise exception 'Keep all existing items; quantities can be adjusted.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    amount := (item ->> 'quantity')::integer;
    if amount not between 1 and 10000 then
      raise exception 'Item quantities must be positive whole numbers.';
    end if;
    update public.request_items set quantity = amount, updated_at = now()
    where id = (item ->> 'id')::bigint and request_id = p_request_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_new_items, '[]'::jsonb)) loop
    amount := (item ->> 'quantity')::integer;
    if amount not between 1 and 10000 then
      raise exception 'Item quantities must be positive whole numbers.';
    end if;
    select name into catalog_name from public.catalog
    where id = (item ->> 'catalogId')::integer;
    if catalog_name is null then raise exception 'Choose an item from the catalog.'; end if;
    final_name := case when catalog_name = 'Other'
      then nullif(trim(item ->> 'name'), '') else catalog_name end;
    if final_name is null or char_length(final_name) > 120 then
      raise exception 'Specify the Other item.';
    end if;
    insert into public.request_items(request_id, catalog_id, name, quantity)
    values (p_request_id, (item ->> 'catalogId')::integer, final_name, amount);
  end loop;

  update public.requests set summary = trim(p_summary), narrative = trim(p_narrative),
    updated_at = now() where id = p_request_id;
  perform public._audit(actor.id, 'request.edited', p_request_id);
end;
$$;

create or replace function public.commit_items(
  p_request_id bigint,
  p_selections jsonb
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  req public.requests%rowtype;
  selection jsonb;
  item_quantity integer;
  reserved integer;
  amount integer;
begin
  if actor.role <> 'supporter' then raise exception 'Only supporters may make commitments.'; end if;
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' or
    jsonb_array_length(p_selections) = 0 then raise exception 'Choose at least one item.'; end if;
  if (select count(distinct (value ->> 'itemId')::bigint)
      from jsonb_array_elements(p_selections)) <> jsonb_array_length(p_selections) then
    raise exception 'Choose each item once.';
  end if;

  select * into req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if req.status <> 'open' then raise exception 'This request is closed.'; end if;

  for selection in select value from jsonb_array_elements(p_selections) loop
    amount := (selection ->> 'quantity')::integer;
    if amount not between 1 and 10000 then
      raise exception 'Item quantities must be positive whole numbers.';
    end if;
    select i.quantity, coalesce(sum(c.quantity), 0)::integer
      into item_quantity, reserved
    from public.request_items i
    left join public.commitments c on c.item_id = i.id
    where i.id = (selection ->> 'itemId')::bigint
      and i.request_id = p_request_id
    group by i.id;
    if item_quantity is null or amount > item_quantity - reserved then
      raise exception 'An item is no longer available in that quantity. Refresh and try again.';
    end if;
    insert into public.commitments(item_id, supporter_id, quantity)
    values ((selection ->> 'itemId')::bigint, actor.id, amount);
  end loop;

  perform public._audit(actor.id, 'commitment.created', p_request_id,
    jsonb_build_object('items', p_selections));
end;
$$;

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
    raise exception 'Only commitments with unreceived items can be reduced.';
  end if;
  if p_quantity < 0 or p_quantity >= commitment.quantity or
    p_quantity < commitment.received then
    raise exception 'Reduce the total, keeping at least the quantity already received.';
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

create or replace function public.receive_items(
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
  req public.requests%rowtype;
  commitment public.commitments%rowtype;
begin
  select i.request_id into parent_request
  from public.commitments c join public.request_items i on i.id = c.item_id
  where c.id = p_commitment_id;
  if parent_request is null then raise exception 'Commitment not found.'; end if;
  select * into req from public.requests where id = parent_request for update;
  if not (actor.role = 'admin' or
    (actor.role = 'social_worker' and actor.approved and req.owner_id = actor.id)) then
    raise exception 'You cannot record receipts for this request.';
  end if;
  if req.status <> 'open' then raise exception 'Reopen the request before recording receipts.'; end if;
  select * into commitment from public.commitments
  where id = p_commitment_id for update;
  if p_quantity < 1 or commitment.status <> 'committed' or
    p_quantity > commitment.quantity - commitment.received then
    raise exception 'Receipt exceeds the remaining committed quantity.';
  end if;

  insert into public.receipts(commitment_id, quantity, recorded_by)
  values (p_commitment_id, p_quantity, actor.id);
  update public.commitments
  set received = received + p_quantity,
    status = case when received + p_quantity = quantity then 'received'
      else 'committed' end,
    updated_at = now()
  where id = p_commitment_id;
  perform public._audit(actor.id, 'items.received', parent_request,
    jsonb_build_object('commitmentId', p_commitment_id, 'quantity', p_quantity));
end;
$$;

create or replace function public.change_request_status(
  p_request_id bigint,
  p_status text
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  req public.requests%rowtype;
begin
  if p_status not in ('open', 'closed') then raise exception 'Invalid request status.'; end if;
  select * into req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if p_status = 'open' and actor.role <> 'admin' then
    raise exception 'Only an administrator can reopen a request.';
  end if;
  if p_status = 'closed' and not (actor.role = 'admin' or
    (actor.role = 'social_worker' and actor.approved and req.owner_id = actor.id)) then
    raise exception 'You cannot close this request.';
  end if;
  if req.status = p_status then raise exception 'The request already has that status.'; end if;

  update public.requests set status = p_status,
    closed_at = case when p_status = 'closed' then now() else null end,
    updated_at = now() where id = p_request_id;
  perform public._audit(actor.id,
    case when p_status = 'closed' then 'request.closed' else 'request.reopened' end,
    p_request_id);
end;
$$;

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
  perform public._audit(actor.id, 'user.permissions_updated', null,
    jsonb_build_object('userId', p_user_id, 'role', p_role,
      'approved', p_approved, 'active', p_active));
end;
$$;

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

create or replace function public.request_details(p_request_id bigint)
returns jsonb
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
  req public.requests%rowtype;
  owner public.profiles%rowtype;
  manager boolean;
  item_data jsonb;
  commitment_data jsonb;
  history_data jsonb;
begin
  select * into req from public.requests where id = p_request_id;
  if not found then return null; end if;
  select * into owner from public.profiles where id = req.owner_id;
  manager := actor.role = 'admin' or
    (actor.role = 'social_worker' and actor.approved and req.owner_id = actor.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id::text, 'catalog_id', i.catalog_id, 'name', i.name,
    'quantity', i.quantity, 'committed', coalesce(c.committed, 0),
    'received', coalesce(c.received, 0)
  ) order by i.id), '[]'::jsonb) into item_data
  from public.request_items i
  left join (
    select item_id, sum(quantity)::integer committed, sum(received)::integer received
    from public.commitments group by item_id
  ) c on c.item_id = i.id
  where i.request_id = p_request_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id::text, 'item_id', c.item_id::text,
    'supporter_id', c.supporter_id, 'quantity', c.quantity,
    'received', c.received, 'status', c.status, 'created_at', c.created_at,
    'name', i.name, 'request_id', i.request_id::text, 'number', req.number,
    'first_name', case when manager and c.status = 'committed' then p.first_name end,
    'last_name', case when manager and c.status = 'committed' then p.last_name end,
    'email', case when manager and c.status = 'committed' then p.email end,
    'phone', case when manager and c.status = 'committed' then p.phone end
  ) order by c.created_at desc, c.id desc), '[]'::jsonb)
  into commitment_data
  from public.commitments c
  join public.request_items i on i.id = c.item_id
  join public.profiles p on p.id = c.supporter_id
  where i.request_id = p_request_id and (manager or c.supporter_id = actor.id);

  if manager then
    select coalesce(jsonb_agg(jsonb_build_object(
      'action', h.action, 'details', h.details, 'created_at', h.created_at
    ) order by h.id desc), '[]'::jsonb) into history_data
    from (select * from public.audit_history where request_id = p_request_id
      order by id desc limit 100) h;
  else
    history_data := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', req.id::text, 'number', req.number, 'owner_id', req.owner_id,
      'summary', req.summary, 'status', req.status,
      'created_at', req.created_at, 'updated_at', req.updated_at,
      'narrative', case when manager then req.narrative end,
      'owner_name', case when manager then owner.first_name || ' ' || owner.last_name else '' end
    ),
    'items', item_data, 'commitments', commitment_data, 'history', history_data
  );
end;
$$;

create or replace function public.my_commitments()
returns table (
  id text, item_id text, supporter_id uuid, quantity integer, received integer,
  status text, created_at timestamptz, name text, number text, request_id text
)
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare
  actor public.profiles%rowtype := public._current_profile();
begin
  return query
  select c.id::text, c.item_id::text, c.supporter_id, c.quantity, c.received,
    c.status, c.created_at, i.name, r.number, i.request_id::text
  from public.commitments c
  join public.request_items i on i.id = c.item_id
  join public.requests r on r.id = i.request_id
  where c.supporter_id = actor.id
  order by c.created_at desc, c.id desc;
end;
$$;

create or replace function public.admin_users()
returns table (
  id uuid, first_name text, last_name text, email text, phone text,
  role text, approved boolean, active boolean
)
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare actor public.profiles%rowtype := public._current_profile();
begin
  if actor.role <> 'admin' then raise exception 'Administrator access required.'; end if;
  return query select p.id, p.first_name, p.last_name, p.email, p.phone,
    p.role, p.approved, p.active from public.profiles p
    order by p.approved, p.created_at desc;
end;
$$;

create or replace function public.admin_audit()
returns table (action text, details jsonb, created_at timestamptz, email text)
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare actor public.profiles%rowtype := public._current_profile();
begin
  if actor.role <> 'admin' then raise exception 'Administrator access required.'; end if;
  return query select h.action, h.details, h.created_at, p.email
  from public.audit_history h left join public.profiles p on p.id = h.actor_id
  order by h.id desc limit 100;
end;
$$;

alter table public.profiles enable row level security;
alter table public.catalog enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.commitments enable row level security;
alter table public.receipts enable row level security;
alter table public.audit_history enable row level security;

drop policy if exists profile_self_read on public.profiles;
create policy profile_self_read on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists catalog_authenticated_read on public.catalog;
create policy catalog_authenticated_read on public.catalog
  for select to authenticated using (true);

revoke all on table public.profiles, public.catalog, public.requests,
  public.request_items, public.commitments, public.receipts,
  public.audit_history from anon, authenticated;
grant select on table public.profiles, public.catalog to authenticated;

revoke all on function public._current_profile(),
  public._audit(uuid, text, bigint, jsonb) from public, anon, authenticated;

revoke all on function public.create_request(text, text, jsonb),
  public.edit_request(bigint, text, text, jsonb, jsonb),
  public.commit_items(bigint, jsonb),
  public.reduce_commitment(bigint, integer),
  public.receive_items(bigint, integer),
  public.change_request_status(bigint, text),
  public.update_user_permissions(uuid, text, boolean, boolean),
  public.list_requests(text, text), public.request_details(bigint),
  public.my_commitments(), public.admin_users(), public.admin_audit()
  from public, anon;

grant execute on function public.create_request(text, text, jsonb),
  public.edit_request(bigint, text, text, jsonb, jsonb),
  public.commit_items(bigint, jsonb),
  public.reduce_commitment(bigint, integer),
  public.receive_items(bigint, integer),
  public.change_request_status(bigint, text),
  public.update_user_permissions(uuid, text, boolean, boolean),
  public.list_requests(text, text), public.request_details(bigint),
  public.my_commitments(), public.admin_users(), public.admin_audit()
  to authenticated;
