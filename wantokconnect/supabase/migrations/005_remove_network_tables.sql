-- OPTIONAL. Only if you ran the old 002_network_verification.sql: removes the professional network tables (and any posts in them).
drop table if exists pro_reactions, pro_posts, professional_profiles, hubs cascade;
drop function if exists public.pro_reaction_counts() cascade;
