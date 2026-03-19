-- ============================================================
-- Family Hierarchy: parent-child relationships between families
-- and multi-family support improvements.
-- ============================================================

-- Add parent_family_id for hierarchy
alter table public.families
  add column if not exists parent_family_id uuid references public.families(id) on delete set null;

-- Index for tree queries
create index if not exists idx_families_parent on public.families(parent_family_id)
  where parent_family_id is not null;

-- RPC: Get family tree (ancestors up from a given family)
create or replace function public.get_family_ancestors(p_family_id uuid)
returns table(
  id uuid,
  name text,
  parent_family_id uuid,
  member_count integer,
  depth integer
)
language plpgsql
security definer
stable
as $$
declare
  current_id uuid := p_family_id;
  d integer := 0;
begin
  loop
    return query
      select f.id, f.name, f.parent_family_id, f.member_count, d
      from public.families f where f.id = current_id;

    select f.parent_family_id into current_id
      from public.families f where f.id = current_id;

    if current_id is null then exit; end if;
    d := d + 1;
    if d > 20 then exit; end if;  -- safety limit
  end loop;
end;
$$;

-- RPC: Get child families (direct children of a family)
create or replace function public.get_child_families(p_family_id uuid)
returns setof public.families
language sql
security definer
stable
as $$
  select * from public.families
  where parent_family_id = p_family_id
  order by name;
$$;

-- RPC: Get full family tree downward from a root
create or replace function public.get_family_tree(p_root_id uuid)
returns table(
  id uuid,
  name text,
  description text,
  parent_family_id uuid,
  member_count integer,
  depth integer
)
language plpgsql
security definer
stable
as $$
begin
  return query
  with recursive tree as (
    select f.id, f.name, f.description, f.parent_family_id, f.member_count, 0 as depth
    from public.families f
    where f.id = p_root_id
    union all
    select f.id, f.name, f.description, f.parent_family_id, f.member_count, t.depth + 1
    from public.families f
    join tree t on f.parent_family_id = t.id
    where t.depth < 10  -- safety limit
  )
  select * from tree order by depth, name;
end;
$$;

-- RPC: Link a family under a parent (admin of child family)
create or replace function public.link_family_to_parent(p_child_id uuid, p_parent_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify caller is admin of the child family
  if not exists (
    select 1 from public.family_members
    where family_id = p_child_id
      and user_id = auth.uid()
      and role in ('admin', 'moderator')
  ) and not is_god_mode() then
    raise exception 'Must be admin of the family to link it';
  end if;

  -- Prevent circular references
  if p_child_id = p_parent_id then
    raise exception 'Cannot link a family to itself';
  end if;

  update public.families
  set parent_family_id = p_parent_id
  where id = p_child_id;
end;
$$;

-- RPC: Unlink a family from its parent
create or replace function public.unlink_family_from_parent(p_child_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.family_members
    where family_id = p_child_id
      and user_id = auth.uid()
      and role in ('admin', 'moderator')
  ) and not is_god_mode() then
    raise exception 'Must be admin of the family to unlink it';
  end if;

  update public.families
  set parent_family_id = null
  where id = p_child_id;
end;
$$;
