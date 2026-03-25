import type { Context } from "@netlify/functions";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, corsResponse } from "./_shared/cors";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        error: `Supabase config missing: URL=${supabaseUrl ? "ok" : "MISSING"}, KEY=${supabaseKey ? "ok" : "MISSING"}`
      }), { status: 500, headers: getCorsHeaders() });
    }

    // Verify user auth
    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");

    if (!bearerToken) {
      return new Response(JSON.stringify({ error: "No auth token provided" }), {
        status: 401, headers: getCorsHeaders(),
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: `Auth failed: ${authError?.message || "no user returned"}`
      }), { status: 401, headers: getCorsHeaders() });
    }

    // Parse request body
    const { roomName, participantName } = await req.json();

    if (!roomName) {
      return new Response(JSON.stringify({ error: "roomName is required" }), {
        status: 400, headers: getCorsHeaders(),
      });
    }

    // Generate LiveKit token
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500, headers: getCorsHeaders(),
      });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participantName || user.email?.split("@")[0] || "User",
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return new Response(JSON.stringify({ token: jwt }), {
      status: 200, headers: getCorsHeaders(),
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Server error: ${err.message}` }), {
      status: 500, headers: getCorsHeaders(),
    });
  }
};
