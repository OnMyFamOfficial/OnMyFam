-- Message reactions table for persistent chat reactions
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "Conversation members can view reactions" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can add reactions" on public.message_reactions
  for insert with check (auth.uid() = user_id);

create policy "Users can remove own reactions" on public.message_reactions
  for delete using (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table public.message_reactions;
