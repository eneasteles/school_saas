CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  document TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_guardians (
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant
  ON guardians (tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_guardians_tenant
  ON student_guardians (tenant_id, guardian_id, student_id);
