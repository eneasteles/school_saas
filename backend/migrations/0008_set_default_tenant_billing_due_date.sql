ALTER TABLE tenants
ALTER COLUMN billing_due_date
SET DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date;
