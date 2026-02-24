CREATE TABLE IF NOT EXISTS parent_students (
  parent_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_person_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_tenant
  ON parent_students (tenant_id, parent_person_id, student_id);
