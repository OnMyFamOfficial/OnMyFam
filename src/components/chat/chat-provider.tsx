import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import type { Conversation, ConversationParticipant, Profile } from "@/lib/types";

interface ChatContextType {
  conversations: ConversationWithDetails[];
  unreadCounts: Record<string, number>;
  totalUnread: number;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  chatPanelOpen: boolean;
  setChatPanelOpen: (open: boolean) => void;
  openDirectMessage: (userId: string) => Promise<string | null>;
  createGroupChat: (name: string, memberIds: string[]) => Promise<string | null>;
  refreshConversations: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
}

export interface ConversationWithDetails extends Conversation {
  participants: (ConversationParticipant & { profile: Profile })[];
  otherParticipants: (ConversationParticipant & { profile: Profile })[];
  displayName: string;
  displayAvatar: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeConversationId, setActiveConversationIdRaw] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("omf-active-conversation") || null;
    }
    return null;
  });

  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdRaw(id);
    if (id) {
      localStorage.setItem("omf-active-conversation", id);
    } else {
      localStorage.removeItem("omf-active-conversation");
    }
  }, []);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

  const fetchConversations = useCallback(async () => {
    if (!user || !currentFamily) {
      setConversations([]);
      return;
    }

    // Get conversation IDs where user is a participant
    const { data: myParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!myParticipations || myParticipations.length === 0) {
      setConversations([]);
      return;
    }

    const convoIds = myParticipations.map((p) => p.conversation_id);

    // Get conversations with participants and profiles
    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convoIds)
      .eq("family_id", currentFamily.id)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (!convos) {
      setConversations([]);
      return;
    }

    // Get all participants for these conversations
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("*")
      .in("conversation_id", convoIds);

    // Get unique user IDs and fetch their profiles
    const userIds = [...new Set((allParticipants || []).map((p) => p.user_id))];
    const { data: profilesData } = userIds.length > 0
      ? await supabase.from("profiles").select("*").in("id", userIds)
      : { data: [] };

    const profileMap = new Map<string, Profile>();
    for (const p of (profilesData || []) as Profile[]) {
      profileMap.set(p.id, p);
    }

    const participantsByConvo = new Map<string, (ConversationParticipant & { profile: Profile })[]>();
    for (const p of (allParticipants || []) as ConversationParticipant[]) {
      const profile = profileMap.get(p.user_id) || { id: p.user_id, display_name: "Unknown", avatar_url: null } as Profile;
      const list = participantsByConvo.get(p.conversation_id) || [];
      list.push({ ...p, profile });
      participantsByConvo.set(p.conversation_id, list);
    }

    const enriched: ConversationWithDetails[] = (convos as Conversation[]).map((c) => {
      const participants = participantsByConvo.get(c.id) || [];
      const otherParticipants = participants.filter((p) => p.user_id !== user.id);

      let displayName = c.name || "";
      let displayAvatar = c.avatar_url;

      if (c.type === "direct" && otherParticipants.length > 0) {
        displayName = otherParticipants[0].profile?.display_name || "Unknown";
        displayAvatar = otherParticipants[0].profile?.avatar_url || null;
      } else if (!displayName && c.type === "group") {
        displayName = otherParticipants
          .map((p) => p.profile?.display_name || "Unknown")
          .join(", ") || "Group Chat";
      }

      return { ...c, participants, otherParticipants, displayName, displayAvatar };
    });

    setConversations(enriched);
  }, [user, currentFamily]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadCounts({});
      return;
    }

    const { data } = await supabase.rpc("get_unread_counts");
    if (data) {
      const counts: Record<string, number> = {};
      for (const row of data as { conversation_id: string; unread_count: number }[]) {
        counts[row.conversation_id] = row.unread_count;
      }
      setUnreadCounts(counts);
    }
  }, [user]);

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, [user]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user || !currentFamily) return;

    const channel = supabase
      .channel(`chat-${currentFamily.id}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { conversation_id: string; sender_id: string };
          // Refresh conversations to update preview
          fetchConversations();
          // Update unread if not from current user and not in active conversation
          if (msg.sender_id !== user.id && msg.conversation_id !== activeConversationId) {
            setUnreadCounts((prev) => ({
              ...prev,
              [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1,
            }));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, currentFamily, activeConversationId, fetchConversations]);

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchUnreadCounts();
  }, [fetchConversations, fetchUnreadCounts]);

  // Auto-mark as read when opening a conversation
  useEffect(() => {
    if (activeConversationId) {
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, markAsRead]);

  const openDirectMessage = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!user || !currentFamily) return null;

    const { data, error } = await supabase.rpc("find_or_create_direct_conversation", {
      p_family_id: currentFamily.id,
      p_other_user_id: otherUserId,
    });

    if (error) {
      console.error("Failed to open DM:", error);
      return null;
    }

    const conversationId = data as string;
    await fetchConversations();
    setActiveConversationId(conversationId);
    setChatPanelOpen(true);
    return conversationId;
  }, [user, currentFamily, fetchConversations]);

  const createGroupChat = useCallback(async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!user || !currentFamily) return null;

    const { data, error } = await supabase.rpc("create_group_chat", {
      p_family_id: currentFamily.id,
      p_name: name,
      p_member_ids: memberIds,
    });

    if (error || !data) {
      console.error("Failed to create group chat:", error);
      return null;
    }

    const conversationId = data as string;
    await fetchConversations();
    setActiveConversationId(conversationId);
    setChatPanelOpen(true);
    return conversationId;
  }, [user, currentFamily, fetchConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        unreadCounts,
        totalUnread,
        activeConversationId,
        setActiveConversationId,
        chatPanelOpen,
        setChatPanelOpen,
        openDirectMessage,
        createGroupChat,
        refreshConversations: fetchConversations,
        markAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
