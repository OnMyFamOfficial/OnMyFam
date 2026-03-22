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
-- HELPER FUNCTIONS
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

-- ============================================================
-- 1. PROFILES
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

create policy "Members can view their families" on public.families
  for select using (is_family_member(id));

create policy "Authenticated users can create families" on public.families
  for insert with check (auth.uid() = created_by);

create policy "Admins can update families" on public.families
  for update using (is_family_admin(id));

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
-- FROM: supabase-chat-schema.sql
-- ============================================================

-- ============================================================
-- On My Fam: Chat & Video Calling Schema
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- Tables are created FIRST, then policies, then RPCs/triggers.
-- ============================================================

-- ============================================================
-- STEP 1: CREATE ALL TABLES
-- ============================================================

-- 19. CONVERSATIONS
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  type text not null default 'direct' check (type in ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid not null references auth.users(id),
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 20. CONVERSATION PARTICIPANTS
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

-- 21. MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  content text,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'video', 'file', 'system')),
  media_url text,
  media_metadata jsonb,
  reply_to_id uuid references public.messages(id) on delete set null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 22. MESSAGE READ RECEIPTS
create table if not exists public.message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

-- 23. VIDEO CALLS
create table if not exists public.video_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  initiated_by uuid not null references auth.users(id),
  call_type text not null default 'video' check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'missed', 'declined')),
  room_url text,
  room_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- ============================================================
-- STEP 2: INDEXES
-- ============================================================

create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_messages_reply_to
  on public.messages (reply_to_id) where reply_to_id is not null;

-- ============================================================
-- STEP 3: ENABLE RLS ON ALL NEW TABLES
-- ============================================================

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_read_receipts enable row level security;
alter table public.video_calls enable row level security;

-- ============================================================
-- STEP 4: RLS POLICIES (all tables exist now)
-- ============================================================

-- Conversations
create policy "Participants can view conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "Family members can create conversations" on public.conversations
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

create policy "Participants can update conversations" on public.conversations
  for update using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

-- Conversation Participants
create policy "Participants can view co-participants" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Conversation creators can add participants" on public.conversation_participants
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or auth.uid() = user_id
  );

create policy "Users can update own participation" on public.conversation_participants
  for update using (auth.uid() = user_id);

create policy "Users can leave conversations" on public.conversation_participants
  for delete using (auth.uid() = user_id);

-- Messages
create policy "Participants can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Senders can update own messages" on public.messages
  for update using (auth.uid() = sender_id);

-- Message Read Receipts
create policy "Participants can view read receipts" on public.message_read_receipts
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can mark messages read" on public.message_read_receipts
  for insert with check (auth.uid() = user_id);

-- Video Calls
create policy "Participants can view calls" on public.video_calls
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can create calls" on public.video_calls
  for insert with check (
    auth.uid() = initiated_by and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can update calls" on public.video_calls
  for update using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 5: RPCs
-- ============================================================

-- Find or create a direct conversation (prevents duplicate DM threads)
create or replace function public.find_or_create_direct_conversation(
  p_family_id uuid,
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_conversation_id uuid;
  v_my_id uuid := auth.uid();
begin
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_my_id
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = p_other_user_id
  where c.type = 'direct' and c.family_id = p_family_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (family_id, type, created_by)
  values (p_family_id, 'direct', v_my_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (v_conversation_id, v_my_id, 'admin'),
    (v_conversation_id, p_other_user_id, 'admin');

  return v_conversation_id;
end;
$$;

-- Get unread message counts per conversation
create or replace function public.get_unread_counts()
returns table(conversation_id uuid, unread_count bigint)
language sql
security definer
stable
as $$
  select
    cp.conversation_id,
    count(m.id) as unread_count
  from public.conversation_participants cp
  join public.messages m on m.conversation_id = cp.conversation_id
  where cp.user_id = auth.uid()
    and m.created_at > cp.last_read_at
    and m.sender_id != auth.uid()
    and m.is_deleted = false
  group by cp.conversation_id;
$$;

-- ============================================================
-- STEP 6: TRIGGERS
-- ============================================================

-- Auto-update last_message_preview on new message
create or replace function public.update_conversation_last_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set
    last_message_preview = case
      when NEW.message_type = 'text' then left(NEW.content, 100)
      when NEW.message_type = 'image' then 'Sent a photo'
      when NEW.message_type = 'video' then 'Sent a video'
      when NEW.message_type = 'file' then 'Sent a file'
      when NEW.message_type = 'system' then NEW.content
      else NEW.content
    end,
    last_message_at = NEW.created_at,
    updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

create or replace trigger on_new_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

-- updated_at triggers
create or replace trigger set_conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace trigger set_messages_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

-- ============================================================
-- STEP 7: STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public) values ('chat', 'chat', false)
  on conflict (id) do nothing;

create policy "Auth users upload chat media" on storage.objects for insert
  with check (bucket_id = 'chat' and auth.uid() is not null);

create policy "Auth users read chat media" on storage.objects for select
  using (bucket_id = 'chat' and auth.uid() is not null);

-- ============================================================
-- STEP 8: REALTIME
-- ============================================================

do $$
begin
  execute 'alter publication supabase_realtime add table public.messages';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.conversations';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.video_calls';
exception when others then null;
end $$;


-- ============================================================
-- FROM: supabase-god-mode.sql
-- ============================================================

-- ============================================================
-- On My Fam: God Mode Admin Schema
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- Adds: god mode column, global admin RLS bypass, admin helper.
-- ============================================================

-- 1. Add god mode flag to profiles
alter table public.profiles
  add column if not exists is_god_mode boolean not null default false;

-- 2. Helper function: check if current user is a god mode admin
create or replace function public.is_god_mode()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_god_mode = true
  );
$$;

-- 3. RPC: list ALL families (bypasses membership check for god mode)
create or replace function public.admin_list_families()
returns setof public.families
language sql
security definer
stable
as $$
  select * from public.families
  where is_god_mode()
  order by created_at desc;
$$;

-- 4. RPC: list ALL profiles (for user management)
create or replace function public.admin_list_profiles()
returns setof public.profiles
language sql
security definer
stable
as $$
  select * from public.profiles
  where is_god_mode()
  order by created_at desc;
$$;

-- 5. RPC: list ALL conversations (for god mode chat access)
create or replace function public.admin_list_conversations()
returns setof public.conversations
language sql
security definer
stable
as $$
  select * from public.conversations
  where is_god_mode()
  order by last_message_at desc nulls last;
$$;

-- 6. RPC: get messages for ANY conversation (god mode bypass)
create or replace function public.admin_get_messages(p_conversation_id uuid, p_limit int default 50)
returns setof public.messages
language sql
security definer
stable
as $$
  select * from public.messages
  where conversation_id = p_conversation_id
    and is_god_mode()
  order by created_at desc
  limit p_limit;
$$;

-- 7. RPC: get member counts and stats
create or replace function public.admin_get_stats()
returns json
language plpgsql
security definer
stable
as $$
declare
  result json;
begin
  if not is_god_mode() then
    return '{}'::json;
  end if;

  select json_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_families', (select count(*) from public.families),
    'total_posts', (select count(*) from public.posts),
    'total_events', (select count(*) from public.events),
    'total_conversations', (select count(*) from public.conversations),
    'total_messages', (select count(*) from public.messages),
    'total_albums', (select count(*) from public.albums),
    'total_discussions', (select count(*) from public.discussions)
  ) into result;

  return result;
end;
$$;

-- 8. RPC: toggle god mode for a user (only existing god mode users can do this)
create or replace function public.admin_set_god_mode(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
as $$
begin
  if not is_god_mode() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set is_god_mode = p_enabled
  where id = p_user_id;
end;
$$;

-- 9. RPC: join any family as admin (god mode override)
create or replace function public.admin_join_family(p_family_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_god_mode() then
    raise exception 'Not authorized';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (p_family_id, auth.uid(), 'admin')
  on conflict (family_id, user_id) do update set role = 'admin';
end;
$$;

-- 10. RPC: remove a user from a family (god mode)
create or replace function public.admin_remove_member(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_god_mode() then
    raise exception 'Not authorized';
  end if;

  delete from public.family_members
  where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- 11. RPC: delete any post (god mode)
create or replace function public.admin_delete_post(p_post_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_god_mode() then
    raise exception 'Not authorized';
  end if;

  delete from public.posts where id = p_post_id;
end;
$$;

-- 12. Update key RLS policies to allow god mode bypass
-- Families: god mode can see all
drop policy if exists "Members can view their families" on public.families;
create policy "Members or god mode can view families" on public.families
  for select using (is_family_member(id) or is_god_mode());

-- Posts: god mode can see all
drop policy if exists "Members can view family posts" on public.posts;
create policy "Members or god mode can view posts" on public.posts
  for select using (is_family_member(family_id) or is_god_mode());

-- Posts: god mode can delete any
drop policy if exists "Authors or admins can delete posts" on public.posts;
create policy "Authors admins or god mode can delete posts" on public.posts
  for delete using (auth.uid() = author_id or is_family_admin(family_id) or is_god_mode());

-- Family members: god mode can see all
drop policy if exists "Members can view co-members" on public.family_members;
create policy "Members or god mode can view members" on public.family_members
  for select using (is_family_member(family_id) or is_god_mode());

-- Events: god mode can see all
drop policy if exists "Members can view family events" on public.events;
create policy "Members or god mode can view events" on public.events
  for select using (is_family_member(family_id) or is_god_mode());

-- Albums: god mode can see all
drop policy if exists "Members can view family albums" on public.albums;
create policy "Members or god mode can view albums" on public.albums
  for select using (is_family_member(family_id) or is_god_mode());

-- Discussions: god mode can see all
drop policy if exists "Members can view discussions" on public.discussions;
create policy "Members or god mode can view discussions" on public.discussions
  for select using (is_family_member(family_id) or is_god_mode());

-- Conversations: god mode can see all
drop policy if exists "Participants can view conversations" on public.conversations;
create policy "Participants or god mode can view conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Messages: god mode can see all
drop policy if exists "Participants can view messages" on public.messages;
create policy "Participants or god mode can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Event chat: god mode can see all
drop policy if exists "Members can view event chat" on public.event_chat_messages;
create policy "Members or god mode can view event chat" on public.event_chat_messages
  for select using (
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Notifications: god mode can see all
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users or god mode can view notifications" on public.notifications
  for select using (auth.uid() = user_id or is_god_mode());

-- ============================================================
-- BOOTSTRAP: Set your account as god mode.
-- Replace the UUID below with YOUR Supabase auth user ID.
-- You can find it in Supabase Dashboard > Authentication > Users.
-- ============================================================
-- UPDATE public.profiles SET is_god_mode = true WHERE id = 'YOUR-USER-UUID-HERE';


-- ============================================================
-- FROM: supabase-god-mode-fix.sql
-- ============================================================

-- ============================================================
-- God Mode Fix: Add god mode bypass to ALL remaining tables
-- that were missed in the first pass.
-- ============================================================

-- Discussion replies: god mode can see all
drop policy if exists "Members can view replies" on public.discussion_replies;
create policy "Members or god mode can view replies" on public.discussion_replies
  for select using (
    exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Discussion replies: god mode can create
drop policy if exists "Members can reply" on public.discussion_replies;
create policy "Members or god mode can reply" on public.discussion_replies
  for insert with check (
    auth.uid() = author_id and (
      exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
      or is_god_mode()
    )
  );

-- Posts: god mode can create
drop policy if exists "Members can create posts" on public.posts;
create policy "Members or god mode can create posts" on public.posts
  for insert with check (
    (is_family_member(family_id) and auth.uid() = author_id)
    or (is_god_mode() and auth.uid() = author_id)
  );

-- Discussions: god mode can create
drop policy if exists "Members can create discussions" on public.discussions;
create policy "Members or god mode can create discussions" on public.discussions
  for insert with check (
    (is_family_member(family_id) and auth.uid() = author_id)
    or (is_god_mode() and auth.uid() = author_id)
  );

-- Events: god mode can create
drop policy if exists "Members can create events" on public.events;
create policy "Members or god mode can create events" on public.events
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Event RSVPs: god mode can view
drop policy if exists "Members can view RSVPs" on public.event_rsvps;
create policy "Members or god mode can view RSVPs" on public.event_rsvps
  for select using (
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Event chat: god mode can send
drop policy if exists "Members can send messages" on public.event_chat_messages;
create policy "Members or god mode can send event messages" on public.event_chat_messages
  for insert with check (
    (auth.uid() = user_id and exists (select 1 from public.events where id = event_id and is_family_member(family_id)))
    or (is_god_mode() and auth.uid() = user_id)
  );

-- Post media: god mode can view
drop policy if exists "Members can view post media" on public.post_media;
create policy "Members or god mode can view post media" on public.post_media
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Post reactions: god mode can view
drop policy if exists "Members can view reactions" on public.post_reactions;
create policy "Members or god mode can view reactions" on public.post_reactions
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Comments: god mode can view
drop policy if exists "Members can view comments" on public.comments;
create policy "Members or god mode can view comments" on public.comments
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Albums: god mode can create
drop policy if exists "Members can create albums" on public.albums;
create policy "Members or god mode can create albums" on public.albums
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Album media: god mode can view
drop policy if exists "Members can view album media" on public.album_media;
create policy "Members or god mode can view album media" on public.album_media
  for select using (
    exists (select 1 from public.albums where id = album_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Comment likes: god mode can view
drop policy if exists "Members can view comment likes" on public.comment_likes;
create policy "Members or god mode can view comment likes" on public.comment_likes
  for select using (
    exists (
      select 1 from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id and is_family_member(p.family_id)
    )
    or is_god_mode()
  );

-- Conversations: god mode can create
drop policy if exists "Family members can create conversations" on public.conversations;
create policy "Family members or god mode can create conversations" on public.conversations
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Conversation participants: god mode can view all
drop policy if exists "Participants can view co-participants" on public.conversation_participants;
create policy "Participants or god mode can view co-participants" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Conversation participants: god mode can add anyone
drop policy if exists "Conversation creators can add participants" on public.conversation_participants;
create policy "Creators or god mode can add participants" on public.conversation_participants
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or auth.uid() = user_id
    or is_god_mode()
  );

-- Messages: god mode can send to any conversation
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants or god mode can send messages" on public.messages
  for insert with check (
    (auth.uid() = sender_id and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    ))
    or (is_god_mode() and auth.uid() = sender_id)
  );


-- ============================================================
-- FROM: supabase-notifications.sql
-- ============================================================

-- Notifications table (may already exist from base schema, using IF NOT EXISTS)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Drop and recreate policies to handle the updated notifications table
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- Allow inserts from authenticated users (for sending notifications to others)
create policy "Authenticated users can create notifications" on public.notifications
  for insert with check (true);

-- Enable realtime on notifications
do $$
begin
  execute 'alter publication supabase_realtime add table public.notifications';
exception when others then null;
end $$;

-- Index for fast lookups
create index if not exists idx_notifications_user_unread on public.notifications (user_id, read, created_at desc);


-- ============================================================
-- FROM: supabase-comment-reactions.sql
-- ============================================================

-- Add reaction_type to comment_likes so comments support the same reactions as posts
alter table public.comment_likes add column if not exists reaction_type text not null default 'like';

-- Drop the unique constraint on (comment_id, user_id) and re-add it
-- (user can only have one reaction per comment)
alter table public.comment_likes drop constraint if exists comment_likes_comment_id_user_id_key;
alter table public.comment_likes add constraint comment_likes_comment_id_user_id_key unique (comment_id, user_id);


-- ============================================================
-- FROM: supabase-message-reactions.sql
-- ============================================================

-- Message reactions table for persistent chat reactions
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "Conversation members can view reactions" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can add reactions" on public.message_reactions
  for insert with check (auth.uid() = user_id);

create policy "Users can remove own reactions" on public.message_reactions
  for delete using (auth.uid() = user_id);

-- Enable realtime
do $$
begin
  execute 'alter publication supabase_realtime add table public.message_reactions';
exception when others then null;
end $$;


-- ============================================================
-- FROM: supabase-family-hierarchy.sql
-- ============================================================

-- ============================================================
-- Family Hierarchy: parent-child relationships between families
-- and multi-family support improvements.
-- ============================================================

-- Add parent_family_id for hierarchy
alter table public.families
  add column if not exists parent_family_id uuid references public.families(id) on delete set null;

-- Index for tree queries
create index if not exists idx_families_parent on public.families(parent_family_id)
  where parent_family_id is not null;

-- RPC: Get family tree (ancestors up from a given family)
create or replace function public.get_family_ancestors(p_family_id uuid)
returns table(
  id uuid,
  name text,
  parent_family_id uuid,
  member_count integer,
  depth integer
)
language plpgsql
security definer
stable
as $$
declare
  current_id uuid := p_family_id;
  d integer := 0;
begin
  loop
    return query
      select f.id, f.name, f.parent_family_id, f.member_count, d
      from public.families f where f.id = current_id;

    select f.parent_family_id into current_id
      from public.families f where f.id = current_id;

    if current_id is null then exit; end if;
    d := d + 1;
    if d > 20 then exit; end if;  -- safety limit
  end loop;
end;
$$;

-- RPC: Get child families (direct children of a family)
create or replace function public.get_child_families(p_family_id uuid)
returns setof public.families
language sql
security definer
stable
as $$
  select * from public.families
  where parent_family_id = p_family_id
  order by name;
$$;

-- RPC: Get full family tree downward from a root
create or replace function public.get_family_tree(p_root_id uuid)
returns table(
  id uuid,
  name text,
  description text,
  parent_family_id uuid,
  member_count integer,
  depth integer
)
language plpgsql
security definer
stable
as $$
begin
  return query
  with recursive tree as (
    select f.id, f.name, f.description, f.parent_family_id, f.member_count, 0 as depth
    from public.families f
    where f.id = p_root_id
    union all
    select f.id, f.name, f.description, f.parent_family_id, f.member_count, t.depth + 1
    from public.families f
    join tree t on f.parent_family_id = t.id
    where t.depth < 10  -- safety limit
  )
  select * from tree order by depth, name;
end;
$$;

-- RPC: Link a family under a parent (admin of child family)
create or replace function public.link_family_to_parent(p_child_id uuid, p_parent_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify caller is admin of the child family
  if not exists (
    select 1 from public.family_members
    where family_id = p_child_id
      and user_id = auth.uid()
      and role in ('admin', 'moderator')
  ) and not is_god_mode() then
    raise exception 'Must be admin of the family to link it';
  end if;

  -- Prevent circular references
  if p_child_id = p_parent_id then
    raise exception 'Cannot link a family to itself';
  end if;

  update public.families
  set parent_family_id = p_parent_id
  where id = p_child_id;
end;
$$;

-- RPC: Unlink a family from its parent
create or replace function public.unlink_family_from_parent(p_child_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.family_members
    where family_id = p_child_id
      and user_id = auth.uid()
      and role in ('admin', 'moderator')
  ) and not is_god_mode() then
    raise exception 'Must be admin of the family to unlink it';
  end if;

  update public.families
  set parent_family_id = null
  where id = p_child_id;
end;
$$;


-- ============================================================
-- FROM: supabase-family-search.sql
-- ============================================================

-- ============================================================
-- Family search: allow authenticated users to find families
-- that are public or invite_only (not private).
-- ============================================================

create or replace function public.search_families(p_query text)
returns table(
  id uuid,
  name text,
  description text,
  cover_url text,
  privacy_level text,
  member_count integer,
  established_year integer,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select
    f.id, f.name, f.description, f.cover_url,
    f.privacy_level, f.member_count, f.established_year, f.created_at
  from public.families f
  where f.privacy_level in ('public', 'invite_only')
    and (
      f.name ilike '%' || p_query || '%'
      or f.description ilike '%' || p_query || '%'
    )
  order by f.member_count desc
  limit 20;
$$;

-- Allow any member to create invites (not just admins)
drop policy if exists "Admins can create invites" on public.invites;
create policy "Members can create invites" on public.invites
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

-- Allow any member to view invites they created
drop policy if exists "Admins can view invites" on public.invites;
create policy "Members can view own invites" on public.invites
  for select using (auth.uid() = created_by or is_family_admin(family_id));


-- ============================================================
-- FROM: supabase-relation-requests.sql
-- ============================================================

-- Relation requests: when user A says "B is my Brother", B gets a notification to approve
create table if not exists public.relation_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  relation_label text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.relation_requests enable row level security;

create policy "Users can view their own requests" on public.relation_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Members can create requests" on public.relation_requests
  for insert with check (auth.uid() = from_user_id);

create policy "Recipients can update requests" on public.relation_requests
  for update using (auth.uid() = to_user_id);

-- When a relation request is approved, update both members' relation_labels
create or replace function public.approve_relation_request(request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
begin
  select * into req from public.relation_requests where id = request_id and to_user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found or not authorized';
  end if;

  -- Update request status
  update public.relation_requests set status = 'approved', updated_at = now() where id = request_id;

  -- Update the from_user's relation_label for the to_user
  update public.family_members set relation_label = req.relation_label
    where family_id = req.family_id and user_id = req.from_user_id;
end;
$$;


-- ============================================================
-- FROM: supabase-relation-requests-v2.sql
-- ============================================================

-- Add reverse_label column: what from_user is to to_user
alter table public.relation_requests add column if not exists reverse_label text;

-- Fix the approve function: no longer writes to family_members
-- Relations are now read directly from relation_requests where status = 'approved'
-- Allow either party to delete/remove a relationship
create policy "Either party can delete relations" on public.relation_requests
  for delete using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create or replace function public.approve_relation_request(request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
begin
  select * into req from public.relation_requests where id = request_id and to_user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found or not authorized';
  end if;

  update public.relation_requests set status = 'approved', updated_at = now() where id = request_id;
end;
$$;


-- ============================================================
-- FROM: supabase-claimable-accounts.sql
-- ============================================================

-- Claimable accounts: admin creates a placeholder member that someone can claim
create table if not exists public.claimable_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  claim_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  claimed_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table public.claimable_accounts enable row level security;

create policy "Family members can view claimable accounts" on public.claimable_accounts
  for select using (
    exists (select 1 from public.family_members where family_id = claimable_accounts.family_id and user_id = auth.uid())
    or claimed_by is null
  );

create policy "Admins can create claimable accounts" on public.claimable_accounts
  for insert with check (auth.uid() = created_by);

create policy "Users can claim accounts" on public.claimable_accounts
  for update using (claimed_by is null or auth.uid() = claimed_by);

create policy "Admins can delete claimable accounts" on public.claimable_accounts
  for delete using (
    exists (select 1 from public.family_members where family_id = claimable_accounts.family_id and user_id = auth.uid() and role in ('admin', 'moderator'))
  );


-- ============================================================
-- FROM: supabase-add-pinned.sql
-- ============================================================

-- Add pinned_at column to messages for persistent pins
alter table public.messages
  add column if not exists pinned_at timestamptz default null;


-- ============================================================
-- FROM: supabase-event-enhancements.sql
-- ============================================================

-- Add address and hosted_by columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hosted_by uuid[] DEFAULT '{}';


-- ============================================================
-- FROM: supabase-fix-family-creation.sql
-- ============================================================

-- ============================================================
-- Fix family creation and member insertion.
-- The family_members INSERT policy uses is_family_admin()
-- which recurses into family_members. Replace with simple checks.
-- ============================================================

-- Fix family_members INSERT - no recursive function calls
drop policy if exists "Admins can insert members" on public.family_members;

create policy "Insert family members" on public.family_members
  for insert with check (
    auth.uid() = user_id
    or is_god_mode()
  );

-- Fix family_members UPDATE
drop policy if exists "Admins can update members" on public.family_members;

create policy "Update family members" on public.family_members
  for update using (
    family_id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );

-- Fix family_members DELETE
drop policy if exists "Admins can delete members" on public.family_members;

create policy "Delete family members" on public.family_members
  for delete using (
    auth.uid() = user_id
    or family_id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );

-- Make sure families SELECT works (replace if it uses is_family_member which recurses)
drop policy if exists "Members or god mode can view families" on public.families;
drop policy if exists "Members can view their families" on public.families;

create policy "View families" on public.families
  for select using (
    id in (
      select fm.family_id from public.family_members fm where fm.user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Make sure families INSERT works
drop policy if exists "Authenticated users can create families" on public.families;

create policy "Create families" on public.families
  for insert with check (auth.uid() = created_by);

-- Make sure families UPDATE works without recursion
drop policy if exists "Admins can update families" on public.families;

create policy "Update families" on public.families
  for update using (
    id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );


-- ============================================================
-- FROM: supabase-fix-family-members.sql
-- ============================================================

-- ============================================================
-- Fix family_members SELECT recursion.
-- is_family_member() queries family_members, causing recursion.
-- Fix: allow users to see rows in families they belong to
-- by checking if ANY row with their user_id exists for that family.
-- ============================================================

drop policy if exists "View family members" on public.family_members;
drop policy if exists "Members or god mode can view members" on public.family_members;
drop policy if exists "Members can view co-members" on public.family_members;

create policy "View family members" on public.family_members
  for select using (
    family_id in (
      select fm.family_id from public.family_members fm where fm.user_id = auth.uid()
    )
    or is_god_mode()
  );


-- ============================================================
-- FROM: supabase-fix-posts-bucket.sql
-- ============================================================

-- Make posts bucket public so image URLs work
update storage.buckets set public = true where id = 'posts';


-- ============================================================
-- FROM: supabase-fix-chat-bucket.sql
-- ============================================================

-- Make chat bucket public so image URLs work
update storage.buckets set public = true where id = 'chat';


-- ============================================================
-- FROM: supabase-fix-chat-delete.sql
-- ============================================================

-- Allow conversation creators to delete their conversations
-- and participants to remove themselves (leave)

create policy "Delete own conversations" on public.conversations
  for delete using (
    created_by = auth.uid()
    or is_god_mode()

  );


-- ============================================================
-- FROM: supabase-fix-chat-participants.sql
-- ============================================================

-- ============================================================
-- Fix: Allow conversation creators to add other participants.
-- Uses security definer RPC to bypass RLS for adding members.
-- ============================================================

create or replace function public.create_group_chat(
  p_family_id uuid,
  p_name text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_conversation_id uuid;
  v_my_id uuid := auth.uid();
  v_member_id uuid;
begin
  -- Create conversation
  insert into public.conversations (family_id, type, name, created_by)
  values (p_family_id, 'group', p_name, v_my_id)
  returning id into v_conversation_id;

  -- Add creator as admin
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation_id, v_my_id, 'admin');

  -- Add other members
  foreach v_member_id in array p_member_ids
  loop
    if v_member_id != v_my_id then
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conversation_id, v_member_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  -- System message
  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (v_conversation_id, v_my_id, p_name || ' was created', 'system');

  return v_conversation_id;
end;
$$;


-- ============================================================
-- FROM: supabase-fix-participants-view.sql
-- ============================================================

-- Fix: let users see co-participants in their conversations
-- (not just their own row). Uses security definer to avoid recursion.

create or replace function public.user_conversation_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select conversation_id from public.conversation_participants where user_id = p_user_id;
$$;

drop policy if exists "View own participations or god mode" on public.conversation_participants;

create policy "View conversation participants" on public.conversation_participants
  for select using (
    conversation_id in (select user_conversation_ids(auth.uid()))
    or is_god_mode()
  );


-- ============================================================
-- FROM: supabase-fix-recursion.sql
-- ============================================================

-- ============================================================
-- Fix infinite recursion on conversation_participants.
-- The SELECT policy was self-referencing (checking the same
-- table it's protecting). Fix: check via conversations table.
-- ============================================================

-- Drop the recursive policies
drop policy if exists "Participants or god mode can view co-participants" on public.conversation_participants;
drop policy if exists "Participants can view co-participants" on public.conversation_participants;

-- New policy: check membership via conversations table instead of self-join
create policy "Participants or god mode can view co-participants" on public.conversation_participants
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by = auth.uid()
    )
    or is_god_mode()
  );

-- Also fix conversations SELECT to not depend on conversation_participants
drop policy if exists "Participants or god mode can view conversations" on public.conversations;
drop policy if exists "Participants can view conversations" on public.conversations;

create policy "Participants or god mode can view conversations" on public.conversations
  for select using (
    created_by = auth.uid()
    or id in (
      select conversation_id from public.conversation_participants where user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Fix messages SELECT to avoid going through conversation_participants with recursion
drop policy if exists "Participants or god mode can view messages" on public.messages;
drop policy if exists "Participants can view messages" on public.messages;

create policy "Participants or god mode can view messages" on public.messages
  for select using (
    sender_id = auth.uid()
    or conversation_id in (
      select conversation_id from public.conversation_participants where user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Fix messages INSERT
drop policy if exists "Participants or god mode can send messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;

create policy "Participants or god mode can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and (
      conversation_id in (
        select conversation_id from public.conversation_participants where user_id = auth.uid()
      )
      or is_god_mode()
    )
  );

-- Fix conversations UPDATE
drop policy if exists "Participants can update conversations" on public.conversations;

create policy "Participants or god mode can update conversations" on public.conversations
  for update using (
    created_by = auth.uid()
    or id in (
      select conversation_id from public.conversation_participants where user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Fix video_calls policies to use subquery instead of exists+join
drop policy if exists "Participants can view calls" on public.video_calls;
drop policy if exists "Participants can create calls" on public.video_calls;
drop policy if exists "Participants can update calls" on public.video_calls;

create policy "Participants or god mode can view calls" on public.video_calls
  for select using (
    initiated_by = auth.uid()
    or conversation_id in (
      select conversation_id from public.conversation_participants where user_id = auth.uid()
    )
    or is_god_mode()
  );

create policy "Participants or god mode can create calls" on public.video_calls
  for insert with check (
    auth.uid() = initiated_by and (
      conversation_id in (
        select conversation_id from public.conversation_participants where user_id = auth.uid()
      )
      or is_god_mode()
    )
  );

create policy "Participants or god mode can update calls" on public.video_calls
  for update using (
    conversation_id in (
      select conversation_id from public.conversation_participants where user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Fix read receipts
drop policy if exists "Participants can view read receipts" on public.message_read_receipts;

create policy "Participants or god mode can view read receipts" on public.message_read_receipts
  for select using (
    user_id = auth.uid()
    or is_god_mode()
  );


-- ============================================================
-- FROM: supabase-fix-recursion-v2.sql
-- ============================================================

-- ============================================================
-- Fix ALL cross-table recursion in chat RLS policies.
-- Strategy: conversation_participants uses ONLY uid checks,
-- no cross-table lookups. Other tables reference it safely.
-- ============================================================

-- STEP 1: conversation_participants - simple uid check only
drop policy if exists "Participants or god mode can view co-participants" on public.conversation_participants;
drop policy if exists "Participants can view co-participants" on public.conversation_participants;

create policy "View own participations or god mode" on public.conversation_participants
  for select using (
    auth.uid() = user_id
    or is_god_mode()
  );

-- STEP 2: conversations - use subquery on conversation_participants (safe now)
drop policy if exists "Participants or god mode can view conversations" on public.conversations;
drop policy if exists "Participants can view conversations" on public.conversations;

create policy "View own conversations or god mode" on public.conversations
  for select using (
    id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
    or is_god_mode()
  );

-- STEP 3: conversations INSERT
drop policy if exists "Family members or god mode can create conversations" on public.conversations;
drop policy if exists "Family members can create conversations" on public.conversations;

create policy "Create conversations" on public.conversations
  for insert with check (
    auth.uid() = created_by
    and (is_family_member(family_id) or is_god_mode())
  );

-- STEP 4: conversations UPDATE
drop policy if exists "Participants or god mode can update conversations" on public.conversations;
drop policy if exists "Participants can update conversations" on public.conversations;

create policy "Update own conversations or god mode" on public.conversations
  for update using (
    id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
    or is_god_mode()
  );

-- STEP 5: conversation_participants INSERT
drop policy if exists "Creators or god mode can add participants" on public.conversation_participants;
drop policy if exists "Conversation creators can add participants" on public.conversation_participants;

create policy "Add participants" on public.conversation_participants
  for insert with check (
    auth.uid() = user_id
    or is_god_mode()
  );

-- STEP 6: messages SELECT
drop policy if exists "Participants or god mode can view messages" on public.messages;
drop policy if exists "Participants can view messages" on public.messages;

create policy "View messages" on public.messages
  for select using (
    conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
    or is_god_mode()
  );

-- STEP 7: messages INSERT
drop policy if exists "Participants or god mode can send messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;

create policy "Send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and (
      conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
      or is_god_mode()
    )
  );

-- STEP 8: messages UPDATE (soft delete)
drop policy if exists "Senders can update own messages" on public.messages;

create policy "Update own messages" on public.messages
  for update using (auth.uid() = sender_id);

-- STEP 9: video_calls
drop policy if exists "Participants or god mode can view calls" on public.video_calls;
drop policy if exists "Participants can view calls" on public.video_calls;
drop policy if exists "Participants or god mode can create calls" on public.video_calls;
drop policy if exists "Participants can create calls" on public.video_calls;
drop policy if exists "Participants or god mode can update calls" on public.video_calls;
drop policy if exists "Participants can update calls" on public.video_calls;

create policy "View calls" on public.video_calls
  for select using (
    conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
    or is_god_mode()
  );

create policy "Create calls" on public.video_calls
  for insert with check (
    auth.uid() = initiated_by
    and (
      conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
      or is_god_mode()
    )
  );

create policy "Update calls" on public.video_calls
  for update using (
    conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
    or is_god_mode()
  );

-- STEP 10: read receipts
drop policy if exists "Participants or god mode can view read receipts" on public.message_read_receipts;
drop policy if exists "Participants can view read receipts" on public.message_read_receipts;

create policy "View read receipts" on public.message_read_receipts
  for select using (
    auth.uid() = user_id
    or is_god_mode()
  );

-- STEP 11: Also fix family_members view (the 400 error in console)
-- The profile join might be failing. Ensure god mode can see all members.
drop policy if exists "Members or god mode can view members" on public.family_members;
drop policy if exists "Members can view co-members" on public.family_members;

create policy "View family members" on public.family_members
  for select using (
    is_family_member(family_id) or is_god_mode()
  );


-- ============================================================
-- FROM: supabase-fix-all-recursion.sql
-- ============================================================

-- ============================================================
-- NUCLEAR FIX: Remove ALL recursive RLS policies.
-- Replace every policy that uses is_family_member(),
-- is_family_admin(), or cross-references family_members
-- with a security definer function that bypasses RLS.
-- ============================================================

-- Step 1: Create a helper that checks family membership WITHOUT RLS
create or replace function public.user_family_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select family_id from public.family_members where user_id = p_user_id;
$$;

create or replace function public.user_admin_family_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select family_id from public.family_members
  where user_id = p_user_id and role in ('admin', 'moderator');
$$;

-- Step 2: Fix ALL families policies
drop policy if exists "View families" on public.families;
drop policy if exists "Members or god mode can view families" on public.families;
drop policy if exists "Members can view their families" on public.families;

create policy "View families" on public.families
  for select using (
    id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Create families" on public.families;
drop policy if exists "Authenticated users can create families" on public.families;

create policy "Create families" on public.families
  for insert with check (auth.uid() = created_by);

drop policy if exists "Update families" on public.families;
drop policy if exists "Admins can update families" on public.families;

create policy "Update families" on public.families
  for update using (
    id in (select user_admin_family_ids(auth.uid()))
    or is_god_mode()
  );

-- Step 3: Fix ALL family_members policies
drop policy if exists "View family members" on public.family_members;
drop policy if exists "Members or god mode can view members" on public.family_members;
drop policy if exists "Members can view co-members" on public.family_members;

create policy "View family members" on public.family_members
  for select using (
    family_id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Insert family members" on public.family_members;
drop policy if exists "Admins can insert members" on public.family_members;

create policy "Insert family members" on public.family_members
  for insert with check (
    auth.uid() = user_id
    or is_god_mode()
  );

drop policy if exists "Update family members" on public.family_members;
drop policy if exists "Admins can update members" on public.family_members;

create policy "Update family members" on public.family_members
  for update using (
    family_id in (select user_admin_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Delete family members" on public.family_members;
drop policy if exists "Admins can delete members" on public.family_members;

create policy "Delete family members" on public.family_members
  for delete using (
    auth.uid() = user_id
    or family_id in (select user_admin_family_ids(auth.uid()))
    or is_god_mode()
  );

-- Step 4: Fix ALL posts policies
drop policy if exists "Members or god mode can view posts" on public.posts;
drop policy if exists "Members can view family posts" on public.posts;

create policy "View posts" on public.posts
  for select using (
    family_id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Members or god mode can create posts" on public.posts;
drop policy if exists "Members can create posts" on public.posts;

create policy "Create posts" on public.posts
  for insert with check (
    auth.uid() = author_id
    and (family_id in (select user_family_ids(auth.uid())) or is_god_mode())
  );

drop policy if exists "Authors admins or god mode can delete posts" on public.posts;
drop policy if exists "Authors or admins can delete posts" on public.posts;

create policy "Delete posts" on public.posts
  for delete using (
    auth.uid() = author_id
    or family_id in (select user_admin_family_ids(auth.uid()))
    or is_god_mode()
  );

-- Step 5: Fix events policies
drop policy if exists "Members or god mode can view events" on public.events;
drop policy if exists "Members can view family events" on public.events;

create policy "View events" on public.events
  for select using (
    family_id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Members or god mode can create events" on public.events;
drop policy if exists "Members can create events" on public.events;

create policy "Create events" on public.events
  for insert with check (
    auth.uid() = created_by
    and (family_id in (select user_family_ids(auth.uid())) or is_god_mode())
  );

-- Step 6: Fix discussions policies
drop policy if exists "Members or god mode can view discussions" on public.discussions;
drop policy if exists "Members can view discussions" on public.discussions;

create policy "View discussions" on public.discussions
  for select using (
    family_id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Members or god mode can create discussions" on public.discussions;
drop policy if exists "Members can create discussions" on public.discussions;

create policy "Create discussions" on public.discussions
  for insert with check (
    auth.uid() = author_id
    and (family_id in (select user_family_ids(auth.uid())) or is_god_mode())
  );

-- Step 7: Fix albums policies
drop policy if exists "Members or god mode can view albums" on public.albums;
drop policy if exists "Members can view family albums" on public.albums;

create policy "View albums" on public.albums
  for select using (
    family_id in (select user_family_ids(auth.uid()))
    or is_god_mode()
  );

drop policy if exists "Members or god mode can create albums" on public.albums;
drop policy if exists "Members can create albums" on public.albums;

create policy "Create albums" on public.albums
  for insert with check (
    auth.uid() = created_by
    and (family_id in (select user_family_ids(auth.uid())) or is_god_mode())
  );

-- Step 8: Fix conversations policies
drop policy if exists "Create conversations" on public.conversations;
drop policy if exists "Family members or god mode can create conversations" on public.conversations;
drop policy if exists "Family members can create conversations" on public.conversations;

create policy "Create conversations" on public.conversations
  for insert with check (
    auth.uid() = created_by
    and (family_id in (select user_family_ids(auth.uid())) or is_god_mode())
  );

-- Step 9: Fix remaining child table policies that use is_family_member
drop policy if exists "Members or god mode can view replies" on public.discussion_replies;
drop policy if exists "Members can view replies" on public.discussion_replies;

create policy "View replies" on public.discussion_replies
  for select using (
    exists (
      select 1 from public.discussions d
      where d.id = discussion_id
        and d.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

drop policy if exists "Members or god mode can reply" on public.discussion_replies;
drop policy if exists "Members can reply" on public.discussion_replies;

create policy "Create replies" on public.discussion_replies
  for insert with check (
    auth.uid() = author_id
    and (
      exists (
        select 1 from public.discussions d
        where d.id = discussion_id
          and d.family_id in (select user_family_ids(auth.uid()))
      )
      or is_god_mode()
    )
  );

-- Event RSVPs
drop policy if exists "Members or god mode can view RSVPs" on public.event_rsvps;
drop policy if exists "Members can view RSVPs" on public.event_rsvps;

create policy "View RSVPs" on public.event_rsvps
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Event chat
drop policy if exists "Members or god mode can view event chat" on public.event_chat_messages;
drop policy if exists "Members can view event chat" on public.event_chat_messages;

create policy "View event chat" on public.event_chat_messages
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

drop policy if exists "Members or god mode can send event messages" on public.event_chat_messages;
drop policy if exists "Members can send messages" on public.event_chat_messages;

create policy "Send event chat" on public.event_chat_messages
  for insert with check (
    auth.uid() = user_id
    and (
      exists (
        select 1 from public.events e
        where e.id = event_id
          and e.family_id in (select user_family_ids(auth.uid()))
      )
      or is_god_mode()
    )
  );

-- Post media
drop policy if exists "Members or god mode can view post media" on public.post_media;
drop policy if exists "Members can view post media" on public.post_media;

create policy "View post media" on public.post_media
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Post reactions
drop policy if exists "Members or god mode can view reactions" on public.post_reactions;
drop policy if exists "Members can view reactions" on public.post_reactions;

create policy "View reactions" on public.post_reactions
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Comments
drop policy if exists "Members or god mode can view comments" on public.comments;
drop policy if exists "Members can view comments" on public.comments;

create policy "View comments" on public.comments
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Comment likes
drop policy if exists "Members or god mode can view comment likes" on public.comment_likes;
drop policy if exists "Members can view comment likes" on public.comment_likes;

create policy "View comment likes" on public.comment_likes
  for select using (
    exists (
      select 1 from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id
        and p.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Album media
drop policy if exists "Members or god mode can view album media" on public.album_media;
drop policy if exists "Members can view album media" on public.album_media;

create policy "View album media" on public.album_media
  for select using (
    exists (
      select 1 from public.albums a
      where a.id = album_id
        and a.family_id in (select user_family_ids(auth.uid()))
    )
    or is_god_mode()
  );

-- Invites
drop policy if exists "Members can create invites" on public.invites;
drop policy if exists "Admins can create invites" on public.invites;

create policy "Create invites" on public.invites
  for insert with check (
    auth.uid() = created_by
    and family_id in (select user_family_ids(auth.uid()))
  );


-- ============================================================
-- FROM: supabase-fix-dislike.sql
-- ============================================================

-- Add 'dislike' to the allowed reaction types
alter table public.post_reactions drop constraint if exists post_reactions_reaction_type_check;
alter table public.post_reactions add constraint post_reactions_reaction_type_check
  check (reaction_type in ('like', 'dislike', 'love', 'celebrate', 'hug', 'laugh'));


-- ============================================================
-- FROM: supabase-cleanup-pinned-events.sql
-- ============================================================

-- Remove pinned event system messages
DELETE FROM public.messages WHERE content LIKE '%Event:%' AND message_type = 'system' AND pinned_at IS NOT NULL;


-- ============================================================
-- FROM: supabase-cleanup-relations.sql
-- ============================================================

-- Clean up all old relation data
-- Delete all existing relation_requests (start fresh with the new two-label system)
delete from public.relation_requests;

-- Clear all relation_labels from family_members (they're now read from relation_requests)
update public.family_members set relation_label = null where relation_label is not null;


-- ============================================================
-- FROM: supabase-chat-fix.sql
-- ============================================================

-- ============================================================
-- CLEANUP: Drop any partially-created policies from prior run,
-- then recreate everything. Tables already exist, so skip those.
-- ============================================================

-- Drop all chat-related policies (ignore errors if they don't exist)
drop policy if exists "Participants can view conversations" on public.conversations;
drop policy if exists "Family members can create conversations" on public.conversations;
drop policy if exists "Participants can update conversations" on public.conversations;

drop policy if exists "Participants can view co-participants" on public.conversation_participants;
drop policy if exists "Conversation creators can add participants" on public.conversation_participants;
drop policy if exists "Users can update own participation" on public.conversation_participants;
drop policy if exists "Users can leave conversations" on public.conversation_participants;

drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;
drop policy if exists "Senders can update own messages" on public.messages;

drop policy if exists "Participants can view read receipts" on public.message_read_receipts;
drop policy if exists "Users can mark messages read" on public.message_read_receipts;

drop policy if exists "Participants can view calls" on public.video_calls;
drop policy if exists "Participants can create calls" on public.video_calls;
drop policy if exists "Participants can update calls" on public.video_calls;

drop policy if exists "Auth users upload chat media" on storage.objects;
drop policy if exists "Auth users read chat media" on storage.objects;

-- ============================================================
-- INDEXES (idempotent)
-- ============================================================

create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_messages_reply_to
  on public.messages (reply_to_id) where reply_to_id is not null;

-- ============================================================
-- ENABLE RLS (idempotent)
-- ============================================================

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_read_receipts enable row level security;
alter table public.video_calls enable row level security;

-- ============================================================
-- RECREATE ALL POLICIES
-- ============================================================

-- Conversations
create policy "Participants can view conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "Family members can create conversations" on public.conversations
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

create policy "Participants can update conversations" on public.conversations
  for update using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

-- Conversation Participants
create policy "Participants can view co-participants" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Conversation creators can add participants" on public.conversation_participants
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or auth.uid() = user_id
  );

create policy "Users can update own participation" on public.conversation_participants
  for update using (auth.uid() = user_id);

create policy "Users can leave conversations" on public.conversation_participants
  for delete using (auth.uid() = user_id);

-- Messages
create policy "Participants can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

create policy "Senders can update own messages" on public.messages
  for update using (auth.uid() = sender_id);

-- Message Read Receipts
create policy "Participants can view read receipts" on public.message_read_receipts
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can mark messages read" on public.message_read_receipts
  for insert with check (auth.uid() = user_id);

-- Video Calls
create policy "Participants can view calls" on public.video_calls
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can create calls" on public.video_calls
  for insert with check (
    auth.uid() = initiated_by and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

create policy "Participants can update calls" on public.video_calls
  for update using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = video_calls.conversation_id and user_id = auth.uid()
    )
  );

-- ============================================================
-- RPCs (create or replace = idempotent)
-- ============================================================

create or replace function public.find_or_create_direct_conversation(
  p_family_id uuid,
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_conversation_id uuid;
  v_my_id uuid := auth.uid();
begin
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_my_id
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = p_other_user_id
  where c.type = 'direct' and c.family_id = p_family_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (family_id, type, created_by)
  values (p_family_id, 'direct', v_my_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (v_conversation_id, v_my_id, 'admin'),
    (v_conversation_id, p_other_user_id, 'admin');

  return v_conversation_id;
end;
$$;

create or replace function public.get_unread_counts()
returns table(conversation_id uuid, unread_count bigint)
language sql
security definer
stable
as $$
  select
    cp.conversation_id,
    count(m.id) as unread_count
  from public.conversation_participants cp
  join public.messages m on m.conversation_id = cp.conversation_id
  where cp.user_id = auth.uid()
    and m.created_at > cp.last_read_at
    and m.sender_id != auth.uid()
    and m.is_deleted = false
  group by cp.conversation_id;
$$;

-- ============================================================
-- TRIGGERS (create or replace = idempotent)
-- ============================================================

create or replace function public.update_conversation_last_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set
    last_message_preview = case
      when NEW.message_type = 'text' then left(NEW.content, 100)
      when NEW.message_type = 'image' then 'Sent a photo'
      when NEW.message_type = 'video' then 'Sent a video'
      when NEW.message_type = 'file' then 'Sent a file'
      when NEW.message_type = 'system' then NEW.content
      else NEW.content
    end,
    last_message_at = NEW.created_at,
    updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

create or replace trigger set_conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace trigger set_messages_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

-- ============================================================
-- STORAGE BUCKET (idempotent)
-- ============================================================

insert into storage.buckets (id, name, public) values ('chat', 'chat', false)
  on conflict (id) do nothing;

create policy "Auth users upload chat media" on storage.objects for insert
  with check (bucket_id = 'chat' and auth.uid() is not null);

create policy "Auth users read chat media" on storage.objects for select
  using (bucket_id = 'chat' and auth.uid() is not null);

-- ============================================================
-- REALTIME (ignore error if already added)
-- ============================================================

do $$
begin
  execute 'alter publication supabase_realtime add table public.messages';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.conversations';
exception when others then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.video_calls';
exception when others then null;
end $$;


-- ============================================================
-- END OF FULL MIGRATION
-- ============================================================
