import type { Context } from "@netlify/functions";
import { AccessToken } from "livekit-server-sdk";
import { getUser } from "./_shared/auth";
import { getCorsHeaders, corsResponse } from "./_shared/cors";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return corsResponse();

  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
};
