import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Phone, Video, MoreVertical, Bell, Menu, Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import { useVideoCall } from "@/components/video/video-call-provider";
import { supabase } from "@/lib/supabase";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";

export default function MessagesPage() {
  const { conversationId: paramConvoId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { conversations, activeConversationId, setActiveConversationId, refreshConversations } = useChat();
  const { startCall } = useVideoCall();
  const [mobileShowChat, setMobileShowChat] = useState(!!paramConvoId);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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

  async function handleLeaveChat() {
    if (!user || !activeConversation || !confirm("Leave this chat?")) return;
    await supabase.from("conversation_participants").delete()
      .eq("conversation_id", activeConversation.id)
      .eq("user_id", user.id);
    setActiveConversationId(null);
    await refreshConversations();
  }

  return (
    <div className="h-[calc(100dvh-8rem)] lg:h-screen -m-4 lg:-m-6 flex flex-col overflow-hidden">
      {/* Messages header bar */}
      <div className="h-14 bg-[var(--header-background)] border-b border-[var(--border)] flex items-center px-4 lg:px-0 flex-shrink-0">
        {/* Left section: Messages title (aligned with conversation list) */}
        <div className="w-64 flex-shrink-0 flex items-center justify-between px-4 border-r border-[var(--border)] h-full hidden lg:flex">
          <div>
            <h1 className="text-base font-bold leading-tight">Messages</h1>
            <p className="text-[10px] text-[var(--muted-foreground)] leading-tight">Chat with your family</p>
          </div>
        </div>

        {/* Mobile: hamburger or title */}
        <div className="lg:hidden flex items-center gap-2">
          {mobileShowChat && activeConversation ? (
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          ) : (
            <h1 className="text-base font-bold">Messages</h1>
          )}
        </div>

        {/* Center section: conversation info + call buttons */}
        <div className="flex-1 flex items-center h-full">
          {activeConversation && (
            <div className="flex items-center gap-3 px-4">
              <div
                className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-gold-500/50 transition-all"
                onClick={() => {
                  if (activeConversation.type === "direct" && activeConversation.otherParticipants[0]) {
                    navigate(`/profile/${activeConversation.otherParticipants[0].user_id}`);
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

              {/* Call buttons + more - right next to conversation name */}
              <div className="flex items-center gap-0.5 ml-3">
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

        {/* Right: bell + avatar */}
        <div className="flex items-center gap-1 px-4 flex-shrink-0">
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
  );
}
