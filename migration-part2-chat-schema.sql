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
