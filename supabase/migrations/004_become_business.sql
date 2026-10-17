-- Run after 003. Lets a customer upgrade their OWN account to a business account from inside the app
-- (Profile > "Switch to a business account"). It is one-way and does nothing for accounts that are already business accounts.
create or replace function public.protect_user_columns() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(auth.jwt()->>'role', '') <> 'service_role'
     and coalesce(current_setting('wc.allow_type_change', true), '') <> '1' then
    new.id := old.id; new.account_type := old.account_type; new.storefront_verified_at := old.storefront_verified_at;
    if not (new.storefront_status = old.storefront_status or (old.storefront_status = 'none' and new.storefront_status = 'pending')) then
      new.storefront_status := old.storefront_status; end if;
  end if;
  return new;
end $$;

create or replace function public.become_business() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform set_config('wc.allow_type_change', '1', true);     -- applies to this one transaction only
  update public.users set account_type = 'sme_owner' where id = auth.uid() and account_type = 'customer';
end $$;
revoke all on function public.become_business() from public, anon;
grant execute on function public.become_business() to authenticated;
