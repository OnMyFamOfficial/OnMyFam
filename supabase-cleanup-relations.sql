-- Clean up all old relation data
-- Delete all existing relation_requests (start fresh with the new two-label system)
delete from public.relation_requests;

-- Clear all relation_labels from family_members (they're now read from relation_requests)
update public.family_members set relation_label = null where relation_label is not null;
