-- Add reaction_type to comment_likes so comments support the same reactions as posts
alter table public.comment_likes add column if not exists reaction_type text not null default 'like';

-- Drop the unique constraint on (comment_id, user_id) and re-add it
-- (user can only have one reaction per comment)
alter table public.comment_likes drop constraint if exists comment_likes_comment_id_user_id_key;
alter table public.comment_likes add constraint comment_likes_comment_id_user_id_key unique (comment_id, user_id);
