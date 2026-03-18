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
