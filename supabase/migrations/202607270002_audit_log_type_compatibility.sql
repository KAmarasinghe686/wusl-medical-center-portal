-- The original hosted audit table used integer identifiers. The hardened
-- trigger records generic table identifiers as text and authenticated actors
-- as Auth UUIDs, so align the legacy columns with the trigger contract.

alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;

alter table public.audit_logs
  alter column record_id type text using record_id::text,
  alter column user_id type uuid using null::uuid;
