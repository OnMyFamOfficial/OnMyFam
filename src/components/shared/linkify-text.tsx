import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const URL_TEST = /^https?:\/\/[^\s<]+$/;

interface LinkPreview {
  title: string;
  description: string | null;
  image: string | null;
  site_name: string;
  domain: string;
}

function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    }
    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-[var(--border)] overflow-hidden animate-pulse">
        <div className="h-32 bg-[var(--accent)]" />
        <div className="px-3 py-2 space-y-1.5">
          <div className="h-3 w-3/4 bg-[var(--accent)] rounded" />
          <div className="h-2.5 w-1/2 bg-[var(--accent)] rounded" />
        </div>
      </div>
    );
  }

  if (error || !preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-lg border border-[var(--border)] overflow-hidden hover:border-gold-500/50 transition-colors group"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <div className="w-full h-40 bg-[var(--accent)] overflow-hidden">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </div>
      )}
      <div className="px-3 py-2.5 bg-[var(--accent)]">
        <p className="text-sm font-semibold truncate">{preview.title}</p>
        {preview.description && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{preview.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <ExternalLink className="w-3 h-3 text-[var(--muted-foreground)]" />
          <span className="text-[10px] text-[var(--muted-foreground)]">{preview.domain}</span>
        </div>
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
          URL_TEST.test(part) ? (
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
      {urls.length > 0 && urls[0] && <LinkPreviewCard url={urls[0]} />}
    </div>
  );
}
