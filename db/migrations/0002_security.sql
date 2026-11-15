-- =====================================================================
-- SPIDEY tracXer — 0002_security.sql
-- Lock schema `app` away from Supabase client roles and create storage
-- buckets. Safe to run on plain Postgres (guards skip Supabase-only bits).
-- =====================================================================

-- 1) Nobody but the owner (the server's DB role) may touch schema app.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES    IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES    FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- 2) RLS ON for every table, with NO policies = deny-all for non-owners.
--    (Defence in depth: schema app is also not in the Data API's exposed schemas.)
--    Views run with owner rights; they are not reachable by client roles anyway.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

