import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "@/components/chat/chat-provider";
import { useVideoCall } from "@/components/video/video-call-provider";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";

export default function MessagesPage() {
  const { conversationId: paramConvoId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { conversations, activeConversationId, setActiveConversationId } = useChat();
  const { startCall } = useVideoCall();
  const [mobileShowChat, setMobileShowChat] = useState(!!paramConvoId);

  // Sync URL param to active conversation
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

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] -m-4 lg:-m-6 flex overflow-hidden">
      {/* Desktop: two-column layout */}
      <div className="hidden lg:flex w-full overflow-hidden">
        {/* Left: conversation list */}
        <div className="w-64 border-r border-[var(--border)] flex-shrink-0">
          <ConversationList />
        </div>

        {/* Right: active chat */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              showShortcuts
              onStartCall={(type) => {
                startCall(activeConversation.id, type);
              }}
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

      {/* Mobile: single panel with transition */}
      <div className="lg:hidden w-full">
        {mobileShowChat && activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            onBack={handleBack}
            onStartCall={(type) => {
              console.log("Start call:", type, activeConversation.id);
            }}
          />
        ) : (
          <ConversationList onSelectConversation={handleSelectConversation} />
        )}
      </div>
    </div>
  );
}
