-- Run AFTER 001 and 002. Creates a profile row for anyone who signed up before the schema was in place.
-- Safe to run more than once.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, account_type) values (
    new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New member'), 100),
    case when new.raw_user_meta_data->>'account_type' = 'sme_owner' then 'sme_owner'::account_type else 'customer'::account_type end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.users (id, full_name, account_type)
select id, left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), 'New member'), 100),
       case when raw_user_meta_data->>'account_type' = 'sme_owner' then 'sme_owner'::account_type else 'customer'::account_type end
from auth.users on conflict (id) do nothing;

-- Should show the same number twice, and trigger_exists = true:
select (select count(*) from auth.users) as auth_users, (select count(*) from public.users) as profiles,
       exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') as trigger_exists;
