import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import type { VideoCall } from "@/lib/types";

interface VideoCallContextType {
  activeCall: VideoCall | null;
  incomingCall: VideoCall | null;
  startCall: (conversationId: string, callType: "audio" | "video") => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  isCalling: boolean;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<VideoCall | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  // Listen for incoming calls via realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`video-calls-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_calls" },
        async (payload) => {
          const call = payload.new as VideoCall;
          // Only show incoming calls not initiated by us
          if (call.initiated_by !== user.id && call.status === "ringing") {
            // Check if we're a participant in this conversation
            const { data: participant } = await supabase
              .from("conversation_participants")
              .select("id")
              .eq("conversation_id", call.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (!participant) return; // Not our conversation

            // Fetch initiator profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", call.initiated_by)
              .single();

            setIncomingCall({
              ...call,
              initiator: profile || undefined,
            } as VideoCall);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "video_calls" },
        (payload) => {
          const call = payload.new as VideoCall;
          // If a call we're watching got ended/declined, clear it
          if (call.status === "ended" || call.status === "declined" || call.status === "missed") {
            if (activeCall?.id === call.id) {
              setActiveCall(null);
            }
            if (incomingCall?.id === call.id) {
              setIncomingCall(null);
            }
          }
          // If call became active, update
          if (call.status === "active" && activeCall?.id === call.id) {
            setActiveCall(call);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeCall, incomingCall]);

  const startCall = useCallback(async (conversationId: string, callType: "audio" | "video") => {
    if (!user) return;
    setIsCalling(true);

    try {
      // Create a room name
      const roomName = `omf-${conversationId.slice(0, 8)}-${Date.now()}`;

      // Insert call record
      const { data: call, error } = await supabase
        .from("video_calls")
        .insert({
          conversation_id: conversationId,
          initiated_by: user.id,
          call_type: callType,
          status: "ringing",
          room_name: roomName,
        })
        .select()
        .single();

      if (error || !call) {
        console.error("Failed to start call:", error);
        return;
      }

      // Send system message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `Started a ${callType} call`,
        message_type: "system",
      });

      setActiveCall(call as VideoCall);
    } finally {
      setIsCalling(false);
    }
  }, [user]);

  const acceptCall = useCallback(async (callId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("video_calls")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select()
      .single();

    if (!error && data) {
      setActiveCall(data as VideoCall);
      setIncomingCall(null);
    }
  }, [user]);

  const declineCall = useCallback(async (callId: string) => {
    await supabase
      .from("video_calls")
      .update({ status: "declined" })
      .eq("id", callId);

    setIncomingCall(null);
  }, []);

  const endCall = useCallback(async () => {
    if (!activeCall) return;

    const endedAt = new Date();
    const startedAt = activeCall.started_at ? new Date(activeCall.started_at) : endedAt;
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    await supabase
      .from("video_calls")
      .update({
        status: "ended",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", activeCall.id);

    // Send system message
    await supabase.from("messages").insert({
      conversation_id: activeCall.conversation_id,
      sender_id: activeCall.initiated_by,
      content: `Call ended (${formatDuration(durationSeconds)})`,
      message_type: "system",
    });

    setActiveCall(null);
  }, [activeCall]);

  return (
    <VideoCallContext.Provider
      value={{
        activeCall,
        incomingCall,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        isCalling,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error("useVideoCall must be used within a VideoCallProvider");
  }
  return context;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
