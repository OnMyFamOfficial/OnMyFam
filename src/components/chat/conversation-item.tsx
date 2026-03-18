import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationWithDetails } from "./chat-provider";

interface ConversationItemProps {
  conversation: ConversationWithDetails;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}

export function ConversationItem({ conversation, isActive, unreadCount, onClick }: ConversationItemProps) {
  const hasUnread = unreadCount > 0;

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left cursor-pointer",
        isActive
          ? "bg-gold-500/15 text-[var(--foreground)]"
          : "hover:bg-[var(--accent)]"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
          {conversation.displayAvatar ? (
            <img
              src={conversation.displayAvatar}
              alt={conversation.displayName}
              className="w-full h-full object-cover"
            />
          ) : conversation.type === "group" ? (
            <span className="text-sm font-bold text-gold-500">
              {conversation.displayName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span className="text-sm font-bold text-gold-500">
              {conversation.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {conversation.type === "direct" && (
          <Circle
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-gray-400 fill-gray-400"
            strokeWidth={3}
            style={{ stroke: "var(--card)" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm truncate", hasUnread ? "font-semibold" : "font-medium")}>
            {conversation.displayName}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0 ml-2">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className={cn(
            "text-xs truncate",
            hasUnread ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"
          )}>
            {conversation.last_message_preview || "No messages yet"}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 ml-2 min-w-[18px] h-[18px] rounded-full bg-gold-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
