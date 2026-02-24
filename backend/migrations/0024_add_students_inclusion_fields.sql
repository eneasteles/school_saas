ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_inclusion BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS inclusion_type TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_students_is_inclusion
  ON students (tenant_id, is_inclusion);
