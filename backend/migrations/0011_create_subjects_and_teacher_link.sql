CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NULL,
  teacher_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subjects_tenant_id ON subjects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher_user_id ON subjects (teacher_user_id);
