import { useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { Phone, Video, MoreVertical, Bell, Menu, ArrowLeft, Trash2, LogOut, UserPlus, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { useVideoCall } from "@/components/video/video-call-provider";
import { supabase } from "@/lib/supabase";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";

export default function MessagesPage() {
  const { conversationId: paramConvoId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { onMenuClick } = useOutletContext<{ onMenuClick: () => void }>();
  const { user, profile } = useAuth();
  const { conversations, activeConversationId, setActiveConversationId, refreshConversations } = useChat();
  const { startCall } = useVideoCall();
  const { members } = useFamily();
  const [mobileShowChat, setMobileShowChat] = useState(!!paramConvoId);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);

  const effectiveId = paramConvoId || activeConversationId;
  const activeConversation = effectiveId
    ? conversations.find((c) => c.id === effectiveId) || null
    : null;

  function handleSelectConversation() {
    setMobileShowChat(true);
  }

  function handleBack() {
    setActiveConversationId(null);
    setMobileShowChat(false);
    navigate("/messages");
  }

  const isCreator = activeConversation?.created_by === user?.id;

  async function handleDeleteChat() {
    if (!activeConversation || !confirm("Delete this chat? All messages will be permanently removed.")) return;
    await supabase.from("conversations").delete().eq("id", activeConversation.id);
    setActiveConversationId(null);
    await refreshConversations();
  }

  async function handleAddMember(userId: string) {
    if (!activeConversation) return;
    setAddingMember(userId);
    const { error } = await supabase.from("conversation_participants").insert({
      conversation_id: activeConversation.id,
      user_id: userId,
      role: "member",
    });
    if (error) {
      console.error("Add member error:", error);
    } else {
      await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user!.id,
        content: "A new member was added to the chat",
        message_type: "system",
      });
      await refreshConversations();
    }
    setAddingMember(null);
    setShowAddMember(false);
  }

  async function handleLeaveChat() {
    if (!user || !activeConversation || !confirm("Leave this chat?")) return;
    await supabase.from("conversation_participants").delete()
      .eq("conversation_id", activeConversation.id)
      .eq("user_id", user.id);
    setActiveConversationId(null);
    await refreshConversations();
  }

  return (
    <>
      {/* Add Member Modal */}
      {showAddMember && activeConversation && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowAddMember(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gold-500" />
                <h3 className="font-semibold text-sm">Add to Chat</h3>
              </div>
              <button onClick={() => setShowAddMember(false)} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(() => {
                const currentParticipantIds = new Set(activeConversation.participants.map((p) => p.user_id));
                const available = members.filter((m) => !currentParticipantIds.has(m.user_id));
                if (available.length === 0) {
                  return <p className="text-sm text-[var(--muted-foreground)] text-center py-8">All family members are already in this chat</p>;
                }
                return available.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => handleAddMember(m.user_id)}
                    disabled={addingMember === m.user_id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left disabled:opacity-50"
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
                    <span className="text-sm flex-1 truncate">{m.profile?.display_name || "Unknown"}</span>
                    {addingMember === m.user_id ? (
                      <span className="text-xs text-[var(--muted-foreground)]">Adding...</span>
                    ) : (
                      <UserPlus className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                  </button>
                ));
              })()}
            </div>
          </div>
        </>
      )}

      {/* Members Modal */}
      {showMembers && activeConversation && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowMembers(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-semibold text-sm">{activeConversation.displayName} ({activeConversation.participants.length} members)</h3>
              <button onClick={() => setShowMembers(false)} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeConversation.participants.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => { setShowMembers(false); navigate(`/profile/${p.user_id}`); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-gold-500">
                        {p.profile?.display_name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{p.profile?.display_name || "Unknown"}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{p.user_id === user?.id ? "You" : p.role}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-[var(--border)]">
              <button
                onClick={() => { setShowMembers(false); setShowAddMember(true); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500 text-sm font-medium hover:bg-gold-600 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>
          </div>
        </>
      )}

    <div className="h-[calc(100vh-4rem)] lg:h-screen -m-4 lg:-m-6 flex flex-col overflow-hidden">
      {/* Messages header bar */}
      <div className="h-14 bg-[var(--header-background)] border-b border-[var(--border)] flex items-center px-4 lg:px-0 flex-shrink-0">
        {/* Left section: Messages title (aligned with conversation list) */}
        <div className="w-64 flex-shrink-0 flex items-center justify-between px-4 border-r border-[var(--border)] h-full hidden lg:flex">
          <div>
            <h1 className="text-base font-bold leading-tight">Messages</h1>
            <p className="text-[10px] text-[var(--muted-foreground)] leading-tight">Chat with your family</p>
          </div>
        </div>

        {/* Mobile: hamburger + title or back arrow + conversation info */}
        <div className="lg:hidden flex items-center gap-2">
          {mobileShowChat && activeConversation ? (
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer">
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold">Messages</h1>
            </>
          )}
        </div>

        {/* Center section: conversation info + call buttons */}
        <div className="flex-1 flex items-center h-full">
          {activeConversation && (
            <div className={`items-center gap-3 px-4 w-full ${!mobileShowChat ? "hidden lg:flex" : "flex"}`}>
              <div
                className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-gold-500/50 transition-all"
                onClick={() => {
                  if (activeConversation.type === "direct" && activeConversation.otherParticipants[0]) {
                    navigate(`/profile/${activeConversation.otherParticipants[0].user_id}`);
                  } else {
                    setShowMembers(true);
                  }
                }}
              >
                {activeConversation.displayAvatar ? (
                  <img src={activeConversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-gold-500">
                    {activeConversation.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">{activeConversation.displayName}</h2>
                <p className="text-[10px] text-[var(--muted-foreground)]">{activeConversation.participants.length} Fam in Chat</p>
              </div>

              <div className="flex-1" />
              {/* Call buttons + more */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => startCall(activeConversation.id, "audio")}
                  className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  title="Audio call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startCall(activeConversation.id, "video")}
                  className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  title="Video call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]">
                        <button
                          onClick={() => { setShowMoreMenu(false); setShowAddMember(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                        >
                          <UserPlus className="w-4 h-4" /> Add Member
                        </button>
                        <div className="my-1 border-t border-[var(--border)]" />
                        {isCreator ? (
                          <button
                            onClick={() => { setShowMoreMenu(false); handleDeleteChat(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-4 h-4" /> Delete Chat
                          </button>
                        ) : (
                          <button
                            onClick={() => { setShowMoreMenu(false); handleLeaveChat(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                          >
                            <LogOut className="w-4 h-4" /> Leave Chat
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: bell + avatar (desktop only) */}
        <div className="hidden lg:flex items-center gap-1 px-4 flex-shrink-0">
          <button className="relative p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-gold-500 rounded-full" />
          </button>

          <div className="w-7 h-7 rounded-md bg-gold-500/20 border border-gold-500/30 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-gold-500">
                {profile?.display_name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop */}
        <div className="hidden lg:flex w-full overflow-hidden">
          <div className="w-64 border-r border-[var(--border)] flex-shrink-0">
            <ConversationList />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            {activeConversation ? (
              <ChatWindow
                conversation={activeConversation}
                showShortcuts
                hideHeader
                onStartCall={(type) => startCall(activeConversation.id, type)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
                <div className="text-center">
                  <p className="text-lg font-medium mb-1">Select a conversation</p>
                  <p className="text-sm">Choose from your existing conversations or start a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden w-full">
          {mobileShowChat && activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              onBack={handleBack}
              hideHeader
              onStartCall={(type) => startCall(activeConversation.id, type)}
            />
          ) : (
            <ConversationList onSelectConversation={handleSelectConversation} />
          )}
        </div>
      </div>
    </div>
    </>
  );
}
