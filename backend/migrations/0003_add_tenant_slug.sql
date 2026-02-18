-- Add migration script here
-- 1) adiciona coluna (sem quebrar tenants antigos)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) cria índice único (permite slug null por enquanto)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants (slug);

-- 3) (opcional) se quiser forçar NOT NULL depois, a gente faz quando já tiver preenchido
