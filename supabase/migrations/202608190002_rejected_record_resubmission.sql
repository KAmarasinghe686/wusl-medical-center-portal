-- Allow students to resubmit a rejected record while retaining the original review history.
alter table public.medical_records
  add column if not exists resubmission_reason text,
  add column if not exists resubmission_details text,
  add column if not exists resubmitted_at timestamptz,
  add column if not exists resubmission_count integer not null default 0;

alter table public.medical_records
  drop constraint if exists medical_records_resubmission_count_check;
alter table public.medical_records
  add constraint medical_records_resubmission_count_check check (resubmission_count >= 0);

create index if not exists medical_records_resubmitted_at_idx
  on public.medical_records(resubmitted_at desc)
  where resubmitted_at is not null;
