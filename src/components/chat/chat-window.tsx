import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat, type ConversationWithDetails } from "./chat-provider";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { ChatShortcuts } from "./chat-shortcuts";
import { Pin } from "lucide-react";
import type { Message, Profile } from "@/lib/types";

interface ChatWindowProps {
  conversation: ConversationWithDetails;
  onBack?: () => void;
  onStartCall?: (type: "audio" | "video") => void;
}

const PAGE_SIZE = 40;

export function ChatWindow({ conversation, onBack, onStartCall }: ChatWindowProps) {
  const { user } = useAuth();
  const { markAsRead } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, number>>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Build profile lookup
  const profileMap = new Map<string, Profile>();
  for (const p of conversation.participants) {
    if (p.profile) {
      profileMap.set(p.user_id, p.profile);
    }
  }

  // Fetch messages
  const fetchMessages = useCallback(async (before?: string) => {
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data } = await query;

    if (!data) return;

    const fetched = (data as unknown as Message[]).reverse();

    if (before) {
      setMessages((prev) => [...fetched, ...prev]);
    } else {
      setMessages((prev) => {
        if (prev.length === 0) return fetched;
        // Merge: keep existing, add any new ones
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = fetched.filter((m) => !existingIds.has(m.id));
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }

    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }, [conversation.id]);

  // Initial load
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setHasMore(true);
    setReplyTo(null);
    fetchMessages();
  }, [conversation.id, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, loading]);

  // Realtime: use broadcast for reliable cross-user delivery + postgres_changes as backup
  useEffect(() => {
    const channel = supabase
      .channel(`msgs-${conversation.id}`)
      .on("broadcast", { event: "new-message" }, (payload) => {
        const newMsg = payload.payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        markAsRead(conversation.id);
      })
      .on("broadcast", { event: "reaction" }, (payload) => {
        const { messageId, emoji } = payload.payload as { messageId: string; emoji: string };
        setReactionsMap((prev) => {
          const msgReactions = { ...(prev[messageId] || {}) };
          msgReactions[emoji] = (msgReactions[emoji] || 0) + 1;
          return { ...prev, [messageId]: msgReactions };
        });
      })
      .on("broadcast", { event: "update-message" }, (payload) => {
        const updated = payload.payload as Message;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
        );
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          markAsRead(conversation.id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Poll every 5 seconds as fallback for missed realtime events
    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [conversation.id, markAsRead, fetchMessages]);

  // Typing indicators via broadcast
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`typing-${conversation.id}`);

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { user_id, display_name } = payload.payload as { user_id: string; display_name: string };
        if (user_id === user.id) return;

        setTypingUsers((prev) => {
          if (prev.includes(display_name)) return prev;
          return [...prev, display_name];
        });

        // Clear after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== display_name));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, user]);

  function handleTyping() {
    if (!user || typingTimeoutRef.current) return;

    const channel = supabase.channel(`typing-${conversation.id}`);
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: user.id,
        display_name: profileMap.get(user.id)?.display_name || "Someone",
      },
    });

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }

  // Load more on scroll to top
  function handleScroll() {
    if (!containerRef.current || !hasMore || loading) return;
    if (containerRef.current.scrollTop < 50 && messages.length > 0) {
      fetchMessages(messages[0].created_at);
    }
  }

  return (
    <div className="flex h-full">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          conversation={conversation}
          onBack={onBack}
          onAudioCall={onStartCall ? () => onStartCall("audio") : undefined}
          onVideoCall={onStartCall ? () => onStartCall("video") : undefined}
        />

        {/* Pinned messages bar */}
        {messages.filter((m) => pinnedIds.has(m.id)).length > 0 && (
          <div className="border-b border-[var(--border)] bg-gold-500/5 px-3 py-1.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Pin className="w-3.5 h-3.5 text-gold-500 rotate-45 flex-shrink-0" />
            {messages.filter((m) => pinnedIds.has(m.id)).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--accent)] px-2 py-1 rounded-lg truncate max-w-[200px] flex-shrink-0 cursor-pointer transition-colors"
              >
                {m.content?.slice(0, 40) || "Media"}
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 py-2 chat-gradient-chat chat-scrollbar"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-[var(--muted-foreground)]">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Send the first message!</p>
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="text-center py-2">
                  <button
                    onClick={() => fetchMessages(messages[0].created_at)}
                    className="text-xs text-gold-500 hover:underline cursor-pointer"
                  >
                    Load older messages
                  </button>
                </div>
              )}
              {messages.map((msg, i) => {
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                  msg.message_type === "system";
                return (
                  <div key={msg.id} id={`msg-${msg.id}`}>
                  <MessageBubble
                    message={msg}
                    isMine={msg.sender_id === user?.id}
                    senderProfile={msg.sender as Profile || profileMap.get(msg.sender_id) || null}
                    showAvatar={showAvatar}
                    onReply={() => setReplyTo(msg)}
                    onEdit={async (messageId, newContent) => {
                      await supabase.from("messages").update({ content: newContent }).eq("id", messageId);
                      const updated = { ...msg, content: newContent };
                      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
                      if (channelRef.current) {
                        channelRef.current.send({ type: "broadcast", event: "update-message", payload: updated });
                      }
                    }}
                    onDelete={async (messageId) => {
                      await supabase.from("messages").update({ is_deleted: true, content: null }).eq("id", messageId);
                      const updated = { ...msg, is_deleted: true, content: null };
                      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
                      if (channelRef.current) {
                        channelRef.current.send({ type: "broadcast", event: "update-message", payload: updated });
                      }
                    }}
                    onPin={(messageId) => {
                      setPinnedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(messageId)) next.delete(messageId);
                        else next.add(messageId);
                        return next;
                      });
                    }}
                    onReact={(messageId, emoji) => {
                      setReactionsMap((prev) => {
                        const msgReactions = { ...(prev[messageId] || {}) };
                        msgReactions[emoji] = (msgReactions[emoji] || 0) + 1;
                        return { ...prev, [messageId]: msgReactions };
                      });
                      if (channelRef.current) {
                        channelRef.current.send({
                          type: "broadcast",
                          event: "reaction",
                          payload: { messageId, emoji },
                        });
                      }
                    }}
                    reactions={reactionsMap[msg.id] ? Object.fromEntries(Object.entries(reactionsMap[msg.id]).map(([k, v]) => [k, Array(v).fill("")])) : undefined}
                    isPinned={pinnedIds.has(msg.id)}
                  />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}

          <TypingIndicator names={typingUsers} />
        </div>

        <MessageInput
          conversationId={conversation.id}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onTyping={handleTyping}
        />
      </div>

      {/* Pinned shortcuts column */}
      <ChatShortcuts />
    </div>
  );
}
