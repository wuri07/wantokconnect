-- DANGER: deletes EVERY table, view, function and custom type in the "public" schema, including any data in them.
-- People who already signed up (Authentication > Users) are NOT deleted.
-- Only run this if an older WantokConnect schema is in your project and you do not need its data.
-- Then run, in order: 001_schema.sql, 002_network_verification.sql, 003_backfill_profiles.sql
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "public read media" on storage.objects;
drop policy if exists "own folder insert" on storage.objects;
drop policy if exists "own folder update" on storage.objects;
drop policy if exists "own folder delete" on storage.objects;
