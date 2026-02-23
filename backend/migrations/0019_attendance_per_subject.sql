ALTER TABLE student_attendance
  ADD COLUMN IF NOT EXISTS subject_id UUID NULL REFERENCES subjects(id) ON DELETE RESTRICT;

ALTER TABLE student_attendance
  DROP CONSTRAINT IF EXISTS student_attendance_tenant_id_class_id_student_id_attendance_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_attendance_unique_per_subject'
  ) THEN
    ALTER TABLE student_attendance
      ADD CONSTRAINT student_attendance_unique_per_subject
      UNIQUE (tenant_id, class_id, student_id, attendance_date, subject_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_attendance_class_date_subject
  ON student_attendance (tenant_id, class_id, attendance_date, subject_id);
