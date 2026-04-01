-- Add guest support to events
-- allow_guests: organizer toggle to let attendees bring +guests
-- guest_count: how many additional people this RSVP is bringing

alter table public.events add column if not exists allow_guests boolean not null default false;
alter table public.event_rsvps add column if not exists guest_count integer not null default 0;
