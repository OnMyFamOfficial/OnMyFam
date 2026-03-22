import type { Context } from "@netlify/functions";

const GIPHY_KEY = process.env.GIPHY_API_KEY || "ZGVuN9nUN1jlHftCOiYxWS5BhVQ9no3B";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Server-side in-memory cache (persists across warm function invocations)
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

export default async (req: Request, context: Context) => {
  const params = new URL(req.url).searchParams;
  const type = params.get("type") || "gifs"; // "gifs" or "stickers"
  const query = params.get("q") || "";
  const limit = params.get("limit") || "20";

  if (type !== "gifs" && type !== "stickers") {
    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400 });
  }

  const cacheKey = `${type}:${query.trim().toLowerCase() || "__trending__"}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "HIT",
      },
    });
  }

  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/${type}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
    : `https://api.giphy.com/v1/${type}/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return new Response(JSON.stringify({ data: [], error: "Giphy API error" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    const json = await res.json();
    const result = {
      data: (json.data || []).map((g: any) => ({
        id: g.id,
        url: g.images.original.url,
        preview: g.images.fixed_width_small.url,
        width: g.images.fixed_width_small.width,
        height: g.images.fixed_width_small.height,
      })),
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS",
      },
    });
  } catch {
    return new Response(JSON.stringify({ data: [] }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
