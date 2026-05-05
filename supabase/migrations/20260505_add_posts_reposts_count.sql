alter table public.posts
  add column if not exists reposts_count integer;

alter table public.posts
  drop constraint if exists posts_reposts_non_negative;

alter table public.posts
  add constraint posts_reposts_non_negative
  check (reposts_count is null or reposts_count >= 0);

create index if not exists posts_reposts_count_idx
  on public.posts (reposts_count desc nulls last);
