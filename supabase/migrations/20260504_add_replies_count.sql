alter table public.posts
  add column if not exists replies_count integer;

alter table public.posts
  drop constraint if exists posts_replies_non_negative;

alter table public.posts
  add constraint posts_replies_non_negative
  check (replies_count is null or replies_count >= 0);

create index if not exists posts_replies_count_idx
  on public.posts (replies_count desc nulls last);
