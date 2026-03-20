-- Claimable accounts: admin creates a placeholder member that someone can claim
create table if not exists public.claimable_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  claim_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  claimed_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table public.claimable_accounts enable row level security;

create policy "Family members can view claimable accounts" on public.claimable_accounts
  for select using (
    exists (select 1 from public.family_members where family_id = claimable_accounts.family_id and user_id = auth.uid())
    or claimed_by is null
  );

create policy "Admins can create claimable accounts" on public.claimable_accounts
  for insert with check (auth.uid() = created_by);

create policy "Users can claim accounts" on public.claimable_accounts
  for update using (claimed_by is null or auth.uid() = claimed_by);

create policy "Admins can delete claimable accounts" on public.claimable_accounts
  for delete using (
    exists (select 1 from public.family_members where family_id = claimable_accounts.family_id and user_id = auth.uid() and role in ('admin', 'moderator'))
  );
