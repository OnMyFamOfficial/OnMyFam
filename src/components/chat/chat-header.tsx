import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import type { ConversationWithDetails } from "./chat-provider";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  onBack?: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
}

export function ChatHeader({ conversation, onBack, onAudioCall, onVideoCall }: ChatHeaderProps) {
  const participantCount = conversation.participants.length;
  const subtitle = conversation.type === "group"
    ? `${participantCount} members`
    : conversation.otherParticipants[0]?.profile?.location || "Family member";

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--card)]">
      {onBack && (
        <button
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
        {conversation.displayAvatar ? (
          <img src={conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-gold-500">
            {conversation.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold truncate">{conversation.displayName}</h4>
        <p className="text-[10px] text-[var(--muted-foreground)] truncate">{subtitle}</p>
      </div>

      {/* Call buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {onAudioCall && (
          <button
            onClick={onAudioCall}
            className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            title="Audio call"
          >
            <Phone className="w-4 h-4" />
          </button>
        )}
        {onVideoCall && (
          <button
            onClick={onVideoCall}
            className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            title="Video call"
          >
            <Video className="w-4 h-4" />
          </button>
        )}
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
