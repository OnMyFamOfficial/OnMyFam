-- ============================================================
-- On My Fam: FULL COMBINED MIGRATION
-- Generated: 2026-03-21
-- Run this on a FRESH Supabase project to set up everything.
-- Order: base schema first, then each migration in sequence.
-- ============================================================


-- ============================================================
-- FROM: supabase-schema.sql
-- ============================================================

-- ============================================================
-- On My Fam — Full Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables,
-- RLS policies, triggers, functions, and storage buckets.
-- ============================================================

-- ============================================================
-- 1. PROFILES (created first, no dependencies)
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  bio text,
  date_of_birth date,
  phone text,
  location text,
  privacy_level text not null default 'family' check (privacy_level in ('public', 'family', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view any profile" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. FAMILIES
-- ============================================================

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_url text,
  established_year integer,
  privacy_level text not null default 'private' check (privacy_level in ('private', 'invite_only', 'public')),
  member_count integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;

create policy "Authenticated users can create families" on public.families
  for insert with check (auth.uid() = created_by);

-- ============================================================
-- 3. FAMILY MEMBERS
-- ============================================================

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  relation_label text,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

alter table public.family_members enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (must come after family_members table exists)
-- ============================================================

create or replace function is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid()
  );
$$;

create or replace function is_family_admin(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid() and role in ('admin', 'moderator')
  );
$$;

-- Deferred families policies (needed helper functions above)
create policy "Members can view their families" on public.families
  for select using (is_family_member(id));

create policy "Admins can update families" on public.families
  for update using (is_family_admin(id));

create policy "Members can view co-members" on public.family_members
  for select using (is_family_member(family_id));

create policy "Admins can insert members" on public.family_members
  for insert with check (is_family_admin(family_id) or auth.uid() = user_id);

create policy "Admins can update members" on public.family_members
  for update using (is_family_admin(family_id));

create policy "Admins can delete members" on public.family_members
  for delete using (is_family_admin(family_id) or auth.uid() = user_id);

-- Update member_count on families
create or replace function public.update_family_member_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.families set member_count = member_count + 1 where id = NEW.family_id;
  elsif TG_OP = 'DELETE' then
    update public.families set member_count = member_count - 1 where id = OLD.family_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_family_member_change
  after insert or delete on public.family_members
  for each row execute function public.update_family_member_count();

-- ============================================================
-- 4. POSTS
-- ============================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null default '',
  privacy_level text not null default 'family' check (privacy_level in ('family', 'specific_members', 'public')),
  is_pinned boolean not null default false,
  reaction_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Members can view family posts" on public.posts
  for select using (is_family_member(family_id));

create policy "Members can create posts" on public.posts
  for insert with check (is_family_member(family_id) and auth.uid() = author_id);

create policy "Authors can update own posts" on public.posts
  for update using (auth.uid() = author_id);

create policy "Authors or admins can delete posts" on public.posts
  for delete using (auth.uid() = author_id or is_family_admin(family_id));

-- ============================================================
-- 5. POST MEDIA
-- ============================================================

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

alter table public.post_media enable row level security;

create policy "Members can view post media" on public.post_media
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
  );

create policy "Post authors can insert media" on public.post_media
  for insert with check (
    exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

-- ============================================================
-- 6. POST REACTIONS
-- ============================================================

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  reaction_type text not null default 'like' check (reaction_type in ('like', 'love', 'celebrate', 'hug', 'laugh')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_reactions enable row level security;

create policy "Members can view reactions" on public.post_reactions
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
  );

create policy "Members can add reactions" on public.post_reactions
  for insert with check (auth.uid() = user_id and
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
  );

create policy "Users can remove own reactions" on public.post_reactions
  for delete using (auth.uid() = user_id);

-- Update reaction_count on posts
create or replace function public.update_post_reaction_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set reaction_count = reaction_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set reaction_count = reaction_count - 1 where id = OLD.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_post_reaction_change
  after insert or delete on public.post_reactions
  for each row execute function public.update_post_reaction_count();

-- ============================================================
-- 7. COMMENTS
-- ============================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Members can view comments" on public.comments
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
  );

create policy "Members can create comments" on public.comments
  for insert with check (auth.uid() = author_id and
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
  );

create policy "Authors can update own comments" on public.comments
  for update using (auth.uid() = author_id);

create policy "Authors can delete own comments" on public.comments
  for delete using (auth.uid() = author_id);

-- Update comment_count on posts
create or replace function public.update_post_comment_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comment_count = comment_count - 1 where id = OLD.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_comment_change
  after insert or delete on public.comments
  for each row execute function public.update_post_comment_count();

-- ============================================================
-- 8. COMMENT LIKES
-- ============================================================

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

create policy "Members can view comment likes" on public.comment_likes
  for select using (
    exists (
      select 1 from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id and is_family_member(p.family_id)
    )
  );

create policy "Members can like comments" on public.comment_likes
  for insert with check (auth.uid() = user_id);

create policy "Users can unlike" on public.comment_likes
  for delete using (auth.uid() = user_id);

-- Update like_count on comments
create or replace function public.update_comment_like_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' then
    update public.comments set like_count = like_count - 1 where id = OLD.comment_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_comment_like_change
  after insert or delete on public.comment_likes
  for each row execute function public.update_comment_like_count();

-- ============================================================
-- 9. EVENTS
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  description text,
  cover_url text,
  category text not null default 'other' check (category in ('birthday', 'reunion', 'holiday', 'graduation', 'wedding', 'memorial', 'cookout', 'game_night', 'other')),
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean not null default false,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'past', 'cancelled')),
  going_count integer not null default 0,
  maybe_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Members can view family events" on public.events
  for select using (is_family_member(family_id));

create policy "Members can create events" on public.events
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

create policy "Creators or admins can update events" on public.events
  for update using (auth.uid() = created_by or is_family_admin(family_id));

create policy "Creators or admins can delete events" on public.events
  for delete using (auth.uid() = created_by or is_family_admin(family_id));

-- ============================================================
-- 10. EVENT RSVPS
-- ============================================================

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  status text not null default 'going' check (status in ('going', 'maybe', 'cant_make_it')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_rsvps enable row level security;

create policy "Members can view RSVPs" on public.event_rsvps
  for select using (
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
  );

create policy "Members can RSVP" on public.event_rsvps
  for insert with check (auth.uid() = user_id and
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
  );

create policy "Users can update own RSVP" on public.event_rsvps
  for update using (auth.uid() = user_id);

create policy "Users can delete own RSVP" on public.event_rsvps
  for delete using (auth.uid() = user_id);

-- Update RSVP counts on events
create or replace function public.update_event_rsvp_counts()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'DELETE' then
    update public.events set
      going_count = (select count(*) from public.event_rsvps where event_id = OLD.event_id and status = 'going'),
      maybe_count = (select count(*) from public.event_rsvps where event_id = OLD.event_id and status = 'maybe')
    where id = OLD.event_id;
    return OLD;
  else
    update public.events set
      going_count = (select count(*) from public.event_rsvps where event_id = NEW.event_id and status = 'going'),
      maybe_count = (select count(*) from public.event_rsvps where event_id = NEW.event_id and status = 'maybe')
    where id = NEW.event_id;
    return NEW;
  end if;
end;
$$;

create or replace trigger on_event_rsvp_change
  after insert or update or delete on public.event_rsvps
  for each row execute function public.update_event_rsvp_counts();

-- ============================================================
-- 11. EVENT CHAT MESSAGES
-- ============================================================

create table if not exists public.event_chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.event_chat_messages enable row level security;

create policy "Members can view event chat" on public.event_chat_messages
  for select using (
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
  );

create policy "Members can send messages" on public.event_chat_messages
  for insert with check (auth.uid() = user_id and
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
  );

-- ============================================================
-- 12. ALBUMS
-- ============================================================

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  description text,
  cover_url text,
  privacy_level text not null default 'family' check (privacy_level in ('family', 'specific_members')),
  allow_download boolean not null default true,
  media_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.albums enable row level security;

create policy "Members can view family albums" on public.albums
  for select using (is_family_member(family_id));

create policy "Members can create albums" on public.albums
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

create policy "Creators or admins can update albums" on public.albums
  for update using (auth.uid() = created_by or is_family_admin(family_id));

create policy "Creators or admins can delete albums" on public.albums
  for delete using (auth.uid() = created_by or is_family_admin(family_id));

-- ============================================================
-- 13. ALBUM MEDIA
-- ============================================================

create table if not exists public.album_media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text,
  taken_at timestamptz,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

alter table public.album_media enable row level security;

create policy "Members can view album media" on public.album_media
  for select using (
    exists (select 1 from public.albums where id = album_id and is_family_member(family_id))
  );

create policy "Members can upload to albums" on public.album_media
  for insert with check (auth.uid() = uploaded_by and
    exists (select 1 from public.albums where id = album_id and is_family_member(family_id))
  );

-- Update media_count on albums
create or replace function public.update_album_media_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.albums set media_count = media_count + 1 where id = NEW.album_id;
  elsif TG_OP = 'DELETE' then
    update public.albums set media_count = media_count - 1 where id = OLD.album_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_album_media_change
  after insert or delete on public.album_media
  for each row execute function public.update_album_media_count();

-- ============================================================
-- 14. MEDIA TAGS
-- ============================================================

create table if not exists public.media_tags (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null,
  media_source text not null check (media_source in ('post', 'album')),
  tagged_user_id uuid not null references auth.users(id),
  x_position float not null default 0.5,
  y_position float not null default 0.5,
  created_at timestamptz not null default now()
);

alter table public.media_tags enable row level security;

create policy "Authenticated users can view tags" on public.media_tags
  for select using (auth.uid() is not null);

create policy "Authenticated users can create tags" on public.media_tags
  for insert with check (auth.uid() is not null);

create policy "Tag creators can delete" on public.media_tags
  for delete using (auth.uid() = tagged_user_id);

-- ============================================================
-- 15. DISCUSSIONS
-- ============================================================

create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  title text not null,
  content text not null,
  category text,
  is_pinned boolean not null default false,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discussions enable row level security;

create policy "Members can view discussions" on public.discussions
  for select using (is_family_member(family_id));

create policy "Members can create discussions" on public.discussions
  for insert with check (is_family_member(family_id) and auth.uid() = author_id);

create policy "Authors can update own discussions" on public.discussions
  for update using (auth.uid() = author_id);

create policy "Authors or admins can delete discussions" on public.discussions
  for delete using (auth.uid() = author_id or is_family_admin(family_id));

-- ============================================================
-- 16. DISCUSSION REPLIES
-- ============================================================

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  parent_id uuid references public.discussion_replies(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discussion_replies enable row level security;

create policy "Members can view replies" on public.discussion_replies
  for select using (
    exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
  );

create policy "Members can reply" on public.discussion_replies
  for insert with check (auth.uid() = author_id and
    exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
  );

create policy "Authors can update own replies" on public.discussion_replies
  for update using (auth.uid() = author_id);

create policy "Authors can delete own replies" on public.discussion_replies
  for delete using (auth.uid() = author_id);

-- Update reply_count on discussions
create or replace function public.update_discussion_reply_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    update public.discussions set reply_count = reply_count + 1 where id = NEW.discussion_id;
  elsif TG_OP = 'DELETE' then
    update public.discussions set reply_count = reply_count - 1 where id = OLD.discussion_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create or replace trigger on_discussion_reply_change
  after insert or delete on public.discussion_replies
  for each row execute function public.update_discussion_reply_count();

-- ============================================================
-- 17. INVITES
-- ============================================================

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  email text,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Admins can view invites" on public.invites
  for select using (is_family_admin(family_id));

create policy "Admins can create invites" on public.invites
  for insert with check (is_family_admin(family_id) and auth.uid() = created_by);

-- Public read for invite claim (by token)
create policy "Anyone can read invite by token" on public.invites
  for select using (true);

-- ============================================================
-- 18. NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGER (generic)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

-- Apply updated_at trigger to all tables that have it
create or replace trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger set_families_updated_at before update on public.families
  for each row execute function public.set_updated_at();

create or replace trigger set_posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create or replace trigger set_comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

create or replace trigger set_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create or replace trigger set_event_rsvps_updated_at before update on public.event_rsvps
  for each row execute function public.set_updated_at();

create or replace trigger set_albums_updated_at before update on public.albums
  for each row execute function public.set_updated_at();

create or replace trigger set_discussions_updated_at before update on public.discussions
  for each row execute function public.set_updated_at();

create or replace trigger set_discussion_replies_updated_at before update on public.discussion_replies
  for each row execute function public.set_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('posts', 'posts', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('albums', 'albums', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('events', 'events', false)
  on conflict (id) do nothing;

-- Storage policies: avatars (public read, auth write own)
create policy "Public avatar read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies: covers (public read, auth write)
create policy "Public cover read" on storage.objects for select
  using (bucket_id = 'covers');

create policy "Auth users upload covers" on storage.objects for insert
  with check (bucket_id = 'covers' and auth.uid() is not null);

-- Storage policies: posts (family members only)
create policy "Auth users upload post media" on storage.objects for insert
  with check (bucket_id = 'posts' and auth.uid() is not null);

create policy "Auth users read post media" on storage.objects for select
  using (bucket_id = 'posts' and auth.uid() is not null);

-- Storage policies: albums (family members only)
create policy "Auth users upload album media" on storage.objects for insert
  with check (bucket_id = 'albums' and auth.uid() is not null);

create policy "Auth users read album media" on storage.objects for select
  using (bucket_id = 'albums' and auth.uid() is not null);

-- Storage policies: events
create policy "Auth users upload event media" on storage.objects for insert
  with check (bucket_id = 'events' and auth.uid() is not null);

create policy "Auth users read event media" on storage.objects for select
  using (bucket_id = 'events' and auth.uid() is not null);

-- ============================================================
-- REALTIME (enable for live features)
-- ============================================================

do $$
begin
  execute 'alter publication supabase_realtime add table public.event_chat_messages';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.notifications';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.posts';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.comments';
exception when others then null;
end $$;


-- ============================================================
