-- The hosted project predates the version-controlled RLS policy names. Because
-- PostgreSQL ORs permissive policies, old USING (true) rules would bypass the
-- hardened policies even when the new policies are correct.

drop policy if exists "Admin can read audit logs" on public.audit_logs;
drop policy if exists "Allow anon audit log inserts" on public.audit_logs;
drop policy if exists "Allow audit log inserts" on public.audit_logs;
drop policy if exists "Allow service role audit logs" on public.audit_logs;

drop policy if exists "Authenticated can read availability" on public.doctor_availability;
drop policy if exists "Authenticated can read doctor availability" on public.doctor_availability;
drop policy if exists "Doctors can delete availability" on public.doctor_availability;
drop policy if exists "Doctors can insert availability" on public.doctor_availability;
drop policy if exists "Doctors can update availability" on public.doctor_availability;

drop policy if exists "Authenticated can read doctors" on public.doctors;
drop policy if exists "Doctors can read own data" on public.doctors;

drop policy if exists "Doctors can update assigned records" on public.medical_records;
drop policy if exists "Faculty can read all records" on public.medical_records;
drop policy if exists "Students can insert own records" on public.medical_records;
drop policy if exists "Students can read own records" on public.medical_records;

drop policy if exists "Authenticated can read visits" on public.medical_visits;
drop policy if exists "Doctors can delete visits" on public.medical_visits;
drop policy if exists "Doctors can insert visits" on public.medical_visits;
drop policy if exists "Doctors can update visits" on public.medical_visits;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;

drop policy if exists "Admin can read all profiles" on public.profiles;
drop policy if exists "Admin can update profiles" on public.profiles;
drop policy if exists "Authenticated can read profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

drop policy if exists "Authenticated can insert images" on public.record_images;
drop policy if exists "Authenticated can read images" on public.record_images;

drop policy if exists "Authenticated can read students" on public.students;
drop policy if exists "Faculty can read all students" on public.students;
drop policy if exists "Students can read own data" on public.students;
drop policy if exists "Students can update own profile" on public.students;

drop policy if exists "Allow authenticated users to upload avatars" on storage.objects;
drop policy if exists "Allow public to view avatars 1oj01fe_0" on storage.objects;
drop policy if exists "Allow users to delete own avatar" on storage.objects;
drop policy if exists "Allow users to update own avatar" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Users can read own files" on storage.objects;

drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects for select to public
using (bucket_id = 'avatars');

drop policy if exists avatar_update_own on storage.objects;
create policy avatar_update_own on storage.objects for update to authenticated
using (
  public.current_user_active()
  and bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  public.current_user_active()
  and bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Reassert that sensitive table writes must use the audited server/RPC paths.
revoke insert, update, delete on public.medical_records, public.record_images,
  public.medical_visits, public.doctor_availability, public.audit_logs,
  public.medical_record_reviews, public.account_status_history,
  public.medical_record_lifecycle_history from authenticated;

revoke all on public.audit_logs from anon;
