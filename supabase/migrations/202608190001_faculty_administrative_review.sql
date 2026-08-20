-- Route student submissions through Faculty Administrative Review before UMO review.
alter table public.medical_records
  add column if not exists workflow_stage text not null default 'faculty_review',
  add column if not exists forwarded_to_umo_at timestamptz,
  add column if not exists forwarded_to_umo_by uuid,
  add column if not exists faculty_forwarding_note text;

update public.medical_records
set workflow_stage = case
  when status in ('approved', 'rejected') then 'finalized'
  else 'faculty_review'
end;

alter table public.medical_records
  drop constraint if exists medical_records_workflow_stage_check;
alter table public.medical_records
  add constraint medical_records_workflow_stage_check
  check (workflow_stage in ('faculty_review', 'umo_review', 'finalized'));

create index if not exists medical_records_workflow_stage_created_idx
  on public.medical_records(workflow_stage, created_at desc);

create or replace function public.can_view_medical_record(p_record_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.medical_records mr
    where mr.record_id = p_record_id
      and (
        mr.student_id = public.current_student_id()
        or (
          mr.lifecycle_status = 'active'
          and public.current_user_role() = 'doctor'
          and (
            (mr.status = 'pending' and mr.workflow_stage = 'umo_review')
            or mr.reviewed_by = public.current_doctor_id()
          )
        )
        or (
          mr.lifecycle_status = 'active'
          and public.current_user_role() = 'faculty'
          and (mr.workflow_stage = 'faculty_review' or mr.status = 'approved')
        )
        or public.current_user_role() = 'admin'
      )
  )
$$;

create or replace function public.forward_medical_record_to_umo(
  p_record_id bigint,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.medical_records%rowtype;
  v_note text := nullif(trim(p_note), '');
  v_student_user uuid;
begin
  if public.current_user_role() <> 'faculty' then
    raise exception 'Only Faculty Administrative Review staff can forward records' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'Forwarding note must be 2000 characters or fewer' using errcode = '22023';
  end if;

  select * into v_record
  from public.medical_records
  where record_id = p_record_id
  for update;

  if not found then
    raise exception 'Medical record not found' using errcode = 'P0002';
  end if;
  if v_record.lifecycle_status <> 'active' then
    raise exception 'Only active medical records can be forwarded' using errcode = '22023';
  end if;
  if v_record.status <> 'pending' or v_record.workflow_stage <> 'faculty_review' then
    raise exception 'This record is not awaiting Faculty Administrative Review' using errcode = '22023';
  end if;

  update public.medical_records
  set workflow_stage = 'umo_review',
      forwarded_to_umo_at = now(),
      forwarded_to_umo_by = auth.uid(),
      faculty_forwarding_note = v_note
  where record_id = p_record_id;

  insert into public.audit_logs(action, table_name, record_id, user_id, old_data, new_data)
  values (
    'FORWARDED_TO_UMO',
    'medical_records',
    p_record_id::text,
    auth.uid(),
    jsonb_build_object('workflow_stage', v_record.workflow_stage),
    jsonb_build_object('workflow_stage', 'umo_review', 'forwarding_note', v_note)
  );

  insert into public.notifications(user_id, title, message, type)
  select p.id,
    'Medical record awaiting UMO review',
    'Medical record REC-' || p_record_id || ' was forwarded by Faculty Administrative Review.',
    'record_forwarded_to_umo'
  from public.profiles p
  where p.role = 'doctor' and p.is_active;

  select user_id into v_student_user
  from public.students
  where student_id = v_record.student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id, title, message, type)
    values (
      v_student_user,
      'Medical record forwarded to the UMO',
      'Medical record REC-' || p_record_id || ' has completed Faculty Administrative Review and is awaiting UMO review.',
      'record_forwarded_to_umo'
    );
  end if;
end;
$$;

create or replace function public.review_medical_record(
  p_record_id bigint,
  p_expected_status text,
  p_new_status text,
  p_diagnosis text,
  p_observation_notes text,
  p_recommendation text,
  p_rejection_reason text,
  p_reversal_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_id bigint;
  v_record public.medical_records%rowtype;
begin
  if public.current_user_role() <> 'doctor' then
    raise exception 'Only doctors can review records' using errcode = '42501';
  end if;
  if p_new_status not in ('approved', 'rejected') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  v_doctor_id := public.current_doctor_id();
  select * into v_record
  from public.medical_records
  where record_id = p_record_id
  for update;

  if not found then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;
  if v_record.status <> p_expected_status then
    raise exception 'Record was changed by another doctor' using errcode = '40001';
  end if;
  if v_record.status = 'pending' and v_record.workflow_stage <> 'umo_review' then
    raise exception 'Faculty Administrative Review must forward the record before UMO review' using errcode = '42501';
  end if;
  if v_record.status <> 'pending' and v_record.reviewed_by is distinct from v_doctor_id then
    raise exception 'Only the reviewing doctor can reverse this decision' using errcode = '42501';
  end if;
  if v_record.status <> 'pending' and nullif(trim(p_reversal_reason), '') is null then
    raise exception 'A reversal reason is required' using errcode = '22023';
  end if;
  if p_new_status = 'rejected' and nullif(trim(p_rejection_reason), '') is null then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  update public.medical_records
  set status = p_new_status,
      workflow_stage = 'finalized',
      reviewed_by = v_doctor_id,
      rejection_reason = case when p_new_status = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
      diagnosis = nullif(trim(p_diagnosis), ''),
      observation_notes = nullif(trim(p_observation_notes), ''),
      recommendation = nullif(trim(p_recommendation), '')
  where record_id = p_record_id;

  insert into public.medical_record_reviews(
    record_id, doctor_id, from_status, to_status, diagnosis,
    observation_notes, recommendation, rejection_reason, reversal_reason
  )
  values (
    p_record_id, v_doctor_id, v_record.status, p_new_status,
    nullif(trim(p_diagnosis), ''), nullif(trim(p_observation_notes), ''),
    nullif(trim(p_recommendation), ''), nullif(trim(p_rejection_reason), ''),
    nullif(trim(p_reversal_reason), '')
  );
end;
$$;

revoke execute on function public.forward_medical_record_to_umo(bigint, text) from public, anon;
grant execute on function public.forward_medical_record_to_umo(bigint, text) to authenticated;
