-- Add migration script here
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants (slug);
