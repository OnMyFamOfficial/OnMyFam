-- Allow conversation creators to delete their conversations
-- and participants to remove themselves (leave)

create policy "Delete own conversations" on public.conversations
  for delete using (
    created_by = auth.uid()
    or is_god_mode()
  );
