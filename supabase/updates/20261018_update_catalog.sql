-- Update an existing Housing Transition Assistance project with the revised
-- household essentials list. Existing request items keep their saved names.

begin;

-- Reuse existing catalog records where possible so historical references stay
-- valid. The guards make this safe to run more than once.
update public.catalog
set name = 'Twin Mattress'
where name = 'Mattress'
  and not exists (
    select 1 from public.catalog where name = 'Twin Mattress'
  );

update public.catalog
set name = 'Twin Bed Frame'
where name = 'Bed Frame'
  and not exists (
    select 1 from public.catalog where name = 'Twin Bed Frame'
  );

update public.catalog
set name = 'Twin Bedding'
where name = 'Bedding'
  and not exists (
    select 1 from public.catalog where name = 'Twin Bedding'
  );

insert into public.catalog(name) values
  ('Twin Mattress'), ('Full Mattress'),
  ('Twin Bed Frame'), ('Full Bed Frame'),
  ('Twin Bedding'), ('Full Bedding'),
  ('Cleaning Supplies')
on conflict (name) do nothing;

-- Remove the old Bed choice when no historical row refers to it. If it is in
-- use, the app hides it from new requests while preserving the old request.
delete from public.catalog as catalog
where catalog.name = 'Bed'
  and not exists (
    select 1
    from public.request_items as item
    where item.catalog_id = catalog.id
  );

notify pgrst, 'reload schema';
commit;
