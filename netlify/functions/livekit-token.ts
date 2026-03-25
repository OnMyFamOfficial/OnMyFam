import type { Context } from "@netlify/functions";
import { AccessToken } from "livekit-server-sdk";
import { getUser } from "./_shared/auth";
import { getCorsHeaders, corsResponse } from "./_shared/cors";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    console.log("[livekit-token] SUPABASE_URL:", process.env.SUPABASE_URL ? "set" : "MISSING");
    console.log("[livekit-token] SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "set" : "MISSING");
    console.log("[livekit-token] Auth header present:", !!req.headers.get("Authorization"));

    const user = await getUser(req);
    console.log("[livekit-token] User:", user ? user.id : "null");
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized — could not verify user session" }), {
        status: 401,
        headers: getCorsHeaders(),
      });
    }

    const { roomName, participantName } = await req.json();

    if (!roomName) {
      return new Response(JSON.stringify({ error: "roomName is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: getCorsHeaders(),
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
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (err: any) {
    console.error("[livekit-token] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
};
