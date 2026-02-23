CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school_year INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name, school_year)
);

CREATE INDEX IF NOT EXISTS idx_terms_tenant_id
  ON academic_terms (tenant_id);

ALTER TABLE student_grades
  ADD COLUMN IF NOT EXISTS term_id UUID NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS subject_id UUID NULL REFERENCES subjects(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_grades_unique_fk'
  ) THEN
    ALTER TABLE student_grades
      ADD CONSTRAINT student_grades_unique_fk
      UNIQUE (tenant_id, class_id, student_id, term_id, subject_id);
  END IF;
END
$$;
