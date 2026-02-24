ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS school_city TEXT NULL,
  ADD COLUMN IF NOT EXISTS school_signature_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS financial_contract_template TEXT NULL;
