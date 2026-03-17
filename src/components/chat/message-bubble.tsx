import { cn } from "@/lib/utils";
import type { Message, Profile } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderProfile: Profile | null;
  showAvatar: boolean;
  onReply?: () => void;
}

export function MessageBubble({ message, isMine, senderProfile, showAvatar, onReply }: MessageBubbleProps) {
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

  return (
    <div className={cn("flex gap-2 mb-1 group", isMine ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7">
        {showAvatar && !isMine ? (
          <div className="w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden">
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

      {/* Bubble */}
      <div className="max-w-[75%] min-w-0">
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
          <div className={cn("mb-1 rounded-xl overflow-hidden", isMine ? "ml-auto" : "")}>
            {message.message_type === "image" ? (
              <img
                src={message.media_url}
                alt=""
                className="max-w-full max-h-64 rounded-xl object-cover"
              />
            ) : (
              <video
                src={message.media_url}
                controls
                className="max-w-full max-h-64 rounded-xl"
              />
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
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-1 hover:opacity-80 transition-opacity",
              isMine ? "bg-gold-500 text-white ml-auto" : "bg-[var(--accent)]"
            )}
          >
            <span className="truncate">{message.media_metadata?.filename || "File"}</span>
          </a>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={cn(
              "px-3 py-1.5 rounded-2xl text-sm break-words",
              isMine
                ? "bg-gold-500 text-white rounded-br-md"
                : "bg-[var(--accent)] text-[var(--foreground)] rounded-bl-md"
            )}
          >
            {message.content}
          </div>
        )}

        {/* Time */}
        <div className={cn(
          "text-[10px] text-[var(--muted-foreground)] mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isMine ? "text-right" : "text-left"
        )}>
          {formatTime(message.created_at)}
          {onReply && (
            <button
              onClick={onReply}
              className="ml-2 hover:text-[var(--foreground)] cursor-pointer"
            >
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
