import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  conversationId: string;
  replyTo: Message | null;
  onClearReply: () => void;
  onTyping: () => void;
}

const EMOJI_QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"];

export function MessageInput({ conversationId, replyTo, onClearReply, onTyping }: MessageInputProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useCallback(async (content: string, type: string = "text", mediaUrl?: string, metadata?: Record<string, unknown>) => {
    if (!user) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: type === "text" ? content : null,
      message_type: type,
      media_url: mediaUrl || null,
      media_metadata: metadata || null,
      reply_to_id: replyTo?.id || null,
    });

    onClearReply();
  }, [user, conversationId, replyTo, onClearReply]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    setShowEmoji(false);
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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

      await sendMessage(file.name, type, mediaUrl, {
        filename: file.name,
        size: file.size,
        mime_type: file.type,
      });
    } catch (err) {
      console.error("File upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--card)]">
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

      {/* Emoji picker */}
      {showEmoji && (
        <div className="flex gap-1 px-3 py-2 border-b border-[var(--border)]">
          {EMOJI_QUICK.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmoji(false);
                textareaRef.current?.focus();
              }}
              className="text-lg hover:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 p-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />

        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer",
            showEmoji ? "text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
          title="Emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? "Uploading..." : "Type a message..."}
          disabled={uploading}
          rows={1}
          className="flex-1 resize-none bg-[var(--background)] border border-[var(--input)] rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-gold-500 max-h-24 overflow-y-auto disabled:opacity-50"
          style={{ minHeight: "34px" }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || uploading}
          className="p-1.5 rounded-lg bg-gold-500 text-white hover:bg-gold-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
