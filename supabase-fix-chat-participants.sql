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
