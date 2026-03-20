import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, X, Image, ArrowDown, ChevronDown, FileText, Film, Search, Sticker } from "lucide-react";
import { EMOJI_CATEGORIES, getRecentEmojis, addRecentEmoji } from "./emoji-data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  conversationId: string;
  replyTo: Message | null;
  onClearReply: () => void;
  onTyping: () => void;
  onScrollToBottom?: () => void;
}

const EMOJI_QUICK = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}", "\u{1F389}", "\u{1F525}"];

interface PendingFile {
  file: File;
  previewUrl: string;
  isImage: boolean;
  isVideo: boolean;
}

export function MessageInput({ conversationId, replyTo, onClearReply, onTyping, onScrollToBottom }: MessageInputProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarView, setToolbarView] = useState<"main" | "emoji" | "gifs" | "stickers">("main");
  const [uploading, setUploading] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [stickerSearch, setStickerSearch] = useState("");
  const [stickers, setStickers] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const stickerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; width: number; height: number }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const gifSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const GIPHY_KEY = "ZGVuN9nUN1jlHftCOiYxWS5BhVQ9no3B";

  const searchGifs = useCallback(async (query: string) => {
    setLoadingGifs(true);
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`;
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(
        (json.data || []).map((g: any) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
          width: parseInt(g.images.fixed_width_small.width),
          height: parseInt(g.images.fixed_width_small.height),
        }))
      );
    } catch {
      setGifs([]);
    }
    setLoadingGifs(false);
  }, []);

  function handleGifSearchChange(value: string) {
    setGifSearch(value);
    if (gifSearchTimeout.current) clearTimeout(gifSearchTimeout.current);
    gifSearchTimeout.current = setTimeout(() => searchGifs(value), 400);
  }

  const searchStickers = useCallback(async (query: string) => {
    setLoadingStickers(true);
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`;
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      setStickers(
        (json.data || []).map((g: any) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
        }))
      );
    } catch {
      setStickers([]);
    }
    setLoadingStickers(false);
  }, []);

  function handleStickerSearchChange(value: string) {
    setStickerSearch(value);
    if (stickerSearchTimeout.current) clearTimeout(stickerSearchTimeout.current);
    stickerSearchTimeout.current = setTimeout(() => searchStickers(value), 400);
  }

  async function sendGif(gifUrl: string) {
    if (!user) return;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: null,
      message_type: "image",
      media_url: gifUrl,
      media_metadata: { filename: "gif", mime_type: "image/gif" },
    });
    setShowToolbar(false);
    setToolbarView("main");
    setGifSearch("");
    setGifs([]);
  }
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [caption, setCaption] = useState("");
  const [showModalEmoji, setShowModalEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useCallback(async (content: string | null, type: string = "text", mediaUrl?: string, metadata?: Record<string, unknown>) => {
    if (!user) return;

    const { data } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: type === "text" ? content : (content || null),
      message_type: type,
      media_url: mediaUrl || null,
      media_metadata: metadata || null,
      reply_to_id: replyTo?.id || null,
    }).select().single();

    // Broadcast to other users for reliable delivery
    if (data) {
      const channel = supabase.channel(`msgs-${conversationId}`);
      await channel.send({
        type: "broadcast",
        event: "new-message",
        payload: data,
      });
    }

    onClearReply();
  }, [user, conversationId, replyTo, onClearReply]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    setShowToolbar(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(trimmed);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      onTyping();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (isImage || isVideo) {
      const previewUrl = URL.createObjectURL(file);
      setPendingFile({ file, previewUrl, isImage, isVideo });
      setCaption("");
      setShowModalEmoji(false);
    } else {
      uploadAndSend(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAndSend(file: File, captionText?: string) {
    if (!user) return;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat").getPublicUrl(path);
      const mediaUrl = urlData.publicUrl;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const type = isImage ? "image" : isVideo ? "video" : "file";

      await sendMessage(captionText || null, type, mediaUrl, {
        filename: file.name,
        size: file.size,
        mime_type: file.type,
      });
    } catch (err) {
      console.error("File upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleModalSend() {
    if (!pendingFile) return;
    const file = pendingFile.file;
    URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    await uploadAndSend(file, caption.trim() || undefined);
    setCaption("");
    setShowModalEmoji(false);
  }

  function handleModalCancel() {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    setPendingFile(null);
    setCaption("");
    setShowModalEmoji(false);
  }

  return (
    <>
      {/* Media preview modal */}
      {pendingFile && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={handleModalCancel} />
          <div className="relative bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-gold-500" />
                <span className="font-semibold text-sm">
                  {pendingFile.isImage ? "Send Photo" : "Send Video"}
                </span>
              </div>
              <button
                onClick={handleModalCancel}
                className="p-1 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="p-4 flex justify-center" style={{ backgroundColor: "#38394d" }}>
              {pendingFile.isImage ? (
                <img
                  src={pendingFile.previewUrl}
                  alt="Preview"
                  className="max-h-72 max-w-full rounded-lg object-contain"
                />
              ) : (
                <video
                  src={pendingFile.previewUrl}
                  controls
                  className="max-h-72 max-w-full rounded-lg"
                />
              )}
            </div>

            {/* Caption + emoji */}
            <div className="border-t border-[var(--border)]">
              {showModalEmoji && (
                <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)]">
                  <button
                    onClick={() => setShowModalEmoji(false)}
                    className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {EMOJI_QUICK.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setCaption((prev) => prev + emoji);
                        captionRef.current?.focus();
                      }}
                      className="text-2xl hover:scale-125 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1.5 p-3">
                <button
                  onClick={() => setShowModalEmoji(!showModalEmoji)}
                  className={cn(
                    "p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer",
                    showModalEmoji ? "text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  <Smile className="w-6 h-6" />
                </button>

                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleModalSend();
                    }
                  }}
                  placeholder="Add a caption..."
                  rows={1}
                  className="flex-1 resize-none bg-[var(--background)] border border-[var(--input)] rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold-500 max-h-20 overflow-y-auto"
                  style={{ minHeight: "34px" }}
                  autoFocus
                />

                <button
                  onClick={handleModalSend}
                  disabled={uploading}
                  className="p-1.5 rounded-md bg-gold-500 text-white hover:bg-gold-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <span className="text-white text-sm font-medium">Uploading...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main input area */}
      <div className="border-t border-[var(--border)] bg-[var(--card)] dark:!bg-[#38394d]">
        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] border-b border-[var(--border)]">
            <div className="flex-1 min-w-0 text-xs">
              <span className="text-gold-500 font-medium">
                Replying to {replyTo.sender?.display_name || "message"}
              </span>
              <p className="text-[var(--muted-foreground)] truncate">{replyTo.content}</p>
            </div>
            <button onClick={onClearReply} className="p-1 hover:bg-[var(--border)] rounded cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        {showToolbar && (
          <div
            className="border-t border-[var(--border)]"
            style={{ boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)" }}
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => { e.preventDefault(); textareaRef.current?.blur(); }}
          >
            {toolbarView === "main" ? (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { textareaRef.current?.blur(); setTimeout(() => setToolbarView("emoji"), 50); }}
                  className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-gold-500 transition-colors cursor-pointer"
                  title="Emojis"
                >
                  <Smile className="w-6 h-6" />
                  <span className="text-[9px]">Emojis</span>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { textareaRef.current?.blur(); fileInputRef.current?.setAttribute("accept", "image/*"); fileInputRef.current?.click(); }}
                  className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-pink-400 transition-colors cursor-pointer"
                  title="Images"
                >
                  <Image className="w-6 h-6" />
                  <span className="text-[9px]">Images</span>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { textareaRef.current?.blur(); setTimeout(() => { setToolbarView("stickers"); searchStickers(""); }, 50); }}
                  className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-green-400 transition-colors cursor-pointer"
                  title="Stickers"
                >
                  <Sticker className="w-6 h-6" />
                  <span className="text-[9px]">Stickers</span>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { textareaRef.current?.blur(); setTimeout(() => { setToolbarView("gifs"); searchGifs(""); }, 50); }}
                  className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-purple-400 transition-colors cursor-pointer"
                  title="GIFs"
                >
                  <Film className="w-6 h-6" />
                  <span className="text-[9px]">GIFs</span>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { textareaRef.current?.blur(); fileInputRef.current?.setAttribute("accept", ".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv"); fileInputRef.current?.click(); }}
                  className="flex flex-col items-center gap-0.5 text-[var(--muted-foreground)] hover:text-blue-400 transition-colors cursor-pointer"
                  title="Documents"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-[9px]">Docs</span>
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowToolbar(false)}
                  className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  title="Close"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            ) : toolbarView === "emoji" ? (
              <div className="flex flex-col" style={{ maxHeight: "280px" }}>
                {/* Search + back */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)]">
                  <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                    <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      value={emojiSearch}
                      onChange={(e) => setEmojiSearch(e.target.value)}
                      placeholder="Search emojis..."
                      className="bg-transparent text-sm outline-none w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => { setToolbarView("main"); setEmojiSearch(""); }}
                    className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                {/* Category tabs */}
                <div className="flex gap-0.5 px-2 py-1.5 border-b border-[var(--border)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                      key={cat.name}
                      onClick={() => setEmojiCategory(i)}
                      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${
                        emojiCategory === i
                          ? "bg-gold-500/20 text-gold-500"
                          : "hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
                      }`}
                      title={cat.name}
                    >
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-[8px] leading-none">{cat.name}</span>
                    </button>
                  ))}
                </div>
                {/* Emoji grid */}
                <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="grid grid-cols-8 gap-0.5">
                    {(() => {
                      const category = EMOJI_CATEGORIES[emojiCategory];
                      const emojis = emojiCategory === 0
                        ? getRecentEmojis()
                        : emojiSearch
                          ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter(() => true)
                          : category.emojis;
                      return emojis.length === 0 ? (
                        <p className="col-span-8 text-xs text-[var(--muted-foreground)] text-center py-4">
                          {emojiCategory === 0 ? "No recent emojis" : "No emojis found"}
                        </p>
                      ) : (
                        emojis.map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            onClick={() => {
                              setText((prev) => prev + emoji);
                              addRecentEmoji(emoji);
                              // Don't refocus textarea on mobile to keep keyboard hidden
                            }}
                            className="text-xl hover:scale-110 hover:bg-[var(--accent)] rounded p-0.5 transition-transform cursor-pointer text-center"
                          >
                            {emoji}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : toolbarView === "gifs" ? (
              <div className="flex flex-col" style={{ maxHeight: "280px" }}>
                {/* Search bar + back */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                  <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                    <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      value={gifSearch}
                      onChange={(e) => handleGifSearchChange(e.target.value)}
                      placeholder="Search GIFs..."
                      className="bg-transparent text-sm outline-none w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => { setToolbarView("main"); setGifSearch(""); setGifs([]); }}
                    className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
                    title="Back"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                {/* GIF grid */}
                <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {loadingGifs ? (
                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">Loading...</p>
                  ) : gifs.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
                      {gifSearch ? "No GIFs found" : "Trending GIFs"}
                    </p>
                  ) : (
                    <div className="columns-4 gap-1">
                      {gifs.map((gif) => (
                        <button
                          key={gif.id}
                          onClick={() => sendGif(gif.url)}
                          className="rounded-lg overflow-hidden hover:ring-2 hover:ring-gold-500 transition-all cursor-pointer mb-1 block w-full"
                        >
                          <img
                            src={gif.preview}
                            alt="GIF"
                            className="w-full rounded-lg"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[8px] text-[var(--muted-foreground)] text-center mt-2">Powered by GIPHY</p>
                </div>
              </div>
            ) : toolbarView === "stickers" ? (
              <div className="flex flex-col" style={{ maxHeight: "280px" }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                  <div className="flex-1 flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1">
                    <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      value={stickerSearch}
                      onChange={(e) => handleStickerSearchChange(e.target.value)}
                      placeholder="Search stickers..."
                      className="bg-transparent text-sm outline-none w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => { setToolbarView("main"); setStickerSearch(""); setStickers([]); }}
                    className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {loadingStickers ? (
                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">Loading...</p>
                  ) : stickers.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
                      {stickerSearch ? "No stickers found" : "Trending stickers"}
                    </p>
                  ) : (
                    <div className="columns-4 gap-1">
                      {stickers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => sendGif(s.url)}
                          className="rounded-lg overflow-hidden hover:ring-2 hover:ring-gold-500 transition-all cursor-pointer mb-1 block w-full"
                        >
                          <img src={s.preview} alt="Sticker" className="w-full rounded-lg" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[8px] text-[var(--muted-foreground)] text-center mt-2">Powered by GIPHY</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Input row */}
        <div className="p-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />
          <div className="flex items-end bg-[var(--background)] border border-[var(--input)] rounded-lg overflow-hidden">
            {/* Attach button - left inside */}
            <div className="flex items-center flex-shrink-0" style={{ padding: "2.5px 0 2.5px 2.5px" }}>
              <button
                onClick={() => { textareaRef.current?.blur(); setShowToolbar(!showToolbar); setToolbarView("main"); }}
                className={cn(
                  "p-3 rounded-md text-white hover:brightness-110 transition-colors cursor-pointer",
                  showToolbar ? "brightness-125" : ""
                )}
                style={{ backgroundColor: "#393a4e" }}
                title="Attach"
              >
                <Paperclip className="w-5.5 h-5.5" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? "Uploading..." : "Type a message..."}
              disabled={uploading}
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 outline-none overflow-hidden disabled:opacity-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ minHeight: "42px", maxHeight: "160px", fontSize: "16px", lineHeight: "1.5", paddingTop: "5px", paddingBottom: "5px", overflowY: text.split("\n").length > 8 ? "auto" : "hidden" }}
            />

            {/* Send + scroll buttons - right inside */}
            <div className="flex items-center gap-0.5 flex-shrink-0" style={{ padding: "2.5px 2.5px 2.5px 0" }}>
              <button
                onClick={handleSend}
                disabled={!text.trim() || uploading}
                className="p-3 rounded-md text-white hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
                style={{ backgroundColor: "#393a4e" }}
                title="Send"
              >
                <Send className="w-5.5 h-5.5" />
              </button>
              <button
                onClick={onScrollToBottom}
                className="p-3 rounded-md text-white hover:brightness-110 transition-colors cursor-pointer"
                style={{ backgroundColor: "#393a4e" }}
                title="Scroll to bottom"
              >
                <ArrowDown className="w-5.5 h-5.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
