-- Remove pinned event system messages
DELETE FROM public.messages WHERE content LIKE '%Event:%' AND message_type = 'system' AND pinned_at IS NOT NULL;
