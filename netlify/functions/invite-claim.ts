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

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers,
      });
    }

    // Look up the invite
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invite" }), {
        status: 404,
        headers,
      });
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invite expired" }), {
        status: 410,
        headers,
      });
    }

    // Check max uses
    if (invite.used_count >= invite.max_uses) {
      return new Response(
        JSON.stringify({ error: "Invite has been fully used" }),
        { status: 410, headers }
      );
    }

    // Check if already a member
    const { data: existing } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("family_id", invite.family_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Already a member", family_id: invite.family_id }),
        { status: 200, headers }
      );
    }

    // Add as member
    const { error: memberErr } = await supabaseAdmin
      .from("family_members")
      .insert({
        family_id: invite.family_id,
        user_id: user.id,
        role: "member",
      });

    if (memberErr) throw memberErr;

    // Increment used_count
    await supabaseAdmin
      .from("invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, family_id: invite.family_id }),
      { status: 200, headers }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
};
