import { useState, useRef, useCallback } from "react";
import { Smile, Image, Search, Sticker, Film, ChevronDown } from "lucide-react";
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

type ToolbarView = "closed" | "main" | "emoji" | "gifs" | "stickers";

export function CommentToolbar({ onEmojiSelect, onMediaSelect, postId }: CommentToolbarProps) {
  const { user } = useAuth();
  const [view, setView] = useState<ToolbarView>("closed");
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

  // Toggle button (sits inline next to comment input)
  const toggleButton = (
    <button
      type="button"
      onClick={() => setView(view === "closed" ? "main" : "closed")}
      className={cn(
        "p-1.5 rounded-full transition-colors cursor-pointer",
        view !== "closed" ? "bg-gold-500/15 text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
      )}
      title="Add emoji, GIF, sticker, or image"
    >
      <Smile className="w-4 h-4" />
    </button>
  );

  if (view === "closed") {
    return <>{toggleButton}<input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></>;
  }

  return (
    <>
      {toggleButton}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Full-width toolbar panel below the comment input */}
      <div className="absolute left-0 right-0 bottom-full border-t border-[var(--border)] bg-[var(--card)] z-50" style={{ boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.2)" }}>
        {view === "main" ? (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setView("emoji")}
              className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-gold-500 transition-colors cursor-pointer"
            >
              <Smile className="w-6 h-6" />
              <span className="text-[9px]">Emojis</span>
            </button>
            <button
              type="button"
              onClick={() => { setView("gifs"); searchGifs(""); }}
              className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-purple-400 transition-colors cursor-pointer"
            >
              <Film className="w-6 h-6" />
              <span className="text-[9px]">GIFs</span>
            </button>
            <button
              type="button"
              onClick={() => { setView("stickers"); searchStickers(""); }}
              className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-green-400 transition-colors cursor-pointer"
            >
              <Sticker className="w-6 h-6" />
              <span className="text-[9px]">Stickers</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-pink-400 transition-colors cursor-pointer disabled:opacity-30"
            >
              <Image className="w-6 h-6" />
              <span className="text-[9px]">Images</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setView("closed")}
              className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        ) : view === "emoji" ? (
          <div className="flex flex-col" style={{ height: "320px" }}>
            {/* Search + back */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emojis..."
                  className="bg-transparent text-sm outline-none w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => { setView("main"); setEmojiSearch(""); }}
                className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            {/* Category tabs */}
            {!emojiSearch && (
              <div className="flex gap-1 px-2 py-1.5 border-b border-[var(--border)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-shrink-0">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setEmojiCategory(i)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0",
                      emojiCategory === i ? "bg-gold-500/20" : "hover:bg-[var(--accent)]"
                    )}
                    title={cat.name}
                  >
                    <span className="text-lg leading-none">{cat.icon}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Emoji grid - fixed height */}
            <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid grid-cols-8 gap-0.5">
                {(() => {
                  const emojis: any[] = emojiSearch
                    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e: any) => e.name?.includes(emojiSearch.toLowerCase()))
                    : emojiCategory === 0
                      ? (() => { const recent = getRecentEmojis(); return recent.length > 0 ? recent.map((e) => ({ emoji: e, name: e })) : EMOJI_CATEGORIES[0]?.emojis || []; })()
                      : EMOJI_CATEGORIES[emojiCategory]?.emojis || [];
                  return emojis.length === 0 ? (
                    <p className="col-span-8 text-xs text-[var(--muted-foreground)] text-center py-4">
                      {emojiCategory === 0 ? "No recent emojis" : "No emojis found"}
                    </p>
                  ) : (
                    emojis.map((emoji: any, idx: number) => (
                      <button
                        key={`${typeof emoji === "string" ? emoji : emoji.emoji}-${idx}`}
                        type="button"
                        onClick={() => {
                          const e = typeof emoji === "string" ? emoji : emoji.emoji;
                          onEmojiSelect(e);
                          addRecentEmoji(e);
                        }}
                        className="text-xl hover:scale-110 hover:bg-[var(--accent)] rounded p-0.5 transition-transform cursor-pointer text-center"
                      >
                        {typeof emoji === "string" ? emoji : emoji.emoji}
                      </button>
                    ))
                  );
                })()}
              </div>
            </div>
          </div>
        ) : view === "gifs" ? (
          <div className="flex flex-col" style={{ height: "320px" }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={gifSearch}
                  onChange={(e) => handleGifSearch(e.target.value)}
                  placeholder="Search GIFs..."
                  className="bg-transparent text-sm outline-none w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => { setView("main"); setGifSearch(""); }}
                className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loadingGifs ? (
                <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">Loading...</div>
              ) : gifs.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">No GIFs found</div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {gifs.map((g) => (
                    <button key={g.id} type="button" onClick={() => { onMediaSelect(g.url); setView("closed"); }} className="rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-gold-500">
                      <img src={g.preview} alt="" className="w-full h-20 object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : view === "stickers" ? (
          <div className="flex flex-col" style={{ height: "320px" }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={stickerSearch}
                  onChange={(e) => handleStickerSearch(e.target.value)}
                  placeholder="Search stickers..."
                  className="bg-transparent text-sm outline-none w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => { setView("main"); setStickerSearch(""); }}
                className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loadingStickers ? (
                <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">Loading...</div>
              ) : stickers.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--muted-foreground)]">No stickers found</div>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {stickers.map((s) => (
                    <button key={s.id} type="button" onClick={() => { onMediaSelect(s.url); setView("closed"); }} className="rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-gold-500 p-1">
                      <img src={s.preview} alt="" className="w-full h-16 object-contain" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
