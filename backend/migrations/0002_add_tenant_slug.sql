-- Add migration script here
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Preenche slug para registros antigos (opcional; pode deixar null em dev)
UPDATE tenants
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

ALTER TABLE tenants
ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants (slug);
