import fs from "fs";

const TOKEN = "sbp_7a06364f138621311959afb0fa193bc82acece63";
const REF = "epnyqnmeadhepqfgbtef";
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function exec(sql, label) {
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (t.includes("ERROR")) {
    console.log(`${label} ERROR:`, t.substring(0, 400));
    return false;
  }
  console.log(`${label}: OK`);
  return true;
}

// Read the full schema and split into executable chunks
const schema = fs.readFileSync("supabase-schema.sql", "utf8");

// Split by the section headers
const sections = schema.split(/^-- =+$/m).filter((s) => s.trim());

// We need to run in order: tables first, then helper functions, then RLS, then triggers, then storage
// Simplest approach: run the whole thing but create tables before functions

// Step 1: Create tables only (extract CREATE TABLE statements)
const tableStatements = schema
  .split(";")
  .filter((s) => s.toLowerCase().includes("create table"))
  .map((s) => s.trim() + ";");

console.log(`Found ${tableStatements.length} CREATE TABLE statements\n`);

for (let i = 0; i < tableStatements.length; i++) {
  const tableName = tableStatements[i].match(
    /create table if not exists (\S+)/i
  );
  await exec(tableStatements[i], tableName ? tableName[1] : `table_${i}`);
}

// Step 2: Enable RLS on all tables
console.log("\n--- Enabling RLS ---");
const rlsStatements = schema
  .split(";")
  .filter((s) => s.toLowerCase().includes("enable row level security"))
  .map((s) => s.trim() + ";");

for (const stmt of rlsStatements) {
  const tableName = stmt.match(/alter table (\S+)/i);
  await exec(stmt, `RLS ${tableName ? tableName[1] : "?"}`);
}

// Step 3: Create helper functions (is_family_member, is_family_admin)
console.log("\n--- Creating helper functions ---");
await exec(
  `
create or replace function is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid()
  );
$$;
`,
  "is_family_member"
);

await exec(
  `
create or replace function is_family_admin(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid() and role in ('admin', 'moderator')
  );
$$;
`,
  "is_family_admin"
);

// Step 4: Create all RLS policies
console.log("\n--- Creating RLS policies ---");
const policyStatements = schema
  .split(";")
  .filter((s) => s.toLowerCase().includes("create policy"))
  .map((s) => s.trim() + ";");

console.log(`Found ${policyStatements.length} policies`);
for (const stmt of policyStatements) {
  const name = stmt.match(/create policy "([^"]+)"/i);
  await exec(stmt, name ? name[1] : "policy");
}

// Step 5: Create trigger functions and triggers
console.log("\n--- Creating functions & triggers ---");

// handle_new_user
await exec(
  `
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
`,
  "handle_new_user function"
);

await exec(
  `
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
`,
  "on_auth_user_created trigger"
);

// set_updated_at
await exec(
  `
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
`,
  "set_updated_at function"
);

// updated_at triggers
const updatedAtTables = [
  "profiles",
  "families",
  "posts",
  "comments",
  "events",
  "event_rsvps",
  "albums",
  "discussions",
  "discussion_replies",
];
for (const t of updatedAtTables) {
  await exec(
    `create or replace trigger set_${t}_updated_at before update on public.${t} for each row execute function public.set_updated_at();`,
    `updated_at trigger: ${t}`
  );
}

// Counter trigger functions
const counterFunctions = [
  {
    name: "update_family_member_count",
    body: `
create or replace function public.update_family_member_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.families set member_count = member_count + 1 where id = NEW.family_id;
  elsif TG_OP = 'DELETE' then update public.families set member_count = member_count - 1 where id = OLD.family_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_family_member_change after insert or delete on public.family_members for each row execute function public.update_family_member_count();`,
  },
  {
    name: "update_post_reaction_count",
    body: `
create or replace function public.update_post_reaction_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.posts set reaction_count = reaction_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then update public.posts set reaction_count = reaction_count - 1 where id = OLD.post_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_post_reaction_change after insert or delete on public.post_reactions for each row execute function public.update_post_reaction_count();`,
  },
  {
    name: "update_post_comment_count",
    body: `
create or replace function public.update_post_comment_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then update public.posts set comment_count = comment_count - 1 where id = OLD.post_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_comment_change after insert or delete on public.comments for each row execute function public.update_post_comment_count();`,
  },
  {
    name: "update_comment_like_count",
    body: `
create or replace function public.update_comment_like_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.comments set like_count = like_count + 1 where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' then update public.comments set like_count = like_count - 1 where id = OLD.comment_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_comment_like_change after insert or delete on public.comment_likes for each row execute function public.update_comment_like_count();`,
  },
  {
    name: "update_event_rsvp_counts",
    body: `
create or replace function public.update_event_rsvp_counts() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'DELETE' then
    update public.events set going_count = (select count(*) from public.event_rsvps where event_id = OLD.event_id and status = 'going'), maybe_count = (select count(*) from public.event_rsvps where event_id = OLD.event_id and status = 'maybe') where id = OLD.event_id;
    return OLD;
  else
    update public.events set going_count = (select count(*) from public.event_rsvps where event_id = NEW.event_id and status = 'going'), maybe_count = (select count(*) from public.event_rsvps where event_id = NEW.event_id and status = 'maybe') where id = NEW.event_id;
    return NEW;
  end if;
end; $$;`,
    trigger: `create or replace trigger on_event_rsvp_change after insert or update or delete on public.event_rsvps for each row execute function public.update_event_rsvp_counts();`,
  },
  {
    name: "update_album_media_count",
    body: `
create or replace function public.update_album_media_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.albums set media_count = media_count + 1 where id = NEW.album_id;
  elsif TG_OP = 'DELETE' then update public.albums set media_count = media_count - 1 where id = OLD.album_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_album_media_change after insert or delete on public.album_media for each row execute function public.update_album_media_count();`,
  },
  {
    name: "update_discussion_reply_count",
    body: `
create or replace function public.update_discussion_reply_count() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then update public.discussions set reply_count = reply_count + 1 where id = NEW.discussion_id;
  elsif TG_OP = 'DELETE' then update public.discussions set reply_count = reply_count - 1 where id = OLD.discussion_id;
  end if; return coalesce(NEW, OLD);
end; $$;`,
    trigger: `create or replace trigger on_discussion_reply_change after insert or delete on public.discussion_replies for each row execute function public.update_discussion_reply_count();`,
  },
];

for (const cf of counterFunctions) {
  await exec(cf.body, `${cf.name} function`);
  await exec(cf.trigger, `${cf.name} trigger`);
}

// Step 6: Storage buckets
console.log("\n--- Creating storage buckets ---");
const buckets = ["avatars", "covers", "posts", "albums", "events"];
for (const b of buckets) {
  const isPublic = b === "avatars" || b === "covers";
  await exec(
    `insert into storage.buckets (id, name, public) values ('${b}', '${b}', ${isPublic}) on conflict (id) do nothing;`,
    `bucket: ${b}`
  );
}

// Step 7: Storage policies
console.log("\n--- Creating storage policies ---");
const storagePolicies = [
  {
    name: "Public avatar read",
    sql: `create policy "Public avatar read" on storage.objects for select using (bucket_id = 'avatars');`,
  },
  {
    name: "Users upload own avatar",
    sql: `create policy "Users upload own avatar" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);`,
  },
  {
    name: "Users update own avatar",
    sql: `create policy "Users update own avatar" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);`,
  },
  {
    name: "Public cover read",
    sql: `create policy "Public cover read" on storage.objects for select using (bucket_id = 'covers');`,
  },
  {
    name: "Auth users upload covers",
    sql: `create policy "Auth users upload covers" on storage.objects for insert with check (bucket_id = 'covers' and auth.uid() is not null);`,
  },
  {
    name: "Auth users upload post media",
    sql: `create policy "Auth users upload post media" on storage.objects for insert with check (bucket_id = 'posts' and auth.uid() is not null);`,
  },
  {
    name: "Auth users read post media",
    sql: `create policy "Auth users read post media" on storage.objects for select using (bucket_id = 'posts' and auth.uid() is not null);`,
  },
  {
    name: "Auth users upload album media",
    sql: `create policy "Auth users upload album media" on storage.objects for insert with check (bucket_id = 'albums' and auth.uid() is not null);`,
  },
  {
    name: "Auth users read album media",
    sql: `create policy "Auth users read album media" on storage.objects for select using (bucket_id = 'albums' and auth.uid() is not null);`,
  },
  {
    name: "Auth users upload event media",
    sql: `create policy "Auth users upload event media" on storage.objects for insert with check (bucket_id = 'events' and auth.uid() is not null);`,
  },
  {
    name: "Auth users read event media",
    sql: `create policy "Auth users read event media" on storage.objects for select using (bucket_id = 'events' and auth.uid() is not null);`,
  },
];

for (const sp of storagePolicies) {
  await exec(sp.sql, sp.name);
}

// Step 8: Realtime
console.log("\n--- Enabling realtime ---");
await exec(
  `alter publication supabase_realtime add table public.event_chat_messages;`,
  "realtime: event_chat_messages"
);
await exec(
  `alter publication supabase_realtime add table public.notifications;`,
  "realtime: notifications"
);
await exec(
  `alter publication supabase_realtime add table public.posts;`,
  "realtime: posts"
);
await exec(
  `alter publication supabase_realtime add table public.comments;`,
  "realtime: comments"
);

console.log("\n=== SCHEMA SETUP COMPLETE ===");
