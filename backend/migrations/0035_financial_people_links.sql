ALTER TABLE financial_payables
  ADD COLUMN IF NOT EXISTS vendor_person_id UUID NULL REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE financial_receivables
  ADD COLUMN IF NOT EXISTS payer_person_id UUID NULL REFERENCES people(id) ON DELETE SET NULL;

UPDATE financial_receivables fr
SET payer_person_id = fc.payer_person_id
FROM financial_contracts fc
WHERE fr.payer_person_id IS NULL
  AND fr.contract_id = fc.id
  AND fr.tenant_id = fc.tenant_id
  AND fc.payer_person_id IS NOT NULL;
