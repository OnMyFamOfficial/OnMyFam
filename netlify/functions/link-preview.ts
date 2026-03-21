import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OnMyFam/1.0; +https://onmyfam.com)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await response.text();

    // Extract Open Graph and meta tags
    const getMetaContent = (property: string): string | null => {
      // Try og: tags
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, "i"));
      if (ogMatch) return ogMatch[1];

      // Try name= tags
      const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, "i"));
      if (nameMatch) return nameMatch[1];

      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const title = getMetaContent("og:title") || getMetaContent("twitter:title") || (titleMatch ? titleMatch[1] : null);
    const description = getMetaContent("og:description") || getMetaContent("twitter:description") || getMetaContent("description");
    const image = getMetaContent("og:image") || getMetaContent("twitter:image");
    const siteName = getMetaContent("og:site_name");
    const domain = new URL(url).hostname.replace("www.", "");

    // Make relative image URLs absolute
    let absoluteImage = image;
    if (image && !image.startsWith("http")) {
      const base = new URL(url);
      absoluteImage = image.startsWith("/") ? `${base.origin}${image}` : `${base.origin}/${image}`;
    }

    return new Response(JSON.stringify({
      title: title || domain,
      description: description || null,
      image: absoluteImage || null,
      site_name: siteName || domain,
      domain,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response(JSON.stringify({ title: new URL(url).hostname, domain: new URL(url).hostname }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
