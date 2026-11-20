-- TAW-29 pilot configuration: fixed identifiers, safe to apply again.
insert into public.places (id, name, area_label, sort_order) values
  ('a2900000-0000-4000-8000-000000000001', '10th of Ramadan City', null, 0),
  ('a2900000-0000-4000-8000-000000000002', 'New Cairo', 'Fifth Settlement', 1)
on conflict do nothing;

insert into public.routes (id, place_a_id, place_b_id, duration_minutes) values
  ('a2900000-0000-4000-8000-000000000101',
   'a2900000-0000-4000-8000-000000000001',
   'a2900000-0000-4000-8000-000000000002', 50)
on conflict do nothing;
