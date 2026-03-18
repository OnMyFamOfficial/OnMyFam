import { MicOff } from "lucide-react";

interface ParticipantTileProps {
  name: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isSelf?: boolean;
  videoStream?: MediaStream | null;
}

export function ParticipantTile({ name, avatarUrl, isMuted, isSelf, videoStream }: ParticipantTileProps) {
  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
      {videoStream ? (
        <video
          ref={(el) => {
            if (el && videoStream) {
              el.srcObject = videoStream;
            }
          }}
          autoPlay
          playsInline
          muted={isSelf}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-md bg-gold-500/20 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full rounded-md object-cover" />
            ) : (
              <span className="text-2xl font-bold text-gold-500">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="text-white text-sm font-medium">{name}</span>
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-lg px-2 py-1">
        <span className="text-white text-xs">{isSelf ? "You" : name}</span>
        {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
      </div>
    </div>
  );
}
