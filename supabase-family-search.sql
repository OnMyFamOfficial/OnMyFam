-- ============================================================
-- Family search: allow authenticated users to find families
-- that are public or invite_only (not private).
-- ============================================================

create or replace function public.search_families(p_query text)
returns table(
  id uuid,
  name text,
  description text,
  cover_url text,
  privacy_level text,
  member_count integer,
  established_year integer,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select
    f.id, f.name, f.description, f.cover_url,
    f.privacy_level, f.member_count, f.established_year, f.created_at
  from public.families f
  where f.privacy_level in ('public', 'invite_only')
    and (
      f.name ilike '%' || p_query || '%'
      or f.description ilike '%' || p_query || '%'
    )
  order by f.member_count desc
  limit 20;
$$;

-- Allow any member to create invites (not just admins)
drop policy if exists "Admins can create invites" on public.invites;
create policy "Members can create invites" on public.invites
  for insert with check (is_family_member(family_id) and auth.uid() = created_by);

-- Allow any member to view invites they created
drop policy if exists "Admins can view invites" on public.invites;
create policy "Members can view own invites" on public.invites
  for select using (auth.uid() = created_by or is_family_admin(family_id));
