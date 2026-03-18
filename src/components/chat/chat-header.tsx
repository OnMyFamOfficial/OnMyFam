import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Phone, Video, MoreVertical, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "./chat-provider";
import type { ConversationWithDetails } from "./chat-provider";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  onBack?: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
}

export function ChatHeader({ conversation, onBack, onAudioCall, onVideoCall }: ChatHeaderProps) {
  const { user } = useAuth();
  const { setActiveConversationId, setChatPanelOpen, refreshConversations } = useChat();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const participantCount = conversation.participants.length;
  const subtitle = `${participantCount} Fam in Chat`;
  const isCreator = conversation.created_by === user?.id;

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function handleDeleteChat() {
    if (!confirm("Delete this chat? All messages will be permanently removed.")) return;
    await supabase.from("conversations").delete().eq("id", conversation.id);
    setActiveConversationId(null);
    setChatPanelOpen(false);
    await refreshConversations();
  }

  async function handleLeaveChat() {
    if (!user) return;
    if (!confirm("Leave this chat? You won't see new messages.")) return;
    await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", user.id);
    setActiveConversationId(null);
    setChatPanelOpen(false);
    await refreshConversations();
  }

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
      <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
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

      {/* Call buttons + more */}
      <div className="flex items-center gap-0.5 flex-shrink-0 relative" ref={menuRef}>
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
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px] z-50">
            {isCreator ? (
              <button
                onClick={() => { setShowMenu(false); handleDeleteChat(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-4 h-4" /> Delete Chat
              </button>
            ) : (
              <button
                onClick={() => { setShowMenu(false); handleLeaveChat(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" /> Leave Chat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
