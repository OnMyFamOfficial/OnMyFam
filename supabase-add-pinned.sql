-- Add pinned_at column to messages for persistent pins
alter table public.messages
  add column if not exists pinned_at timestamptz default null;
