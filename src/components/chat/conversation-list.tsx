import { useState, useRef, useEffect } from "react";
import { Search, Plus, Users, User, UsersRound, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { useChat } from "./chat-provider";
import { ConversationItem } from "./conversation-item";
import { GroupCreateModal } from "./group-create-modal";

interface ConversationListProps {
  onSelectConversation?: () => void;
}

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { user } = useAuth();
  const { members } = useFamily();
  const { conversations, unreadCounts, activeConversationId, setActiveConversationId, openDirectMessage } = useChat();
  const [search, setSearch] = useState("");
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNewMenu]);

  const filtered = search
    ? conversations.filter((c) =>
        c.displayName.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const otherMembers = members.filter((m) => m.user_id !== user?.id);

  async function handleStartDm(userId: string) {
    setShowDmPicker(false);
    const convoId = await openDirectMessage(userId);
    if (convoId) {
      setActiveConversationId(convoId);
      onSelectConversation?.();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mb-2">
          <div className="relative w-full" ref={menuRef}>
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="w-full px-3 py-1.5 rounded-lg bg-gold-500 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:bg-gold-600"
              title="New Conversation"
            >
              <Plus className="w-3.5 h-3.5" />
              New Conversation
            </button>
            {showNewMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={() => { setShowNewMenu(false); setShowDmPicker(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                >
                  <User className="w-4 h-4" /> New Chat
                </button>
                <button
                  onClick={() => { setShowNewMenu(false); setShowGroupCreate(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                >
                  <UsersRound className="w-4 h-4" /> New Group Chat
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none w-full"
          />
        </div>
      </div>

      {/* DM member picker */}
      {showDmPicker ? (
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <span className="text-sm font-medium">Choose a person</span>
            <button
              onClick={() => setShowDmPicker(false)}
              className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {otherMembers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No family members yet</p>
          ) : (
            otherMembers.map((m) => (
              <button
                key={m.user_id}
                onClick={() => handleStartDm(m.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">
                      {m.profile?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <span className="text-sm truncate">{m.profile?.display_name || "Unknown"}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        /* Conversation list */
        <div className="flex-1 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden chat-gradient-down">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
              <Users className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {search ? "No conversations found" : "No messages yet"}
              </p>
              <p className="text-xs mt-1">
                {search ? "Try a different search" : "Tap + to start a conversation"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((convo) => (
                <ConversationItem
                  key={convo.id}
                  conversation={convo}
                  isActive={convo.id === activeConversationId}
                  unreadCount={unreadCounts[convo.id] || 0}
                  onClick={() => {
                    setActiveConversationId(convo.id);
                    onSelectConversation?.();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showGroupCreate && (
        <GroupCreateModal onClose={() => setShowGroupCreate(false)} />
      )}
    </div>
  );
}
