import { useState, useRef, useCallback } from "react";
import { Smile, Image, Search, Sticker, X } from "lucide-react";
import { EMOJI_CATEGORIES, addRecentEmoji, getRecentEmojis } from "@/components/chat/emoji-data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

const GIPHY_CACHE_TTL = 10 * 60 * 1000;
const giphyCache = new Map<string, { data: any[]; timestamp: number }>();
function getCached(key: string) {
  const entry = giphyCache.get(key);
  if (entry && Date.now() - entry.timestamp < GIPHY_CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any[]) {
  giphyCache.set(key, { data, timestamp: Date.now() });
}

interface CommentToolbarProps {
  onEmojiSelect: (emoji: string) => void;
  onMediaSelect: (url: string) => void;
  postId: string;
}

type View = "closed" | "emoji" | "gifs" | "stickers";

export function CommentToolbar({ onEmojiSelect, onMediaSelect, postId }: CommentToolbarProps) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("closed");
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [stickerSearch, setStickerSearch] = useState("");
  const [stickers, setStickers] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const gifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(v: View) {
    if (view === v) { setView("closed"); return; }
    setView(v);
    if (v === "gifs" && gifs.length === 0) searchGifs("");
    if (v === "stickers" && stickers.length === 0) searchStickers("");
  }

  const searchGifs = useCallback(async (q: string) => {
    const key = `gif:${q.trim().toLowerCase() || "__trending__"}`;
    const cached = getCached(key);
    if (cached) { setGifs(cached); return; }
    setLoadingGifs(true);
    try {
      const url = q.trim() ? `/api/giphy-proxy?type=gifs&q=${encodeURIComponent(q)}` : `/api/giphy-proxy?type=gifs`;
      const res = await fetch(url);
      const json = await res.json();
      const results = (json.data || []).map((g: any) => ({ id: g.id, url: g.url, preview: g.preview }));
      setCache(key, results);
      setGifs(results);
    } catch { setGifs([]); }
    setLoadingGifs(false);
  }, []);

  const searchStickers = useCallback(async (q: string) => {
    const key = `sticker:${q.trim().toLowerCase() || "__trending__"}`;
    const cached = getCached(key);
    if (cached) { setStickers(cached); return; }
    setLoadingStickers(true);
    try {
      const url = q.trim() ? `/api/giphy-proxy?type=stickers&q=${encodeURIComponent(q)}` : `/api/giphy-proxy?type=stickers`;
      const res = await fetch(url);
      const json = await res.json();
      const results = (json.data || []).map((g: any) => ({ id: g.id, url: g.url, preview: g.preview }));
      setCache(key, results);
      setStickers(results);
    } catch { setStickers([]); }
    setLoadingStickers(false);
  }, []);

  function handleGifSearch(val: string) {
    setGifSearch(val);
    if (gifTimeout.current) clearTimeout(gifTimeout.current);
    gifTimeout.current = setTimeout(() => searchGifs(val), 400);
  }

  function handleStickerSearch(val: string) {
    setStickerSearch(val);
    if (stickerTimeout.current) clearTimeout(stickerTimeout.current);
    stickerTimeout.current = setTimeout(() => searchStickers(val), 400);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `comments/${postId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("posts").getPublicUrl(path);
      onMediaSelect(data.publicUrl);
    }
    setUploading(false);
    setView("closed");
    if (fileRef.current) fileRef.current.value = "";
  }

  const filteredEmojis = emojiSearch
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.name.includes(emojiSearch.toLowerCase()))
    : emojiCategory === 0
      ? (() => { const recent = getRecentEmojis(); return recent.length > 0 ? recent.map((e) => ({ emoji: e, name: e })) : EMOJI_CATEGORIES[0]?.emojis || []; })()
      : EMOJI_CATEGORIES[emojiCategory]?.emojis || [];

  if (view === "closed") {
    return (
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => toggle("emoji")} className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Emoji">
          <Smile className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => toggle("gifs")} className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer text-[10px] font-bold" title="GIFs">
          GIF
        </button>
        <button type="button" onClick={() => toggle("stickers")} className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Stickers">
          <Sticker className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-30" title="Image">
          <Image className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--card)]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)]">
        <button type="button" onClick={() => toggle("emoji")} className={cn("p-1.5 rounded text-xs transition-colors cursor-pointer", view === "emoji" ? "bg-gold-500/15 text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>
          <Smile className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => toggle("gifs")} className={cn("p-1.5 rounded text-[10px] font-bold transition-colors cursor-pointer", view === "gifs" ? "bg-gold-500/15 text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>
          GIF
        </button>
        <button type="button" onClick={() => toggle("stickers")} className={cn("p-1.5 rounded transition-colors cursor-pointer", view === "stickers" ? "bg-gold-500/15 text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>
          <Sticker className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-30">
          <Image className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <div className="flex-1" />
        <button type="button" onClick={() => setView("closed")} className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="h-48 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {view === "emoji" && (
          <div>
            <div className="sticky top-0 bg-[var(--card)] px-3 py-2 z-10">
              <div className="flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1">
                <Search className="w-3 h-3 text-[var(--muted-foreground)]" />
                <input value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} placeholder="Search emoji..." className="bg-transparent text-xs outline-none w-full" />
              </div>
            </div>
            {!emojiSearch && (
              <div className="flex gap-1 px-3 pb-1 overflow-x-auto [scrollbar-width:none]">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button key={i} type="button" onClick={() => setEmojiCategory(i)} className={cn("text-base px-1.5 py-0.5 rounded cursor-pointer flex-shrink-0", emojiCategory === i ? "bg-gold-500/15" : "hover:bg-[var(--accent)]")}>
                    {cat.icon}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-8 gap-0.5 px-3 py-1">
              {filteredEmojis.map((e: any, i: number) => (
                <button key={i} type="button" onClick={() => { onEmojiSelect(e.emoji); addRecentEmoji(e.emoji); }} className="text-xl p-1 rounded hover:bg-[var(--accent)] cursor-pointer text-center">
                  {e.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "gifs" && (
          <div>
            <div className="sticky top-0 bg-[var(--card)] px-3 py-2 z-10">
              <div className="flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1">
                <Search className="w-3 h-3 text-[var(--muted-foreground)]" />
                <input value={gifSearch} onChange={(e) => handleGifSearch(e.target.value)} placeholder="Search GIFs..." className="bg-transparent text-xs outline-none w-full" />
              </div>
            </div>
            {loadingGifs ? (
              <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">Loading...</div>
            ) : (
              <div className="grid grid-cols-3 gap-1 px-3 py-1">
                {gifs.map((g) => (
                  <button key={g.id} type="button" onClick={() => { onMediaSelect(g.url); setView("closed"); }} className="rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-gold-500">
                    <img src={g.preview} alt="" className="w-full h-20 object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "stickers" && (
          <div>
            <div className="sticky top-0 bg-[var(--card)] px-3 py-2 z-10">
              <div className="flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1">
                <Search className="w-3 h-3 text-[var(--muted-foreground)]" />
                <input value={stickerSearch} onChange={(e) => handleStickerSearch(e.target.value)} placeholder="Search stickers..." className="bg-transparent text-xs outline-none w-full" />
              </div>
            </div>
            {loadingStickers ? (
              <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">Loading...</div>
            ) : (
              <div className="grid grid-cols-4 gap-1 px-3 py-1">
                {stickers.map((s) => (
                  <button key={s.id} type="button" onClick={() => { onMediaSelect(s.url); setView("closed"); }} className="rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-gold-500 p-1">
                    <img src={s.preview} alt="" className="w-full h-16 object-contain" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
