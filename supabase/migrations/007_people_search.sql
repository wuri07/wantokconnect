-- Run after 006. Adds the "Show me in Find People" setting and speeds up name search.
alter table users add column if not exists discoverable boolean not null default true;
create index if not exists users_name_trgm_idx on users using gin (full_name gin_trgm_ops);   -- pg_trgm is enabled by 001
