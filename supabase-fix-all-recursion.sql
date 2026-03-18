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
