alter table public.profiles
  add column if not exists contact_no text,
  add column if not exists address text;

alter table public.students
  add column if not exists address text;

revoke update(full_name, employee_index) on public.profiles from authenticated;
revoke update(full_name, faculty, academic_year, dob, gender, contact_no) on public.students from authenticated;
revoke update(full_name, specialisation) on public.doctors from authenticated;

grant update(contact_no, address) on public.profiles to authenticated;
grant update(contact_no, address) on public.students to authenticated;

comment on column public.profiles.contact_no is
  'User-maintained contact number. Institutional identity fields remain administrator-managed.';
comment on column public.profiles.address is
  'User-maintained postal address for staff profiles.';
comment on column public.students.address is
  'Student-maintained postal address.';
