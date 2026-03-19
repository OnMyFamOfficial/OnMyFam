import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Home,
  Camera,
  MessageSquare,
  User,
  Settings,
  Pin,
  ChevronUp,
  ChevronDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatShortcutsProps {
  pinnedCount?: number;
  showPinnedOnly?: boolean;
  onPinUp?: () => void;
  onPinDown?: () => void;
  onTogglePinFilter?: () => void;
}

const shortcuts = [
  { path: "/events", label: "Events", icon: Calendar, color: "text-orange-400" },
  { path: "/feed", label: "Feed", icon: Home, color: "text-blue-400" },
  { path: "/photos", label: "Photos", icon: Camera, color: "text-pink-400" },
  { path: "/discussions", label: "Discussions", icon: MessageSquare, color: "text-purple-400" },
  { path: "/profile", label: "Profile", icon: User, color: "text-cyan-400" },
  { path: "/settings", label: "Settings", icon: Settings, color: "text-gray-400" },
];

export function ChatShortcuts({ pinnedCount = 0, showPinnedOnly = false, onPinUp, onPinDown, onTogglePinFilter }: ChatShortcutsProps) {
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex flex-col items-center w-[200px] flex-shrink-0 border-l border-[var(--border)] bg-transparent py-2 gap-1">
      {/* Pin section */}
      <div className="flex flex-col items-center gap-0.5 mb-2 pb-2 border-b border-[var(--border)] w-full px-2">
        <div className="p-1">
          <Pin className="w-4 h-4 text-gold-500 rotate-45" />
        </div>

        {pinnedCount > 0 && (
          <>
            <button
              onClick={onPinUp}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer text-sm"
              title="Previous pin"
            >
              <ChevronUp className="w-4 h-4 flex-shrink-0" />
              <span>Prev Pin</span>
            </button>
            <button
              onClick={onPinDown}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer text-sm"
              title="Next pin"
            >
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
              <span>Next Pin</span>
            </button>
            <button
              onClick={onTogglePinFilter}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm",
                showPinnedOnly
                  ? "bg-gold-500/20 text-gold-500"
                  : "hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
              title={showPinnedOnly ? "Show all messages" : "Show pinned only"}
            >
              <Filter className="w-4 h-4 flex-shrink-0" />
              <span>{showPinnedOnly ? "Show All" : "Pinned Only"}</span>
            </button>
          </>
        )}
      </div>

      {/* Navigation shortcuts */}
      {shortcuts.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer group relative"
          title={item.label}
        >
          <item.icon className={`w-4 h-4 ${item.color}`} />
          <div className="absolute right-full mr-2 px-2 py-1 bg-[var(--card)] text-[var(--foreground)] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-[var(--border)]">
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}
