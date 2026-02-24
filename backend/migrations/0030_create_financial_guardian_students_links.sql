CREATE TABLE IF NOT EXISTS financial_guardian_students (
  financial_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (financial_person_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_guardian_students_tenant
  ON financial_guardian_students (tenant_id, financial_person_id, student_id);
