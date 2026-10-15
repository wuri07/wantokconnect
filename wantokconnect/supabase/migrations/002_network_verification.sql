-- Run AFTER 001_schema.sql. Adds the professional network, verification and offline-sync support.
-- All writes to these tables go through the Express API (server role). Browsers get read-only access where noted.

-- ============ Industry hubs ============
create table hubs (id smallserial primary key, slug text unique not null, name text not null);
insert into hubs (slug, name) values
 ('agriculture_forestry','Agriculture & Forestry'),('fisheries','Fisheries'),('oil_gas','Oil & Gas'),('mining_resources','Mining & Resources'),
 ('healthcare','Healthcare'),('information_technology','Information Technology'),('infrastructure_construction','Infrastructure & Construction'),
 ('banking_finance','Banking & Finance'),('public_service_governance','Public Service & Governance'),('tourism_hospitality','Tourism & Hospitality'),
 ('sme_trades_retail','SME Trades & Retail'),('education','Education');

-- ============ Professional profiles (+ National ID verification) ============
create table professional_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  headline varchar(150),
  hub_id smallint references hubs(id),
  bio text check (char_length(bio) <= 1000),
  skills text[] not null default '{}' check (cardinality(skills) <= 15),
  province_id smallint references provinces(id),
  national_id_hash text,                                   -- keyed HMAC of the ID number. The number itself is never stored.
  national_id_status text not null default 'none' check (national_id_status in ('none','pending','verified','rejected')),
  verified_at timestamptz,
  updated_at timestamptz not null default now());
create unique index professional_profiles_id_hash_uq on professional_profiles (national_id_hash) where national_id_hash is not null;  -- one ID, one account

-- ============ Structured posts: no free-form status updates ============
create table pro_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  post_type text not null check (post_type in ('job_opening','offer_service','industry_question','company_news','achievement')),
  hub_id smallint not null references hubs(id),
  province_id smallint references provinces(id),
  content text not null check (char_length(content) between 10 and 1000),
  vouched_count int not null default 0,
  resourceful_count int not null default 0,
  client_uuid uuid unique,                                 -- offline replay: the same queued post is never saved twice
  created_at timestamptz not null default now());
create index pro_posts_feed_idx on pro_posts (hub_id, province_id, created_at desc);
create index pro_posts_user_idx on pro_posts (user_id);

create table pro_reactions (
  post_id bigint not null references pro_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('vouched','resourceful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind));
create index pro_reactions_user_idx on pro_reactions (user_id);

create function public.pro_reaction_counts() returns trigger language plpgsql security definer set search_path = public as $$
declare v_post bigint; v_kind text; d int;
begin
  if tg_op = 'INSERT' then v_post := new.post_id; v_kind := new.kind; d := 1;
  else v_post := old.post_id; v_kind := old.kind; d := -1; end if;
  update pro_posts set vouched_count = greatest(0, vouched_count + case when v_kind = 'vouched' then d else 0 end),
                       resourceful_count = greatest(0, resourceful_count + case when v_kind = 'resourceful' then d else 0 end) where id = v_post;
  return null;
end $$;
create trigger pro_reaction_counts after insert or delete on pro_reactions for each row execute function public.pro_reaction_counts();

-- ============ Directory search speed ============
create index users_name_trgm on users using gin (full_name gin_trgm_ops);
create index business_locations_province_idx on business_locations (province_id);

-- ============ Row Level Security: browsers can read; only the API (server role) writes ============
alter table hubs enable row level security;
alter table professional_profiles enable row level security;
alter table pro_posts enable row level security;
alter table pro_reactions enable row level security;
create policy hubs_read on hubs for select to anon, authenticated using (true);
create policy pp_read_own on professional_profiles for select to authenticated using (user_id = auth.uid());   -- the hash column stays private
create policy pro_posts_read on pro_posts for select to authenticated using (true);
create policy pro_reactions_read on pro_reactions for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: the browser cannot write these tables directly.
