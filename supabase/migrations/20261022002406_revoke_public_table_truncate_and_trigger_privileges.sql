-- RLS does not protect TRUNCATE. Remove dangerous DDL-like table privileges
-- from the PostgREST public roles without changing ordinary CRUD grants/policies.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;
