import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat, type ConversationWithDetails } from "./chat-provider";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      .select("*, sender:profiles!messages_sender_id_fkey(*), reply_to:messages!messages_reply_to_id_fkey(*, sender:profiles!messages_sender_id_fkey(*))")
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
      setMessages(fetched);
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

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`msgs-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch with sender profile
          const { data } = await supabase
            .from("messages")
            .select("*, sender:profiles!messages_sender_id_fkey(*), reply_to:messages!messages_reply_to_id_fkey(*, sender:profiles!messages_sender_id_fkey(*))")
            .eq("id", newMsg.id)
            .single();

          if (data) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as unknown as Message];
            });
          }

          // Auto mark as read since we're viewing this conversation
          markAsRead(conversation.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, markAsRead]);

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
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onAudioCall={onStartCall ? () => onStartCall("audio") : undefined}
        onVideoCall={onStartCall ? () => onStartCall("video") : undefined}
      />

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]"
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
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.sender_id === user?.id}
                  senderProfile={msg.sender as Profile || profileMap.get(msg.sender_id) || null}
                  showAvatar={showAvatar}
                  onReply={() => setReplyTo(msg)}
                />
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
  );
}
