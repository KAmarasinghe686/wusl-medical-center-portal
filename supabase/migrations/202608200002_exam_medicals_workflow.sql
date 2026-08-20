-- Migration: Examination Medical Certificates & Faculty Board Workflow
-- Adds support for course units, authorized medical issuers, UMO recommendations, and Faculty Board schedules.

alter table public.medical_records
  add column if not exists submission_type text not null default 'general',
  add column if not exists issuer_type text,
  add column if not exists illness_timing text default 'before_exam',
  add column if not exists exam_academic_year text,
  add column if not exists exam_semester text,
  add column if not exists exam_degree_programme text default 'B.Sc. (General/ Joint Major/Honours/ Special) Degree Programmes',
  add column if not exists exam_courses jsonb default '[]'::jsonb,
  add column if not exists doctor_recommendation text,
  add column if not exists doctor_remarks text,
  add column if not exists faculty_board_decision text default 'Pending',
  add column if not exists faculty_board_memo_no text,
  add column if not exists faculty_board_date date;

-- Add check constraint for submission_type
alter table public.medical_records
  drop constraint if exists medical_records_submission_type_check;

alter table public.medical_records
  add constraint medical_records_submission_type_check
  check (submission_type in ('general', 'exam'));
