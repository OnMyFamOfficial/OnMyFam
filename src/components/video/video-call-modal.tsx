import { useState, useEffect, useRef } from "react";
import { useVideoCall } from "./video-call-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { CallControls } from "./call-controls";
import { ParticipantTile } from "./participant-tile";

export function VideoCallModal() {
  const { activeCall, endCall } = useVideoCall();
  const { profile } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(activeCall?.call_type === "audio");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  if (!activeCall) return null;

  const isVideo = activeCall.call_type === "video";

  // Start local media
  useEffect(() => {
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to access media devices:", err);
      }
    }

    if (activeCall.status === "active") {
      startMedia();
    }

    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [activeCall.status]);

  // Call timer
  useEffect(() => {
    if (activeCall.status === "active") {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall.status]);

  function toggleMute() {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setIsMuted(!isMuted);
  }

  function toggleCamera() {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setIsCameraOff(!isCameraOff);
  }

  async function toggleScreenShare() {
    if (isScreenSharing) {
      // Stop screen share, revert to camera
      setIsScreenSharing(false);
    } else {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
      } catch {
        // User cancelled
      }
    }
  }

  async function handleHangUp() {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    await endCall();
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700">
        <div>
          <h3 className="text-white font-semibold">
            {isVideo ? "Video" : "Audio"} Call
          </h3>
          <p className="text-gray-400 text-sm">
            {activeCall.status === "ringing" ? "Calling..." : formatTime(elapsed)}
          </p>
        </div>
      </div>

      {/* Participant grid */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
          {/* Self */}
          <ParticipantTile
            name={profile?.display_name || "You"}
            avatarUrl={profile?.avatar_url}
            isMuted={isMuted}
            isSelf
            videoStream={isVideo && !isCameraOff ? localStream : null}
          />

          {/* Remote participant placeholder */}
          {activeCall.status === "ringing" ? (
            <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gold-500/20 flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <span className="text-2xl font-bold text-gold-500">?</span>
                </div>
                <p className="text-gray-400 text-sm">Ringing...</p>
              </div>
            </div>
          ) : (
            <ParticipantTile
              name="Participant"
              isMuted={false}
              videoStream={null}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <CallControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreen={toggleScreenShare}
        onHangUp={handleHangUp}
      />
    </div>
  );
}
