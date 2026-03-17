import { Phone, PhoneOff, Video } from "lucide-react";
import { useVideoCall } from "./video-call-provider";

export function IncomingCallToast() {
  const { incomingCall, acceptCall, declineCall } = useVideoCall();

  if (!incomingCall) return null;

  const callerName = incomingCall.initiator?.display_name || "Someone";
  const isVideo = incomingCall.call_type === "video";

  return (
    <div className="fixed top-4 right-4 z-[80] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-4 w-72">
        {/* Caller info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden animate-pulse">
              {incomingCall.initiator?.avatar_url ? (
                <img
                  src={incomingCall.initiator.avatar_url}
                  alt={callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-gold-500">
                  {callerName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              {isVideo ? <Video className="w-3 h-3 text-white" /> : <Phone className="w-3 h-3 text-white" />}
            </div>
          </div>
          <div>
            <p className="font-semibold text-sm">{callerName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Incoming {isVideo ? "video" : "audio"} call...
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => declineCall(incomingCall.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            Decline
          </button>
          <button
            onClick={() => acceptCall(incomingCall.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
