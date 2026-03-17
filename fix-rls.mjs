const TOKEN = "sbp_7a06364f138621311959afb0fa193bc82acece63";
const REF = "epnyqnmeadhepqfgbtef";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function exec(sql, label) {
  const r = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  console.log(`${label}: ${t.includes("ERROR") ? t.substring(0, 300) : "OK"}`);
}

// Fix family select: allow creator to see their own family
await exec(
  `drop policy if exists "Members can view their families" on public.families;`,
  "drop old family select"
);
await exec(
  `create policy "Members or creators can view families" on public.families for select using (is_family_member(id) or created_by = auth.uid());`,
  "new family select"
);

// Fix family_members insert: allow creator to add themselves
await exec(
  `drop policy if exists "Admins can insert members" on public.family_members;`,
  "drop old member insert"
);
await exec(
  `create policy "Creator or admins can insert members" on public.family_members for insert with check (
    auth.uid() = user_id or is_family_admin(family_id) or
    exists (select 1 from public.families where id = family_id and created_by = auth.uid())
  );`,
  "new member insert"
);

// Fix family_members select: allow creator to see members
await exec(
  `drop policy if exists "Members can view co-members" on public.family_members;`,
  "drop old member select"
);
await exec(
  `create policy "Members or creator can view co-members" on public.family_members for select using (
    is_family_member(family_id) or
    exists (select 1 from public.families where id = family_id and created_by = auth.uid())
  );`,
  "new member select"
);

console.log("\nRLS fixes applied.");
