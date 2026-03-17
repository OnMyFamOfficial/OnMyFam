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
