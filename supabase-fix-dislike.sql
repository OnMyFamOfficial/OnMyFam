-- Add 'dislike' to the allowed reaction types
alter table public.post_reactions drop constraint if exists post_reactions_reaction_type_check;
alter table public.post_reactions add constraint post_reactions_reaction_type_check
  check (reaction_type in ('like', 'dislike', 'love', 'celebrate', 'hug', 'laugh'));
