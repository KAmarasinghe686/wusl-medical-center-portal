begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'student-a@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'student-b@test.local', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'doctor@test.local', '', now(), '{}', '{}', now(), now()),
  ('30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'faculty@test.local', '', now(), '{}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles(id, full_name, role) values
  ('10000000-0000-0000-0000-000000000001', 'Student A', 'student'),
  ('10000000-0000-0000-0000-000000000002', 'Student B', 'student'),
  ('20000000-0000-0000-0000-000000000001', 'Doctor', 'doctor'),
  ('30000000-0000-0000-0000-000000000001', 'Faculty', 'faculty'),
  ('40000000-0000-0000-0000-000000000001', 'Admin', 'admin')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.students(student_id, user_id, full_name, index_no) values
  (910001, '10000000-0000-0000-0000-000000000001', 'Student A', '212301'),
  (910002, '10000000-0000-0000-0000-000000000002', 'Student B', '222302');

insert into public.doctors(doctor_id, user_id, full_name) values
  (920001, '20000000-0000-0000-0000-000000000001', 'Doctor');

insert into public.medical_records(record_id, student_id, purpose, issue_date, status, reviewed_by) values
  (930001, 910001, 'A pending record', current_date, 'pending', null),
  (930002, 910002, 'An approved record', current_date, 'approved', 920001),
  (930003, 910002, 'A rejected record', current_date, 'rejected', 920001);

insert into public.notifications(notification_id, user_id, title, message) values
  (940001, '10000000-0000-0000-0000-000000000001', 'Own', 'Own notification'),
  (940002, '10000000-0000-0000-0000-000000000002', 'Other', 'Other notification');

insert into public.onboarding_imports(
  job_id, import_type, status, total_rows, created_by
) values (
  '50000000-0000-0000-0000-000000000001', 'students', 'completed', 1,
  '40000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::integer from public.medical_records), 1, 'student reads only their own record');
select is((select count(*)::integer from public.notifications), 1, 'student reads only their own notification');
select is((select count(*)::integer from public.onboarding_imports), 0, 'student cannot read onboarding jobs');
select throws_ok(
  $$ update public.medical_records set status = 'approved' where record_id = 930001 $$,
  '42501',
  null,
  'student cannot update medical record status'
);
select is(
  (
    with changed as (
      update public.notifications
      set is_read = true
      where notification_id = 940002
      returning notification_id
    )
    select count(*)::integer from changed
  ),
  0,
  'student cannot update another user notification'
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 1, 'faculty reads approved records only');
select is((select status from public.medical_records limit 1), 'approved', 'faculty cannot read pending or rejected records');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 3, 'doctor reads pending and personally reviewed records');
select lives_ok(
  $$ select public.review_medical_record(930001, 'pending', 'approved', 'Diagnosis', 'Notes', 'Recommendation', null, null) $$,
  'doctor can review a pending record atomically'
);

select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 3, 'administrator reads all medical records');
select ok((select count(*) > 0 from public.audit_logs), 'administrator can read audit records');
select is((select count(*)::integer from public.onboarding_imports), 1, 'administrator can read onboarding jobs');

select * from finish();
rollback;
