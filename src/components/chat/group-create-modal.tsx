import { useState } from "react";
import { X, Check } from "lucide-react";
import { useFamily } from "@/lib/hooks/use-family";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "./chat-provider";

interface GroupCreateModalProps {
  onClose: () => void;
}

export function GroupCreateModal({ onClose }: GroupCreateModalProps) {
  const { user } = useAuth();
  const { members } = useFamily();
  const { createGroupChat } = useChat();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const otherMembers = members.filter((m) => m.user_id !== user?.id);

  function toggleMember(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.size < 1) return;
    setCreating(true);
    await createGroupChat(name.trim(), Array.from(selected));
    setCreating(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-semibold">New Group Chat</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Group name */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family group, Cousins chat..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)] text-sm outline-none focus:ring-1 focus:ring-gold-500"
              autoFocus
            />
          </div>

          {/* Member selection */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
              Add Members ({selected.size} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-lg [scrollbar-width:thin]">
              {otherMembers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                  No family members to add
                </p>
              ) : (
                otherMembers.map((m) => {
                  const isSelected = selected.has(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleMember(m.user_id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--accent)] transition-colors text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {m.profile?.avatar_url ? (
                          <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gold-500">
                            {m.profile?.display_name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <span className="text-sm flex-1 truncate">{m.profile?.display_name || "Unknown"}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? "border-gold-500 bg-gold-500" : "border-[var(--border)]"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selected.size < 1 || creating}
            className="w-full py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {creating ? "Creating..." : "Create Group Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
