-- Add address and hosted_by columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hosted_by uuid[] DEFAULT '{}';
