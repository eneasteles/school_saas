INSERT INTO person_types (code, label)
VALUES ('pickup_authorized', 'Autorizado para Buscar Aluno')
ON CONFLICT (code) DO NOTHING;
