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
