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

-- Notifications table already exists from base schema.
-- Add missing columns if they don't exist yet.
alter table public.notifications add column if not exists data jsonb default '{}';

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
create index if not exists idx_notifications_user_unread on public.notifications (user_id, is_read, created_at desc);


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
