import type { Context } from "@netlify/functions";
import { supabaseAdmin } from "./_shared/supabase-admin";
import { getUser } from "./_shared/auth";
import { getCorsHeaders, corsResponse } from "./_shared/cors";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return corsResponse();
  const headers = getCorsHeaders();

  try {
    const user = await getUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    }

    const { family_id, email, max_uses = 1, expires_in_days = 7 } = await req.json();

    if (!family_id) {
      return new Response(JSON.stringify({ error: "family_id is required" }), {
        status: 400,
        headers,
      });
    }

    // Verify user is admin of this family
    const { data: membership } = await supabaseAdmin
      .from("family_members")
      .select("role")
      .eq("family_id", family_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["admin", "moderator"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers,
      });
    }

    const expires_at = new Date(
      Date.now() + expires_in_days * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("invites")
      .insert({
        family_id,
        created_by: user.id,
        email: email || null,
        max_uses,
        expires_at,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
};
