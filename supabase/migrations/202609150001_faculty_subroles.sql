-- Migration: Add faculty_sub_role to profiles table
-- Desk sub-roles: 'full_access' (default - Senior Assistant Registrar / Dean), 'coursework_staff', 'exam_staff'

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS faculty_sub_role TEXT DEFAULT 'full_access';

-- Add check constraint for valid sub-roles if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_faculty_sub_role_check'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_faculty_sub_role_check
    CHECK (faculty_sub_role IN ('full_access', 'coursework_staff', 'exam_staff'));
  END IF;
END $$;
