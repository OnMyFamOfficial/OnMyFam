-- Relation requests: when user A says "B is my Brother", B gets a notification to approve
create table if not exists public.relation_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  relation_label text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.relation_requests enable row level security;

create policy "Users can view their own requests" on public.relation_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Members can create requests" on public.relation_requests
  for insert with check (auth.uid() = from_user_id);

create policy "Recipients can update requests" on public.relation_requests
  for update using (auth.uid() = to_user_id);

-- When a relation request is approved, update both members' relation_labels
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

  -- Update request status
  update public.relation_requests set status = 'approved', updated_at = now() where id = request_id;

  -- Update the from_user's relation_label for the to_user
  update public.family_members set relation_label = req.relation_label
    where family_id = req.family_id and user_id = req.from_user_id;
end;
$$;
