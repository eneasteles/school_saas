ALTER TABLE people
  ADD COLUMN IF NOT EXISTS zip_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS street TEXT NULL,
  ADD COLUMN IF NOT EXISTS address_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT NULL,
  ADD COLUMN IF NOT EXISTS complement TEXT NULL,
  ADD COLUMN IF NOT EXISTS state_ibge_code INT NULL,
  ADD COLUMN IF NOT EXISTS state_uf TEXT NULL,
  ADD COLUMN IF NOT EXISTS state_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS city_ibge_code INT NULL,
  ADD COLUMN IF NOT EXISTS city_name TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_people_tenant_state_city
  ON people (tenant_id, state_ibge_code, city_ibge_code);
