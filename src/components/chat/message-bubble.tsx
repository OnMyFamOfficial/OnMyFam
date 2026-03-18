import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Reply, Pencil, Trash2, Pin, Copy, SmilePlus, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, Profile } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderProfile: Profile | null;
  showAvatar: boolean;
  currentUserId?: string;
  onReply?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string, userId: string) => void;
  reactions?: Record<string, Set<string>>; // emoji -> set of user IDs
  isPinned?: boolean;
}

const REACTION_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}", "\u{1F389}", "\u{1F525}"];

function isEmojiOnly(text: string | null): boolean {
  if (!text) return false;
  const stripped = text.replace(/[\s\uFE0F]/g, "");
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u;
  return emojiRegex.test(stripped);
}

export function MessageBubble({ message, isMine, senderProfile, showAvatar, currentUserId, onReply, onEdit, onDelete, onPin, onReact, reactions, isPinned }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTouchStart() {
    longPressRef.current = setTimeout(() => {
      setShowReactions(true);
      setShowMenu(false);
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  useEffect(() => {
    if (!showMenu && !showReactions) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu, showReactions]);

  if (message.message_type === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-[var(--muted-foreground)] bg-[var(--accent)] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  if (message.is_deleted) {
    return (
      <div className={cn("flex mb-1", isMine ? "justify-end" : "justify-start")}>
        <div className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--muted-foreground)] text-sm italic max-w-[75%]">
          Message deleted
        </div>
      </div>
    );
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function handleCopy() {
    if (message.content) navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  }

  function handleEditSubmit() {
    if (editText.trim() && editText.trim() !== message.content) {
      onEdit?.(message.id, editText.trim());
    }
    setEditing(false);
    setShowMenu(false);
  }

  function handleReact(emoji: string) {
    if (!currentUserId) return;
    onReact?.(message.id, emoji, currentUserId);
    setShowReactions(false);
  }

  // Check if current user already reacted with any emoji
  const myCurrentReaction = reactions
    ? Object.entries(reactions).find(([, users]) => users.has(currentUserId || ""))?.[0]
    : undefined;

  const hasReactions = reactions && Object.entries(reactions).some(([, users]) => users.size > 0);

  return (
    <div className={cn("flex gap-1 mb-1 group", isMine ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7">
        {showAvatar && !isMine ? (
          <div className="w-7 h-7 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
            {senderProfile?.avatar_url ? (
              <img src={senderProfile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-medium text-gold-500">
                {senderProfile?.display_name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Bubble + time */}
      <div className="max-w-[65%] min-w-0 relative" ref={menuRef}>
        {/* Pin indicator */}
        {isPinned && (
          <div className={cn("flex items-center gap-1 text-[10px] text-gold-500 mb-0.5 px-1", isMine ? "justify-end" : "justify-start")}>
            <Pin className="w-2.5 h-2.5 rotate-45" /> Pinned
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            "text-[11px] px-2 py-1 mb-0.5 rounded-lg border-l-2 border-gold-500/50 bg-[var(--accent)] truncate",
            isMine ? "ml-auto" : ""
          )}>
            <span className="text-gold-500 font-medium">
              {message.reply_to.sender?.display_name || "Unknown"}
            </span>
            <span className="text-[var(--muted-foreground)] ml-1">
              {message.reply_to.content?.slice(0, 60)}
            </span>
          </div>
        )}

        {/* Image/video media */}
        {(message.message_type === "image" || message.message_type === "video") && message.media_url && (
          <div className={cn("mb-1 rounded-xl overflow-hidden shadow-md dark:shadow-black/40", isMine ? "ml-auto" : "")}>
            {message.message_type === "image" ? (
              <img src={message.media_url} alt="" className="max-w-full max-h-64 rounded-xl object-cover" />
            ) : (
              <video src={message.media_url} controls className="max-w-full max-h-64 rounded-xl" />
            )}
          </div>
        )}

        {/* File attachment */}
        {message.message_type === "file" && message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-1 hover:opacity-80 transition-opacity shadow-md dark:shadow-black/40",
              isMine ? "bg-gold-500 text-white ml-auto" : "bg-[var(--accent)]"
            )}
          >
            <span className="truncate">{message.media_metadata?.filename || "File"}</span>
          </a>
        )}

        {/* Text content (or edit mode) */}
        {editing ? (
          <div className={cn("rounded-2xl overflow-hidden", isMine ? "ml-auto" : "")}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                if (e.key === "Escape") { setEditing(false); setEditText(message.content || ""); }
              }}
              className="w-full resize-none bg-[var(--background)] border border-gold-500 rounded-xl px-3 py-1.5 text-sm outline-none max-h-24"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button onClick={handleEditSubmit} className="text-[10px] text-gold-500 hover:underline cursor-pointer">Save</button>
              <span className="text-[10px] text-[var(--muted-foreground)]">|</span>
              <button onClick={() => { setEditing(false); setEditText(message.content || ""); }} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : message.content ? (
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            className={cn(
              "px-3 py-1.5 rounded-2xl break-words shadow-md dark:shadow-black/40",
              isEmojiOnly(message.content)
                ? "text-2xl bg-transparent !shadow-none"
                : isMine
                  ? "text-white font-medium rounded-br-md"
                  : "text-white rounded-bl-md"
            )}
            style={isEmojiOnly(message.content)
              ? undefined
              : isMine
                ? { background: "linear-gradient(to right, #996414, #3c311f)", fontSize: "16px" }
                : { background: "linear-gradient(to right, #21190c, #453416)", fontSize: "16px" }
            }
          >
            {message.content}
          </div>
        ) : null}

        {/* Reactions display */}
        {hasReactions && (
          <div className={cn("flex flex-wrap gap-1 mt-0.5 px-0.5", isMine ? "justify-end" : "justify-start")}>
            {Object.entries(reactions!).filter(([, users]) => users.size > 0).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-lg transition-colors cursor-pointer",
                  users.has(currentUserId || "")
                    ? "bg-gold-500/20 border-gold-500/50"
                    : "bg-[var(--accent)] border-[var(--border)] hover:border-gold-500/50"
                )}
              >
                <span>{emoji}</span>
                {users.size > 1 && <span className="text-[10px] text-[var(--muted-foreground)]">{users.size}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Time */}
        <div className={cn(
          "text-[10px] text-[var(--muted-foreground)] mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isMine ? "text-right" : "text-left"
        )}>
          {formatTime(message.created_at)}
        </div>

        {/* Reaction picker popup */}
        {showReactions && (
          <div className={cn(
            "absolute z-50 flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg",
            isMine ? "right-0" : "left-0",
            "bottom-full mb-1"
          )}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "text-xl hover:scale-125 transition-transform cursor-pointer p-1",
                  myCurrentReaction === emoji && "bg-gold-500/20 rounded-full"
                )}
              >
                {emoji}
              </button>
            ))}
            {/* Plus button to open full menu */}
            <button
              onClick={() => { setShowReactions(false); setShowMenu(true); }}
              className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Context menu popup */}
        {showMenu && (
          <div className={cn(
            "absolute z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]",
            isMine ? "right-0" : "left-0",
            "bottom-full mb-1"
          )}>
            {onReply && (
              <button
                onClick={() => { onReply(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
            )}
            {isMine && message.message_type === "text" && (
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {message.content && (
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            )}
            <button
              onClick={() => { onPin?.(message.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
            >
              <Pin className="w-3.5 h-3.5" /> {isPinned ? "Unpin" : "Pin"}
            </button>
            {isMine && (
              <>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (confirm("Are you sure you want to delete this message?")) {
                      onDelete?.(message.id);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action icons - visible on hover (desktop) and always visible (mobile) */}
      <div className="flex-shrink-0 flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity self-center">
        <button
          onClick={() => { setShowReactions(!showReactions); setShowMenu(false); }}
          className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="React"
        >
          <SmilePlus className="w-6 h-6" />
        </button>
        <button
          onClick={() => { setShowMenu(!showMenu); setShowReactions(false); }}
          className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="More"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
