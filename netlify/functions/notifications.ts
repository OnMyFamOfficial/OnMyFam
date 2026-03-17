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

    if (req.method === "GET") {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const unread_only = url.searchParams.get("unread") === "true";

      let query = supabaseAdmin
        .from("notifications")
        .select("*, actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (unread_only) {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    if (req.method === "PUT") {
      const { ids } = await req.json();

      if (ids && Array.isArray(ids)) {
        // Mark specific notifications as read
        const { error } = await supabaseAdmin
          .from("notifications")
          .update({ is_read: true })
          .in("id", ids)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Mark all as read
        const { error } = await supabaseAdmin
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
};
