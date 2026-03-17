import { Mic, MicOff, VideoIcon, VideoOff, Monitor, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onHangUp: () => void;
}

export function CallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreen,
  onHangUp,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <button
        onClick={onToggleMute}
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
        onClick={onToggleCamera}
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
        onClick={onToggleScreen}
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
        onClick={onHangUp}
        className="w-14 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
        title="End call"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
