-- OnMyFam - Supabase RLS Policies Safety Net
-- Run these if policies ever get dropped or corrupted
-- Last verified working: April 1, 2026

-- ============================================
-- FAMILIES TABLE
-- ============================================

-- INSERT: Logged-in users can create families (must set themselves as creator)
DROP POLICY IF EXISTS "Authenticated users can create families" ON public.families;
DROP POLICY IF EXISTS "Create families" ON public.families;

CREATE POLICY "Authenticated users can create families"
ON public.families
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- SELECT: Members can see their families, creators can see families they just created
DROP POLICY IF EXISTS "View families" ON public.families;

CREATE POLICY "View families"
ON public.families
FOR SELECT
TO public
USING (
  id IN (SELECT user_family_ids(auth.uid()))
  OR created_by = auth.uid()
);

-- UPDATE: Only family admins can update family settings
DROP POLICY IF EXISTS "Update families" ON public.families;

CREATE POLICY "Update families"
ON public.families
FOR UPDATE
TO public
USING (id IN (SELECT user_admin_family_ids(auth.uid())));
