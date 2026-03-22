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
drop policy if exists "View family members" on public.family_members;
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
