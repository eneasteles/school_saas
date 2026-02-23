ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'matutino';

CREATE TABLE IF NOT EXISTS student_attendance (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  present BOOLEAN NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, class_id, student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS student_grades (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  subject TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  absences INT NOT NULL DEFAULT 0,
  comments TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, class_id, student_id, term, subject)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date
  ON student_attendance (tenant_id, class_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_grades_class_term_subject
  ON student_grades (tenant_id, class_id, term, subject);
