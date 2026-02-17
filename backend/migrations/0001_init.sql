-- Tenants (cada escola = 1 tenant)
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users (usuários pertencem a um tenant)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL, -- "owner", "admin", "teacher", "staff"
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- Students (alunos pertencem a um tenant)
CREATE TABLE students (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration TEXT NOT NULL, -- matrícula
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, registration)
);
