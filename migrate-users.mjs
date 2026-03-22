// Migrate auth users + profiles from old Supabase to new Supabase
import fs from 'fs';

const OLD_URL = 'https://epnyqnmeadhepqfgbtef.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwbnlxbm1lYWRoZXBxZmdidGVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ4NDYwMywiZXhwIjoyMDg4MDYwNjAzfQ.ycRAM1Ey--NqhZXWvlW2UiU9E6I9Zi2EGHw-je8pUkU';

const NEW_URL = 'https://qjbtazaklnoealybovll.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqYnRhemFrbG5vZWFseWJvdmxsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzODE4OCwiZXhwIjoyMDg5NzE0MTg4fQ.JjG83QoUDzKxUc03mMi3F97L92JIUj-wN0Go5Lp7q28';

const headers = (key) => ({
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json',
});

async function main() {
  // 1. Fetch all auth users from old project
  console.log('Fetching users from old project...');
  const usersRes = await fetch(`${OLD_URL}/auth/v1/admin/users?per_page=100`, { headers: headers(OLD_SERVICE_KEY) });
  const usersData = await usersRes.json();
  const users = usersData.users || [];
  console.log(`Found ${users.length} users`);

  // 2. Create each user on new project with same ID
  for (const user of users) {
    console.log(`\nMigrating: ${user.email} (${user.id.slice(0, 8)}...)`);

    // Create user via admin API with same ID
    const createRes = await fetch(`${NEW_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: headers(NEW_SERVICE_KEY),
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        email_confirm: true,
        password: undefined, // We'll handle password separately
        user_metadata: user.raw_user_meta_data || {},
        app_metadata: user.raw_app_meta_data || {},
      }),
    });

    const createData = await createRes.json();
    if (createRes.ok) {
      console.log(`  Auth user created: ${createData.id?.slice(0, 8)}...`);
    } else if (createData.msg?.includes('already') || createData.message?.includes('already')) {
      console.log(`  Already exists, skipping auth creation`);
    } else {
      console.log(`  ERROR creating auth user: ${JSON.stringify(createData)}`);
      continue;
    }
  }

  // 3. Fetch profiles from old project
  console.log('\n\nFetching profiles from old project...');
  const profilesRes = await fetch(`${OLD_URL}/rest/v1/profiles?select=*`, {
    headers: headers(OLD_SERVICE_KEY),
  });
  const profiles = await profilesRes.json();
  console.log(`Found ${profiles.length} profiles`);

  // 4. Insert profiles into new project
  for (const profile of profiles) {
    console.log(`Migrating profile: ${profile.display_name} (${profile.id.slice(0, 8)}...)`);

    const insertRes = await fetch(`${NEW_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        ...headers(NEW_SERVICE_KEY),
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(profile),
    });

    if (insertRes.ok) {
      console.log(`  Profile migrated`);
    } else {
      const err = await insertRes.text();
      console.log(`  ERROR: ${err}`);
    }
  }

  // 5. Fetch and migrate families
  console.log('\n\nFetching families...');
  const familiesRes = await fetch(`${OLD_URL}/rest/v1/families?select=*`, { headers: headers(OLD_SERVICE_KEY) });
  const families = await familiesRes.json();
  console.log(`Found ${families.length} families`);

  for (const fam of families) {
    const insertRes = await fetch(`${NEW_URL}/rest/v1/families`, {
      method: 'POST',
      headers: { ...headers(NEW_SERVICE_KEY), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(fam),
    });
    console.log(`  Family "${fam.name}": ${insertRes.ok ? 'migrated' : await insertRes.text()}`);
  }

  // 6. Fetch and migrate family_members
  console.log('\nFetching family members...');
  const membersRes = await fetch(`${OLD_URL}/rest/v1/family_members?select=*`, { headers: headers(OLD_SERVICE_KEY) });
  const members = await membersRes.json();
  console.log(`Found ${members.length} family members`);

  for (const mem of members) {
    const insertRes = await fetch(`${NEW_URL}/rest/v1/family_members`, {
      method: 'POST',
      headers: { ...headers(NEW_SERVICE_KEY), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(mem),
    });
    console.log(`  Member ${mem.user_id.slice(0, 8)}... in family ${mem.family_id.slice(0, 8)}...: ${insertRes.ok ? 'migrated' : await insertRes.text()}`);
  }

  // 7. Migrate posts
  console.log('\nFetching posts...');
  const postsRes = await fetch(`${OLD_URL}/rest/v1/posts?select=*`, { headers: headers(OLD_SERVICE_KEY) });
  const posts = await postsRes.json();
  console.log(`Found ${posts.length} posts`);

  if (posts.length > 0) {
    const insertRes = await fetch(`${NEW_URL}/rest/v1/posts`, {
      method: 'POST',
      headers: { ...headers(NEW_SERVICE_KEY), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(posts),
    });
    console.log(`  Posts: ${insertRes.ok ? 'migrated' : await insertRes.text()}`);
  }

  // 8. Migrate post_media
  console.log('\nFetching post media...');
  const mediaRes = await fetch(`${OLD_URL}/rest/v1/post_media?select=*`, { headers: headers(OLD_SERVICE_KEY) });
  const media = await mediaRes.json();
  console.log(`Found ${media.length} post media`);

  if (media.length > 0) {
    const insertRes = await fetch(`${NEW_URL}/rest/v1/post_media`, {
      method: 'POST',
      headers: { ...headers(NEW_SERVICE_KEY), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(media),
    });
    console.log(`  Post media: ${insertRes.ok ? 'migrated' : await insertRes.text()}`);
  }

  // 9. Migrate remaining tables
  const tables = [
    'post_reactions', 'comments', 'comment_likes',
    'events', 'event_rsvps', 'event_chat_messages',
    'albums', 'album_media',
    'discussions', 'discussion_replies',
    'invites', 'notifications',
    'conversations', 'conversation_participants', 'messages', 'message_read_receipts',
  ];

  for (const table of tables) {
    console.log(`\nFetching ${table}...`);
    const res = await fetch(`${OLD_URL}/rest/v1/${table}?select=*&limit=10000`, { headers: headers(OLD_SERVICE_KEY) });
    const rows = await res.json();

    if (!Array.isArray(rows)) {
      console.log(`  Skipped (${JSON.stringify(rows).slice(0, 100)})`);
      continue;
    }

    console.log(`  Found ${rows.length} rows`);
    if (rows.length === 0) continue;

    const insertRes = await fetch(`${NEW_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers(NEW_SERVICE_KEY), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });

    if (insertRes.ok) {
      console.log(`  Migrated ${rows.length} rows`);
    } else {
      const err = await insertRes.text();
      console.log(`  ERROR: ${err.slice(0, 200)}`);
    }
  }

  console.log('\n\n=== MIGRATION COMPLETE ===');
  console.log('NOTE: Users will need to reset their passwords since password hashes cannot be transferred.');
  console.log('Use the "Forgot Password" flow, or you can set temporary passwords via the Supabase dashboard.');
}

main().catch(console.error);
