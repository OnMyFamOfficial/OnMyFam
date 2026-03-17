import { createClient } from "@supabase/supabase-js";

/**
 * Extracts and verifies the Supabase user from an Authorization: Bearer header.
 * Returns the user object or null if invalid/missing.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
