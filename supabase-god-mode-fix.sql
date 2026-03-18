-- ============================================================
-- God Mode Fix: Add god mode bypass to ALL remaining tables
-- that were missed in the first pass.
-- ============================================================

-- Discussion replies: god mode can see all
drop policy if exists "Members can view replies" on public.discussion_replies;
create policy "Members or god mode can view replies" on public.discussion_replies
  for select using (
    exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Discussion replies: god mode can create
drop policy if exists "Members can reply" on public.discussion_replies;
create policy "Members or god mode can reply" on public.discussion_replies
  for insert with check (
    auth.uid() = author_id and (
      exists (select 1 from public.discussions where id = discussion_id and is_family_member(family_id))
      or is_god_mode()
    )
  );

-- Posts: god mode can create
drop policy if exists "Members can create posts" on public.posts;
create policy "Members or god mode can create posts" on public.posts
  for insert with check (
    (is_family_member(family_id) and auth.uid() = author_id)
    or (is_god_mode() and auth.uid() = author_id)
  );

-- Discussions: god mode can create
drop policy if exists "Members can create discussions" on public.discussions;
create policy "Members or god mode can create discussions" on public.discussions
  for insert with check (
    (is_family_member(family_id) and auth.uid() = author_id)
    or (is_god_mode() and auth.uid() = author_id)
  );

-- Events: god mode can create
drop policy if exists "Members can create events" on public.events;
create policy "Members or god mode can create events" on public.events
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Event RSVPs: god mode can view
drop policy if exists "Members can view RSVPs" on public.event_rsvps;
create policy "Members or god mode can view RSVPs" on public.event_rsvps
  for select using (
    exists (select 1 from public.events where id = event_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Event chat: god mode can send
drop policy if exists "Members can send messages" on public.event_chat_messages;
create policy "Members or god mode can send event messages" on public.event_chat_messages
  for insert with check (
    (auth.uid() = user_id and exists (select 1 from public.events where id = event_id and is_family_member(family_id)))
    or (is_god_mode() and auth.uid() = user_id)
  );

-- Post media: god mode can view
drop policy if exists "Members can view post media" on public.post_media;
create policy "Members or god mode can view post media" on public.post_media
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Post reactions: god mode can view
drop policy if exists "Members can view reactions" on public.post_reactions;
create policy "Members or god mode can view reactions" on public.post_reactions
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Comments: god mode can view
drop policy if exists "Members can view comments" on public.comments;
create policy "Members or god mode can view comments" on public.comments
  for select using (
    exists (select 1 from public.posts where id = post_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Albums: god mode can create
drop policy if exists "Members can create albums" on public.albums;
create policy "Members or god mode can create albums" on public.albums
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Album media: god mode can view
drop policy if exists "Members can view album media" on public.album_media;
create policy "Members or god mode can view album media" on public.album_media
  for select using (
    exists (select 1 from public.albums where id = album_id and is_family_member(family_id))
    or is_god_mode()
  );

-- Comment likes: god mode can view
drop policy if exists "Members can view comment likes" on public.comment_likes;
create policy "Members or god mode can view comment likes" on public.comment_likes
  for select using (
    exists (
      select 1 from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id and is_family_member(p.family_id)
    )
    or is_god_mode()
  );

-- Conversations: god mode can create
drop policy if exists "Family members can create conversations" on public.conversations;
create policy "Family members or god mode can create conversations" on public.conversations
  for insert with check (
    (is_family_member(family_id) and auth.uid() = created_by)
    or (is_god_mode() and auth.uid() = created_by)
  );

-- Conversation participants: god mode can view all
drop policy if exists "Participants can view co-participants" on public.conversation_participants;
create policy "Participants or god mode can view co-participants" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Conversation participants: god mode can add anyone
drop policy if exists "Conversation creators can add participants" on public.conversation_participants;
create policy "Creators or god mode can add participants" on public.conversation_participants
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or auth.uid() = user_id
    or is_god_mode()
  );

-- Messages: god mode can send to any conversation
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants or god mode can send messages" on public.messages
  for insert with check (
    (auth.uid() = sender_id and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    ))
    or (is_god_mode() and auth.uid() = sender_id)
  );
