begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

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

insert into public.medical_visits(
  visit_id, doctor_id, user_id, visit_date, reason, status,
  patient_name, patient_index, patient_type
) values (
  935001, 920001, '10000000-0000-0000-0000-000000000002',
  current_date, 'Clinical consultation', 'completed',
  'Student B', '222302', 'Student'
);

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
update public.notifications
set is_read = true
where notification_id = 940002;

set local role service_role;
select is(
  (select is_read from public.notifications where notification_id = 940002),
  false,
  'student cannot update another user notification'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 1, 'faculty reads approved records only');
select is((select status from public.medical_records limit 1), 'approved', 'faculty cannot read pending or rejected records');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 3, 'doctor reads pending and personally reviewed records');
select lives_ok(
  $$ select public.review_medical_record(930001, 'pending', 'approved', 'Diagnosis', 'Notes', 'Recommendation', null, null) $$,
  'doctor can review a pending record atomically'
);
select lives_ok(
  $$ select public.review_medical_record(930001, 'approved', 'rejected', 'Updated diagnosis', 'Updated notes', 'Updated recommendation', 'Supporting document could not be verified', 'Correcting the original decision') $$,
  'reviewing doctor can reverse a decision with a reason'
);
select is(
  (select count(*)::integer from public.medical_record_reviews where record_id = 930001),
  2,
  'initial decision and reversal are both preserved in review history'
);
select is(
  (select reversal_reason from public.medical_record_reviews where record_id = 930001 order by reviewed_at desc, review_id desc limit 1),
  'Correcting the original decision',
  'reversal reason is preserved in review history'
);

select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.medical_records), 3, 'administrator reads all medical records');
select ok((select count(*) > 0 from public.audit_logs), 'administrator can read audit records');
select is((select count(*)::integer from public.onboarding_imports), 1, 'administrator can read onboarding jobs');

set local role service_role;
select lives_ok(
  $$ select public.admin_set_account_status(
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    false,
    'Student access formally suspended for testing'
  ) $$,
  'administrator account-status change is recorded atomically'
);
select is(
  (select count(*)::integer from public.account_status_history where user_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'account status history preserves the deactivation'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.medical_records),
  0,
  'inactive user immediately loses medical-record access through RLS'
);

set local role service_role;
select lives_ok(
  $$ select public.admin_change_medical_record_lifecycle(
    '40000000-0000-0000-0000-000000000001',
    930003,
    'invalidated',
    'Duplicate test submission'
  ) $$,
  'administrator can invalidate a record without deleting it'
);
select is(
  (select count(*)::integer from public.medical_record_lifecycle_history where record_id = 930003),
  1,
  'record lifecycle history preserves the invalidation'
);
select lives_ok(
  $$ select public.void_medical_visit(
    '20000000-0000-0000-0000-000000000001',
    935001,
    'Duplicate visit entry entered in error'
  ) $$,
  'doctor voids a visit atomically without deleting it'
);
select is(
  (select status from public.medical_visits where visit_id = 935001),
  'voided',
  'voided visit remains stored with voided status'
);
select ok(
  (
    select void_reason is not null
      and voided_at is not null
      and voided_by = '20000000-0000-0000-0000-000000000001'
    from public.medical_visits
    where visit_id = 935001
  ),
  'voided visit preserves reason, doctor, and timestamp'
);
select is(
  (
    select count(*)::integer
    from public.audit_logs
    where table_name = 'medical_visits'
      and record_id = '935001'
      and action = 'VISIT_VOIDED'
  ),
  1,
  'voiding a visit creates its semantic audit entry in the same transaction'
);

select * from finish();
rollback;
