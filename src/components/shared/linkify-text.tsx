import { useState, useEffect } from "react";

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain: string;
}

function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        // Try to fetch Open Graph data via a simple approach
        // Use the page itself - we can't fetch arbitrary pages due to CORS
        // So we show a simple domain-based preview
        setPreview({ url, domain, title: domain });
      } catch {
        // Invalid URL
      }
      if (!cancelled) setLoading(false);
    }
    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  if (loading || !preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-lg border border-[var(--border)] overflow-hidden hover:border-gold-500/50 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 bg-[var(--accent)]">
        <p className="text-sm font-medium truncate">{preview.title}</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">{preview.domain}</p>
      </div>
    </a>
  );
}

export function LinkifyText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_REGEX);
  const urls = text.match(URL_REGEX) || [];

  return (
    <div>
      <p className={className}>
        {parts.map((part, i) =>
          URL_REGEX.test(part) ? (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
      {/* Show preview for the first URL */}
      {urls.length > 0 && urls[0] && <LinkPreviewCard url={urls[0]} />}
    </div>
  );
}
