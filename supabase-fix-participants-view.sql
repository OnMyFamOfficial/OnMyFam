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
