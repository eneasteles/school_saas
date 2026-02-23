ALTER TABLE academic_terms
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_terms_tenant_active
  ON academic_terms (tenant_id, is_active);
