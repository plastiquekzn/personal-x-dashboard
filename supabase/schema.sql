create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text,
  logo_path text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (length(trim(name)) > 0),
  constraint projects_slug_not_blank check (length(trim(slug)) > 0)
);

create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  tweet_url text,
  post_text text,
  posted_at timestamptz,
  replies_count integer,
  reposts_count integer,
  likes_count integer,
  views_count integer,
  screenshot_path text not null,
  screenshot_width integer,
  screenshot_height integer,
  ocr_raw_text text,
  ocr_confidence text not null default 'medium',
  content_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_tweet_url_blank_or_http check (
    tweet_url is null
    or tweet_url ~* '^https?://'
  ),
  constraint posts_replies_non_negative check (
    replies_count is null or replies_count >= 0
  ),
  constraint posts_likes_non_negative check (
    likes_count is null or likes_count >= 0
  ),
  constraint posts_reposts_non_negative check (
    reposts_count is null or reposts_count >= 0
  ),
  constraint posts_views_non_negative check (
    views_count is null or views_count >= 0
  ),
  constraint posts_width_non_negative check (
    screenshot_width is null or screenshot_width > 0
  ),
  constraint posts_height_non_negative check (
    screenshot_height is null or screenshot_height > 0
  ),
  constraint posts_ocr_confidence_valid check (
    ocr_confidence in ('low', 'medium', 'high')
  )
);

create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

create unique index if not exists posts_tweet_url_unique
  on public.posts (tweet_url)
  where tweet_url is not null;

create unique index if not exists posts_content_fingerprint_unique
  on public.posts (content_fingerprint)
  where content_fingerprint is not null;

create index if not exists posts_project_id_idx
  on public.posts (project_id);

create index if not exists posts_posted_at_idx
  on public.posts (posted_at desc nulls last);

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

create index if not exists posts_likes_count_idx
  on public.posts (likes_count desc nulls last);

create index if not exists posts_views_count_idx
  on public.posts (views_count desc nulls last);

create index if not exists posts_replies_count_idx
  on public.posts (replies_count desc nulls last);

create index if not exists posts_reposts_count_idx
  on public.posts (reposts_count desc nulls last);

create index if not exists projects_display_order_idx
  on public.projects (display_order asc, created_at asc);
