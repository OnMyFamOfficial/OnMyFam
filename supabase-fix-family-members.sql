-- ============================================================
-- Fix family_members SELECT recursion.
-- is_family_member() queries family_members, causing recursion.
-- Fix: allow users to see rows in families they belong to
-- by checking if ANY row with their user_id exists for that family.
-- ============================================================

drop policy if exists "View family members" on public.family_members;
drop policy if exists "Members or god mode can view members" on public.family_members;
drop policy if exists "Members can view co-members" on public.family_members;

create policy "View family members" on public.family_members
  for select using (
    family_id in (
      select fm.family_id from public.family_members fm where fm.user_id = auth.uid()
    )
    or is_god_mode()
  );
