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
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, Set<string>>>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Load pinned messages from DB on conversation change
  useEffect(() => {
    async function loadPins() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, pinned_at")
        .eq("conversation_id", conversation.id)
        .not("pinned_at", "is", null);
      console.log("[Pins] loaded:", data, "error:", error);
      if (data && data.length > 0) {
        setPinnedIds(new Set(data.map((m) => m.id)));
      }
    }
    loadPins();
  }, [conversation.id]);
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

  // Fetch messages - initial load or load older
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
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = fetched.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setMessages((prev) => {
        if (prev.length === 0) {
          setHasMore(data.length === PAGE_SIZE);
          return fetched;
        }
        // Poll merge: combine without duplicates
        const allById = new Map<string, Message>();
        for (const m of prev) allById.set(m.id, m);
        for (const m of fetched) {
          if (!allById.has(m.id)) allById.set(m.id, m);
        }
        const merged = [...allById.values()].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        // Only update if something actually changed
        if (merged.length === prev.length) return prev;
        return merged;
      });
    }

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

  // Scroll to bottom on new messages + hide mobile address bar
  useEffect(() => {
    if (!loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // Nudge window scroll to collapse mobile address bar
      window.scrollTo(0, 1);
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
        const { messageId, emoji, userId, action } = payload.payload as { messageId: string; emoji: string; userId: string; action: "add" | "remove" };
        setReactionsMap((prev) => {
          const msgReactions = prev[messageId] ? { ...prev[messageId] } : {} as Record<string, Set<string>>;
          Object.keys(msgReactions).forEach((e) => {
            msgReactions[e] = new Set(msgReactions[e]);
          });
          if (action === "remove") {
            if (msgReactions[emoji]) {
              msgReactions[emoji] = new Set(msgReactions[emoji]);
              msgReactions[emoji].delete(userId);
            }
          } else {
            // Remove from any other emoji first (one reaction per user)
            Object.keys(msgReactions).forEach((e) => {
              if (e !== emoji) {
                msgReactions[e] = new Set(msgReactions[e]);
                msgReactions[e].delete(userId);
              }
            });
            msgReactions[emoji] = new Set(msgReactions[emoji] || []);
            msgReactions[emoji].add(userId);
          }
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

    // Poll every 10 seconds as fallback for missed realtime events
    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 10000);

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

  // Scroll to a message - works on mobile too
  function scrollToMessage(msgId: string) {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el || !containerRef.current) return;
    const container = containerRef.current;
    const elTop = el.offsetTop - container.offsetTop;
    const targetScroll = elTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: targetScroll, behavior: "smooth" });
    // Flash highlight
    el.style.transition = "background-color 0.3s";
    el.style.backgroundColor = "rgba(184, 134, 11, 0.15)";
    setTimeout(() => { el.style.backgroundColor = ""; }, 1500);
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

        {/* Pinned message strip - Telegram style */}
        {(() => {
          const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));
          if (pinnedMessages.length === 0) return null;
          const safeIndex = Math.min(currentPinIndex, pinnedMessages.length - 1);
          const currentPin = pinnedMessages[safeIndex];
          if (!currentPin) return null;
          return (
            <button
              onClick={() => {
                scrollToMessage(currentPin.id);
                setCurrentPinIndex((prev) => (prev + 1) % pinnedMessages.length);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-gold-500/5 hover:bg-gold-500/10 transition-colors cursor-pointer text-left"
              style={{ maxWidth: "100%", overflow: "hidden" }}
            >
              <Pin className="w-3.5 h-3.5 text-gold-500 rotate-45 flex-shrink-0" />
              <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                <span className="text-[10px] text-gold-500 font-medium">
                  Pinned Message {pinnedMessages.length > 1 ? `${safeIndex + 1}/${pinnedMessages.length}` : ""}
                </span>
                <p className="text-xs text-[var(--foreground)] whitespace-nowrap overflow-hidden text-ellipsis">
                  {currentPin.content || "Media"}
                </p>
              </div>
            </button>
          );
        })()}

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
              {(showPinnedOnly ? messages.filter((m) => pinnedIds.has(m.id)) : messages).map((msg, i, arr) => {
                const prevMsg = i > 0 ? arr[i - 1] : null;
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
                    onPin={async (messageId) => {
                      const isPinned = pinnedIds.has(messageId);
                      const { error: pinError } = await supabase.from("messages").update({
                        pinned_at: isPinned ? null : new Date().toISOString(),
                      }).eq("id", messageId);
                      console.log("[Pin] save:", messageId, isPinned ? "unpin" : "pin", "error:", pinError);
                      setPinnedIds((prev) => {
                        const next = new Set(prev);
                        if (isPinned) next.delete(messageId);
                        else next.add(messageId);
                        return next;
                      });
                    }}
                    currentUserId={user?.id}
                    onReact={(messageId, emoji, userId) => {
                      setReactionsMap((prev) => {
                        const msgReactions: Record<string, Set<string>> = {};
                        // Copy existing
                        Object.entries(prev[messageId] || {}).forEach(([e, s]) => {
                          msgReactions[e] = new Set(s);
                        });
                        // Check if user already reacted with this emoji (toggle off)
                        if (msgReactions[emoji]?.has(userId)) {
                          msgReactions[emoji].delete(userId);
                        } else {
                          // Remove from any other emoji first
                          Object.values(msgReactions).forEach((s) => s.delete(userId));
                          // Add to this emoji
                          if (!msgReactions[emoji]) msgReactions[emoji] = new Set();
                          msgReactions[emoji].add(userId);
                        }
                        return { ...prev, [messageId]: msgReactions };
                      });
                      if (channelRef.current) {
                        const isRemoving = reactionsMap[messageId]?.[emoji]?.has(userId);
                        channelRef.current.send({
                          type: "broadcast",
                          event: "reaction",
                          payload: { messageId, emoji, userId, action: isRemoving ? "remove" : "add" },
                        });
                      }
                    }}
                    reactions={reactionsMap[msg.id]}
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
      <ChatShortcuts
        pinnedCount={messages.filter((m) => pinnedIds.has(m.id)).length}
        showPinnedOnly={showPinnedOnly}
        onPinUp={() => {
          const pinned = messages.filter((m) => pinnedIds.has(m.id));
          if (pinned.length === 0) return;
          const newIndex = (currentPinIndex - 1 + pinned.length) % pinned.length;
          setCurrentPinIndex(newIndex);
          scrollToMessage(pinned[newIndex].id);
        }}
        onPinDown={() => {
          const pinned = messages.filter((m) => pinnedIds.has(m.id));
          if (pinned.length === 0) return;
          const newIndex = (currentPinIndex + 1) % pinned.length;
          setCurrentPinIndex(newIndex);
          scrollToMessage(pinned[newIndex].id);
        }}
        onTogglePinFilter={() => setShowPinnedOnly((prev) => !prev)}
      />
    </div>
  );
}
