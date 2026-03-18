-- ============================================================
-- Fix family creation and member insertion.
-- The family_members INSERT policy uses is_family_admin()
-- which recurses into family_members. Replace with simple checks.
-- ============================================================

-- Fix family_members INSERT - no recursive function calls
drop policy if exists "Admins can insert members" on public.family_members;

create policy "Insert family members" on public.family_members
  for insert with check (
    auth.uid() = user_id
    or is_god_mode()
  );

-- Fix family_members UPDATE
drop policy if exists "Admins can update members" on public.family_members;

create policy "Update family members" on public.family_members
  for update using (
    family_id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );

-- Fix family_members DELETE
drop policy if exists "Admins can delete members" on public.family_members;

create policy "Delete family members" on public.family_members
  for delete using (
    auth.uid() = user_id
    or family_id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );

-- Make sure families SELECT works (replace if it uses is_family_member which recurses)
drop policy if exists "Members or god mode can view families" on public.families;
drop policy if exists "Members can view their families" on public.families;

create policy "View families" on public.families
  for select using (
    id in (
      select fm.family_id from public.family_members fm where fm.user_id = auth.uid()
    )
    or is_god_mode()
  );

-- Make sure families INSERT works
drop policy if exists "Authenticated users can create families" on public.families;

create policy "Create families" on public.families
  for insert with check (auth.uid() = created_by);

-- Make sure families UPDATE works without recursion
drop policy if exists "Admins can update families" on public.families;

create policy "Update families" on public.families
  for update using (
    id in (
      select fm.family_id from public.family_members fm
      where fm.user_id = auth.uid() and fm.role in ('admin', 'moderator')
    )
    or is_god_mode()
  );
