import { useState } from "react";
import { Search, Plus, Users } from "lucide-react";
import { useChat } from "./chat-provider";
import { ConversationItem } from "./conversation-item";
import { GroupCreateModal } from "./group-create-modal";

interface ConversationListProps {
  onSelectConversation?: () => void;
}

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { conversations, unreadCounts, activeConversationId, setActiveConversationId } = useChat();
  const [search, setSearch] = useState("");
  const [showGroupCreate, setShowGroupCreate] = useState(false);

  const filtered = search
    ? conversations.filter((c) =>
        c.displayName.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--border)] dark:bg-black">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base">Messages</h3>
          <button
            onClick={() => setShowGroupCreate(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
            title="New group chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-[var(--background)] dark:!bg-[#38394d] border border-[var(--input)] rounded-lg px-2.5 py-1.5">
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

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin] chat-gradient-down">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
            <Users className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">
              {search ? "No conversations found" : "No messages yet"}
            </p>
            <p className="text-xs mt-1">
              {search ? "Try a different search" : "Click a family member to start chatting"}
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

      {showGroupCreate && (
        <GroupCreateModal onClose={() => setShowGroupCreate(false)} />
      )}
    </div>
  );
}
