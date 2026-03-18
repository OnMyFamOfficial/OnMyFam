import { useState } from "react";
import { X, Minimize2, Maximize2, Maximize } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChat } from "./chat-provider";
import { useVideoCall } from "@/components/video/video-call-provider";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatPanelOpen, setChatPanelOpen, activeConversationId, setActiveConversationId, conversations } = useChat();
  const { startCall } = useVideoCall();
  const [minimized, setMinimized] = useState(false);

  // Don't show mini chat on the Messages page
  if (location.pathname.startsWith("/messages")) return null;
  if (!chatPanelOpen) return null;

  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) || null
    : null;

  function handleOpenFull() {
    setChatPanelOpen(false);
    navigate("/messages");
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 right-6 z-[55] hidden lg:flex flex-col bg-[var(--card)] border border-[var(--border)] border-b-0 rounded-t-xl shadow-2xl transition-all duration-300",
        minimized ? "w-72 h-12" : "w-[380px] h-[520px]"
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] rounded-t-xl flex-shrink-0">
        <span className="text-sm font-semibold">
          {activeConversation ? activeConversation.displayName : "Messages"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleOpenFull}
            className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
            title="Open in full page"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => { setChatPanelOpen(false); setActiveConversationId(null); }}
            className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="flex-1 overflow-hidden">
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              onBack={() => setActiveConversationId(null)}
              onStartCall={(type) => {
                startCall(activeConversation.id, type);
              }}
            />
          ) : (
            <ConversationList />
          )}
        </div>
      )}
    </div>
  );
}
