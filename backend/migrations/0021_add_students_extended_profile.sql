ALTER TABLE students
  ADD COLUMN IF NOT EXISTS social_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS gender TEXT NULL,
  ADD COLUMN IF NOT EXISTS nationality TEXT NULL,
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT NULL,
  ADD COLUMN IF NOT EXISTS address TEXT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS blood_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS allergies TEXT NULL,
  ADD COLUMN IF NOT EXISTS medications TEXT NULL,
  ADD COLUMN IF NOT EXISTS health_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS enrollment_date DATE NULL;

CREATE INDEX IF NOT EXISTS idx_students_enrollment_status
  ON students (tenant_id, enrollment_status);
