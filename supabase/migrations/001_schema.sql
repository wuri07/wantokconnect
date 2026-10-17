-- WantokConnect Market: complete Supabase schema. Paste into Supabase > SQL Editor > Run (once, on a fresh project).
create extension if not exists pg_trgm;

-- ============ Reference data: 4 regions > 22 provinces > 7 city hubs, 24 categories ============
create table png_regions (id smallserial primary key, name text unique not null);
create table provinces   (id smallserial primary key, name text unique not null, region_id smallint not null references png_regions(id));
create table city_hubs   (id smallserial primary key, name text unique not null, province_id smallint not null references provinces(id), unique (id, province_id));
create table categories  (id smallserial primary key, slug text unique not null, name text not null);
insert into png_regions (name) values ('Highlands'),('MOMASE'),('New Guinea Islands'),('Southern');
insert into provinces (name, region_id)
select p, (select id from png_regions where name = r) from (values
 ('Chimbu','Highlands'),('Eastern Highlands','Highlands'),('Enga','Highlands'),('Hela','Highlands'),('Jiwaka','Highlands'),('Southern Highlands','Highlands'),('Western Highlands','Highlands'),
 ('East Sepik','MOMASE'),('Madang','MOMASE'),('Morobe','MOMASE'),('West Sepik','MOMASE'),
 ('Bougainville','New Guinea Islands'),('East New Britain','New Guinea Islands'),('Manus','New Guinea Islands'),('New Ireland','New Guinea Islands'),('West New Britain','New Guinea Islands'),
 ('Central','Southern'),('Gulf','Southern'),('Milne Bay','Southern'),('National Capital District','Southern'),('Oro','Southern'),('Western','Southern')) v(p, r);
insert into city_hubs (name, province_id)
select c, (select id from provinces where name = pr) from (values
 ('Port Moresby','National Capital District'),('Lae','Morobe'),('Mt. Hagen','Western Highlands'),('Kiunga','Western'),('Kimbe','West New Britain'),('Rabaul','East New Britain'),('Arawa','Bougainville')) v(c, pr);
insert into categories (slug, name) values
 ('rental_properties','Rental Properties'),('hire_cars_transport','Hire Cars & Transportation'),('retail_stores','Retail Stores'),('livestock_farm_supplies','Livestock & Farming Supplies'),
 ('barbers_salons','Barber Shops & Salons'),('artifacts_crafts','Artifacts & Crafts'),('technical_mechanical','Technical & Mechanical Works'),('construction_hardware','Construction & Hardware'),
 ('fresh_produce_markets','Fresh Produce & Markets'),('catering_food','Catering & Food Services'),('clothing_textiles','Clothing & Textiles'),('fisheries_seafood','Fisheries & Seafood'),
 ('electronics_repair','Electronics & Phone Repair'),('printing_stationery','Printing & Stationery'),('health_pharmacy','Health & Pharmacy'),('beauty_cosmetics','Beauty & Cosmetics'),
 ('education_tutoring','Education & Tutoring'),('events_photography','Events & Photography'),('cleaning_laundry','Cleaning & Laundry'),('security_services','Security Services'),
 ('boats_marine','Boats & Marine Services'),('plants_nurseries','Plants & Nurseries'),('furniture_carpentry','Furniture & Carpentry'),('other_services','Other Services');

-- ============ Core tables ============
create type account_type as enum ('sme_owner','customer');

create table users (                                   -- one row per Supabase Auth user (email login lives in auth.users)
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100) not null,
  account_type account_type not null,
  profile_pic_url text,
  bio text check (char_length(bio) <= 600),
  whatsapp_number varchar(20) check (whatsapp_number is null or whatsapp_number ~ '^\+?[0-9]{8,15}$'),
  phone_number    varchar(20) check (phone_number    is null or phone_number    ~ '^\+?[0-9]{8,15}$'),
  gmail varchar(100) check (gmail is null or gmail ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  storefront_status text not null default 'none' check (storefront_status in ('none','pending','verified','rejected')),
  storefront_verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (account_type = 'sme_owner' or storefront_status = 'none')
);

create table business_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  province_id smallint not null references provinces(id),
  city_hub_id smallint,
  foreign key (city_hub_id, province_id) references city_hubs (id, province_id)    -- a city must belong to its province
);
create unique index business_locations_uq on business_locations (user_id, province_id, coalesce(city_hub_id, 0));

create table storefront_photos (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  image_url text not null, caption varchar(150), sort_order smallint not null default 0,
  created_at timestamptz not null default now());
create index storefront_photos_user_idx on storefront_photos (user_id, sort_order);

create table sme_products (                            -- the catalog: single source of truth for stock
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  category_id smallint not null references categories(id),
  product_name varchar(150) not null,
  description text not null,
  price_kina numeric(12,2) check (price_kina >= 0),    -- null = "Ask for price"
  location_id bigint references business_locations(id) on delete set null,
  is_in_stock boolean not null default true,
  media_url text,
  stock_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now());
create index sme_products_user_idx on sme_products (user_id);
create index sme_products_cat_idx on sme_products (category_id);

create table marketplace_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  product_id bigint references sme_products(id) on delete set null,
  location_id bigint not null references business_locations(id) on delete cascade,
  content text not null check (char_length(content) between 5 and 1500),
  created_at timestamptz not null default now());
create index marketplace_posts_feed_idx on marketplace_posts (created_at desc);
create index marketplace_posts_loc_idx on marketplace_posts (location_id);
create index marketplace_posts_product_idx on marketplace_posts (product_id);

create table post_media (                              -- many images/files per post (max 10)
  id bigint generated always as identity primary key,
  post_id bigint not null references marketplace_posts(id) on delete cascade,
  kind text not null check (kind in ('image','document')),
  file_name text not null, mime_type text not null,
  size_bytes int not null check (size_bytes <= 10485760),
  url text not null, sort_order smallint not null default 0);
create index post_media_post_idx on post_media (post_id, sort_order);

create table user_connections (
  follower_id  uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id), check (follower_id <> following_id));
create index user_connections_following_idx on user_connections (following_id);

create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  actor_id uuid not null references users(id) on delete cascade,
  post_id bigint references marketplace_posts(id) on delete cascade,
  kind text not null check (kind in ('new_post','stock_update')),
  message text not null, is_read boolean not null default false,
  created_at timestamptz not null default now());
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where not is_read;

create table direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz, created_at timestamptz not null default now(),
  check (sender_id <> recipient_id));
create index direct_messages_recipient_idx on direct_messages (recipient_id, created_at desc);
create index direct_messages_sender_idx on direct_messages (sender_id, created_at desc);

create table platform_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  user_role account_type not null,
  rating smallint check (rating between 1 and 5),                  -- customers
  sales_reported boolean,                                           -- business owners
  experience_notes text not null check (char_length(experience_notes) <= 2000),
  improvements_suggested text not null check (char_length(improvements_suggested) <= 2000),
  created_at timestamptz not null default now(),
  check ((user_role = 'customer' and rating is not null and sales_reported is null) or (user_role = 'sme_owner' and sales_reported is not null and rating is null)));

-- ============ Triggers and functions ============
-- New auth user -> profile row. Name and role come from the signup form (raw_user_meta_data). No location at signup.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, account_type) values (
    new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New member'), 100),
    case when new.raw_user_meta_data->>'account_type' = 'sme_owner' then 'sme_owner'::account_type else 'customer'::account_type end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- People cannot promote themselves: role and verification are locked unless the change comes from the server/service role.
create function public.protect_user_columns() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    new.id := old.id; new.account_type := old.account_type; new.storefront_verified_at := old.storefront_verified_at;
    if not (new.storefront_status = old.storefront_status or (old.storefront_status = 'none' and new.storefront_status = 'pending')) then
      new.storefront_status := old.storefront_status; end if;
  end if;
  return new;
end $$;
create trigger users_protect before update on users for each row execute function public.protect_user_columns();

-- Only business owners can create locations, photos, products and posts (enforced in the database).
create function public.require_sme() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from users where id = new.user_id and account_type = 'sme_owner') then raise exception 'Only business owners can do this'; end if;
  return new;
end $$;
create trigger loc_sme_only   before insert on business_locations for each row execute function public.require_sme();
create trigger photo_sme_only before insert on storefront_photos  for each row execute function public.require_sme();
create trigger prod_sme_only  before insert on sme_products       for each row execute function public.require_sme();
create trigger post_sme_only  before insert on marketplace_posts  for each row execute function public.require_sme();

create function public.limit_post_media() returns trigger language plpgsql as $$
begin
  if (select count(*) from post_media where post_id = new.post_id) >= 10 then raise exception 'A post can have up to 10 attachments'; end if;
  return new;
end $$;
create trigger post_media_max before insert on post_media for each row execute function public.limit_post_media();

-- Followers are notified when a business they connect with posts, or flips an item In Stock / Out of Stock.
create function public.notify_followers_post() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, post_id, kind, message)
  select c.follower_id, new.user_id, new.id, 'new_post', u.full_name || ' posted: ' || coalesce(p.product_name, 'a new update')
  from user_connections c join users u on u.id = new.user_id left join sme_products p on p.id = new.product_id
  where c.following_id = new.user_id;
  return new;
end $$;
create trigger post_fanout after insert on marketplace_posts for each row execute function public.notify_followers_post();

create function public.notify_followers_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.stock_updated_at := now();
  insert into notifications (user_id, actor_id, post_id, kind, message)
  select c.follower_id, new.user_id, (select id from marketplace_posts where product_id = new.id order by created_at desc limit 1), 'stock_update',
         u.full_name || ': ' || new.product_name || ' is now ' || case when new.is_in_stock then 'In Stock' else 'Out of Stock' end
  from user_connections c join users u on u.id = new.user_id where c.following_id = new.user_id;
  return new;
end $$;
create trigger stock_fanout before update of is_in_stock on sme_products for each row when (old.is_in_stock is distinct from new.is_in_stock) execute function public.notify_followers_stock();

-- Public connection counts without exposing who is connected to whom.
create function public.connection_count(p_user uuid) returns int language sql stable security definer set search_path = public as $$
  select count(distinct case when follower_id = p_user then following_id else follower_id end)::int
  from user_connections where follower_id = p_user or following_id = p_user $$;

-- Post a new item: creates the catalog entry, the post and its media in ONE transaction.
create function public.add_post_media(p_post bigint, p_media jsonb) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; i int := 0;
begin
  for m in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    i := i + 1;
    insert into post_media (post_id, kind, file_name, mime_type, size_bytes, url, sort_order)
    values (p_post, m->>'kind', m->>'name', coalesce(m->>'mime', 'application/octet-stream'), (m->>'size')::int, m->>'url', i);
  end loop;
end $$;
create function public.post_new_item(p_name text, p_category smallint, p_price numeric, p_location bigint, p_content text, p_media jsonb default '[]')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prod bigint; v_post bigint;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from business_locations where id = p_location and user_id = v_uid) then raise exception 'Choose one of your business locations'; end if;
  insert into sme_products (user_id, category_id, product_name, description, price_kina, location_id, media_url)
  values (v_uid, p_category, trim(p_name), p_content, nullif(p_price, 0), p_location, (select x->>'url' from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) x where x->>'kind' = 'image' limit 1))
  returning id into v_prod;
  insert into marketplace_posts (user_id, product_id, location_id, content) values (v_uid, v_prod, p_location, p_content) returning id into v_post;
  perform add_post_media(v_post, p_media);
  return v_post;
end $$;
-- Post an existing catalog item again (the Post button in the profile catalog).
create function public.post_existing_item(p_product bigint, p_location bigint, p_content text, p_media jsonb default '[]')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_post bigint;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from sme_products where id = p_product and user_id = v_uid) then raise exception 'Item not found'; end if;
  if not exists (select 1 from business_locations where id = p_location and user_id = v_uid) then raise exception 'Choose one of your business locations'; end if;
  update sme_products set media_url = coalesce(media_url, (select x->>'url' from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) x where x->>'kind' = 'image' limit 1)) where id = p_product;
  insert into marketplace_posts (user_id, product_id, location_id, content) values (v_uid, p_product, p_location, p_content) returning id into v_post;
  perform add_post_media(v_post, p_media);
  return v_post;
end $$;
revoke all on function public.post_new_item, public.post_existing_item, public.add_post_media from public, anon;
grant execute on function public.post_new_item, public.post_existing_item, public.connection_count to authenticated;

-- ============ Feed view (respects Row Level Security of the caller) ============
create view feed_posts with (security_invoker = true) as
select p.id, p.created_at, p.content, p.user_id, u.full_name as author_name, u.profile_pic_url as author_pic,
       (u.storefront_status = 'verified') as author_verified, coalesce(u.whatsapp_number, u.phone_number) as author_whatsapp,
       coalesce(ch.name || ', ', '') || pr.name as location_label, pr.region_id, pr.id as province_id,
       sp.id as product_id, sp.product_name, sp.price_kina, sp.is_in_stock, sp.category_id, c.name as category_name,
       coalesce((select json_agg(json_build_object('kind', m.kind, 'name', m.file_name, 'size', m.size_bytes, 'url', m.url) order by m.sort_order)
                 from post_media m where m.post_id = p.id), '[]'::json) as media
from marketplace_posts p
join users u on u.id = p.user_id
join business_locations bl on bl.id = p.location_id
join provinces pr on pr.id = bl.province_id
left join city_hubs ch on ch.id = bl.city_hub_id
left join sme_products sp on sp.id = p.product_id
left join categories c on c.id = sp.category_id;

-- ============ Row Level Security ============
alter table png_regions enable row level security;   alter table provinces enable row level security;
alter table city_hubs enable row level security;     alter table categories enable row level security;
alter table users enable row level security;         alter table business_locations enable row level security;
alter table storefront_photos enable row level security; alter table sme_products enable row level security;
alter table marketplace_posts enable row level security; alter table post_media enable row level security;
alter table user_connections enable row level security;  alter table notifications enable row level security;
alter table direct_messages enable row level security;   alter table platform_feedback enable row level security;

create policy ref_read_regions  on png_regions for select to anon, authenticated using (true);
create policy ref_read_prov     on provinces   for select to anon, authenticated using (true);
create policy ref_read_cities   on city_hubs   for select to anon, authenticated using (true);
create policy ref_read_cats     on categories  for select to anon, authenticated using (true);

create policy users_read   on users for select to authenticated using (true);
create policy users_update on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy loc_read  on business_locations for select to authenticated using (true);
create policy loc_write on business_locations for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy photo_read  on storefront_photos for select to authenticated using (true);
create policy photo_write on storefront_photos for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prod_read  on sme_products for select to authenticated using (true);
create policy prod_write on sme_products for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy post_read   on marketplace_posts for select to authenticated using (true);
create policy post_insert on marketplace_posts for insert to authenticated with check (user_id = auth.uid());
create policy post_delete on marketplace_posts for delete to authenticated using (user_id = auth.uid());
create policy media_read   on post_media for select to authenticated using (true);
create policy media_delete on post_media for delete to authenticated using (exists (select 1 from marketplace_posts p where p.id = post_id and p.user_id = auth.uid()));

create policy conn_read   on user_connections for select to authenticated using (follower_id = auth.uid() or following_id = auth.uid());
create policy conn_insert on user_connections for insert to authenticated with check (follower_id = auth.uid());
create policy conn_delete on user_connections for delete to authenticated using (follower_id = auth.uid());

create policy notif_read   on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on notifications for delete to authenticated using (user_id = auth.uid());

create policy dm_read   on direct_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy dm_insert on direct_messages for insert to authenticated with check (sender_id = auth.uid());
create policy dm_update on direct_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy fb_insert on platform_feedback for insert to authenticated with check (user_id = auth.uid() and user_role = (select account_type from users where id = auth.uid()));
create policy fb_read   on platform_feedback for select to authenticated using (user_id = auth.uid());

grant select on feed_posts to authenticated;

-- ============ Realtime (live stock badges, notifications, messages) ============
alter publication supabase_realtime add table public.sme_products, public.notifications, public.direct_messages;

-- ============ Storage buckets (files live under <user id>/<file>) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('avatars',    'avatars',    true, 2097152,  array['image/jpeg','image/png','image/webp']),
 ('storefronts','storefronts',true, 5242880,  array['image/jpeg','image/png','image/webp']),
 ('post-media', 'post-media', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf','application/msword',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/zip','application/x-zip-compressed'])
on conflict (id) do nothing;
create policy "public read media" on storage.objects for select using (bucket_id in ('avatars','storefronts','post-media'));
create policy "own folder insert" on storage.objects for insert to authenticated with check (bucket_id in ('avatars','storefronts','post-media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder update" on storage.objects for update to authenticated using (bucket_id in ('avatars','storefronts','post-media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete to authenticated using (bucket_id in ('avatars','storefronts','post-media') and (storage.foldername(name))[1] = auth.uid()::text);
