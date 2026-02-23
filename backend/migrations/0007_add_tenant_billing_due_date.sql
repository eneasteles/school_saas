ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS billing_due_date DATE;

UPDATE tenants
SET billing_due_date = (CURRENT_DATE + INTERVAL '30 days')::date
WHERE billing_due_date IS NULL;

ALTER TABLE tenants
ALTER COLUMN billing_due_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_billing_due_date ON tenants (billing_due_date);
