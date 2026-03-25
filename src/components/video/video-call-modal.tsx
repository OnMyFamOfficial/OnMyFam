import { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  VideoTrack,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, VideoIcon, VideoOff, Monitor, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoCall } from "./video-call-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";

const LIVEKIT_URL = "wss://onmyfam-e9a3yyqc.livekit.cloud";

export function VideoCallModal() {
  const { activeCall, endCall } = useVideoCall();
  const { user, profile } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch LiveKit token when call becomes active
  useEffect(() => {
    if (!activeCall || !user) {
      setToken(null);
      return;
    }

    async function fetchToken() {
      try {
        const session = await supabase.auth.getSession();
        const authToken = session.data.session?.access_token;
        if (!authToken) throw new Error("Not authenticated");

        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            roomName: activeCall!.room_name,
            participantName: profile?.display_name || "User",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Token request failed (${res.status})`);
        }
        const data = await res.json();
        setToken(data.token);
      } catch (err: any) {
        console.error("[VideoCall] Token error:", err);
        setError(err.message);
      }
    }

    fetchToken();
  }, [activeCall?.id, activeCall?.status, user]);

  if (!activeCall) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-[90] bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); endCall(); }}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="fixed inset-0 z-[90] bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">
            {activeCall.status === "ringing" ? "Calling..." : "Connecting..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={activeCall.call_type === "video"}
      className="fixed inset-0 z-[90]"
      onDisconnected={() => endCall()}
    >
      <RoomAudioRenderer />
      <RoomContent activeCall={activeCall} onHangUp={endCall} />
    </LiveKitRoom>
  );
}

function RoomContent({
  activeCall,
  onHangUp,
}: {
  activeCall: any;
  onHangUp: () => Promise<void>;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(activeCall.call_type === "audio");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Call timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  }, [localParticipant, isMuted]);

  const toggleCamera = useCallback(async () => {
    await localParticipant.setCameraEnabled(isCameraOff);
    setIsCameraOff(!isCameraOff);
  }, [localParticipant, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    await localParticipant.setScreenShareEnabled(!isScreenSharing);
    setIsScreenSharing(!isScreenSharing);
  }, [localParticipant, isScreenSharing]);

  async function handleHangUp() {
    room.disconnect();
    await onHangUp();
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // Separate tracks by participant
  const videoTracks = tracks.filter(
    (t) => t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare
  );

  return (
    <div className="fixed inset-0 z-[90] bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700">
        <div>
          <h3 className="text-white font-semibold">
            {activeCall.call_type === "video" ? "Video" : "Audio"} Call
          </h3>
          <p className="text-gray-400 text-sm">{formatTime(elapsed)}</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Users className="w-4 h-4" />
          {participants.length}
        </div>
      </div>

      {/* Participant grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div
          className={cn(
            "grid gap-3 h-full",
            participants.length <= 1 && "grid-cols-1",
            participants.length === 2 && "grid-cols-1 md:grid-cols-2",
            participants.length >= 3 && participants.length <= 4 && "grid-cols-2",
            participants.length >= 5 && participants.length <= 9 && "grid-cols-3",
            participants.length >= 10 && "grid-cols-4"
          )}
        >
          {participants.map((participant) => {
            const videoTrack = videoTracks.find(
              (t) =>
                t.participant.identity === participant.identity &&
                t.source === Track.Source.Camera &&
                t.publication?.track
            );
            const screenTrack = videoTracks.find(
              (t) =>
                t.participant.identity === participant.identity &&
                t.source === Track.Source.ScreenShare &&
                t.publication?.track
            );
            const isSelf = participant.identity === localParticipant.identity;
            const participantMuted = !participant.isMicrophoneEnabled;

            return (
              <div
                key={participant.identity}
                className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center md:max-h-[calc(50vh-5rem)]"
              >
                {screenTrack?.publication?.track ? (
                  <VideoTrack
                    trackRef={screenTrack}
                    className="w-full h-full object-contain"
                  />
                ) : videoTrack?.publication?.track ? (
                  <VideoTrack
                    trackRef={videoTrack}
                    className="w-full h-full object-cover"
                    style={isSelf ? { transform: "scaleX(-1)" } : undefined}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-md bg-gold-500/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gold-500">
                        {(participant.name || participant.identity).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-white text-sm font-medium">
                      {participant.name || participant.identity}
                    </span>
                  </div>
                )}

                {/* Name label */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-lg px-2 py-1">
                  <span className="text-white text-xs">
                    {isSelf ? "You" : participant.name || participant.identity}
                  </span>
                  {participantMuted && <MicOff className="w-3 h-3 text-red-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 bg-gray-900/80 border-t border-gray-700">
        <button
          onClick={toggleMute}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer",
            isMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer",
            isCameraOff
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          title={isCameraOff ? "Turn on camera" : "Turn off camera"}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer",
            isScreenSharing
              ? "bg-gold-500/20 text-gold-400 hover:bg-gold-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={handleHangUp}
          className="w-14 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
          title="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
