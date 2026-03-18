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
