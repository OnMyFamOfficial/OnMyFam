-- Add reverse_label column: what from_user is to to_user
alter table public.relation_requests add column if not exists reverse_label text;

-- Fix the approve function: no longer writes to family_members
-- Relations are now read directly from relation_requests where status = 'approved'
-- Allow either party to delete/remove a relationship
create policy "Either party can delete relations" on public.relation_requests
  for delete using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create or replace function public.approve_relation_request(request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  req record;
begin
  select * into req from public.relation_requests where id = request_id and to_user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found or not authorized';
  end if;

  update public.relation_requests set status = 'approved', updated_at = now() where id = request_id;
end;
$$;
