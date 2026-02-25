CREATE TABLE IF NOT EXISTS financial_counterparties (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vendor', 'payer', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_counterparties_tenant_kind
  ON financial_counterparties (tenant_id, kind, is_active, name);

CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  flow TEXT NOT NULL CHECK (flow IN ('payable', 'receivable', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_tenant_flow
  ON financial_categories (tenant_id, flow, is_active, name);

ALTER TABLE financial_payables
  ADD COLUMN IF NOT EXISTS vendor_counterparty_id UUID NULL REFERENCES financial_counterparties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID NULL REFERENCES financial_categories(id) ON DELETE SET NULL;

ALTER TABLE financial_receivables
  ADD COLUMN IF NOT EXISTS payer_counterparty_id UUID NULL REFERENCES financial_counterparties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID NULL REFERENCES financial_categories(id) ON DELETE SET NULL;

INSERT INTO financial_categories (id, tenant_id, name, flow)
SELECT
  md5(fp.tenant_id::text || ':payable:' || fp.category)::uuid,
  fp.tenant_id,
  fp.category,
  'payable'
FROM financial_payables fp
WHERE fp.category IS NOT NULL AND btrim(fp.category) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_categories (id, tenant_id, name, flow)
SELECT
  md5(fr.tenant_id::text || ':receivable:' || fr.category)::uuid,
  fr.tenant_id,
  fr.category,
  'receivable'
FROM financial_receivables fr
WHERE fr.category IS NOT NULL AND btrim(fr.category) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_counterparties (id, tenant_id, name, kind)
SELECT
  md5(fp.tenant_id::text || ':vendor:' || fp.vendor_name)::uuid,
  fp.tenant_id,
  fp.vendor_name,
  'vendor'
FROM financial_payables fp
WHERE fp.vendor_name IS NOT NULL AND btrim(fp.vendor_name) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_counterparties (id, tenant_id, name, kind)
SELECT
  md5(fr.tenant_id::text || ':payer:' || fr.payer_name)::uuid,
  fr.tenant_id,
  fr.payer_name,
  'payer'
FROM financial_receivables fr
WHERE fr.payer_name IS NOT NULL AND btrim(fr.payer_name) <> ''
ON CONFLICT (id) DO NOTHING;

UPDATE financial_payables fp
SET vendor_counterparty_id = md5(fp.tenant_id::text || ':vendor:' || fp.vendor_name)::uuid
WHERE fp.vendor_counterparty_id IS NULL
  AND fp.vendor_name IS NOT NULL
  AND btrim(fp.vendor_name) <> '';

UPDATE financial_payables fp
SET category_id = md5(fp.tenant_id::text || ':payable:' || fp.category)::uuid
WHERE fp.category_id IS NULL
  AND fp.category IS NOT NULL
  AND btrim(fp.category) <> '';

UPDATE financial_receivables fr
SET payer_counterparty_id = md5(fr.tenant_id::text || ':payer:' || fr.payer_name)::uuid
WHERE fr.payer_counterparty_id IS NULL
  AND fr.payer_name IS NOT NULL
  AND btrim(fr.payer_name) <> '';

UPDATE financial_receivables fr
SET category_id = md5(fr.tenant_id::text || ':receivable:' || fr.category)::uuid
WHERE fr.category_id IS NULL
  AND fr.category IS NOT NULL
  AND btrim(fr.category) <> '';
