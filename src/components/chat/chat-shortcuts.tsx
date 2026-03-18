import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Home,
  Camera,
  MessageSquare,
  User,
  Settings,
  Pin,
} from "lucide-react";

const shortcuts = [
  { path: "/events", label: "Events", icon: Calendar, color: "text-orange-400" },
  { path: "/feed", label: "Feed", icon: Home, color: "text-blue-400" },
  { path: "/photos", label: "Photos", icon: Camera, color: "text-pink-400" },
  { path: "/discussions", label: "Discussions", icon: MessageSquare, color: "text-purple-400" },
  { path: "/profile", label: "Profile", icon: User, color: "text-cyan-400" },
  { path: "/settings", label: "Settings", icon: Settings, color: "text-gray-400" },
];

export function ChatShortcuts() {
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex flex-col items-center w-[200px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--card)] chat-gradient-down py-2 gap-1">
      {/* Pin icon header */}
      <div className="p-1.5 mb-1">
        <Pin className="w-3.5 h-3.5 text-gold-500 rotate-45" />
      </div>

      {shortcuts.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer group relative"
          title={item.label}
        >
          <item.icon className={`w-4 h-4 ${item.color}`} />
          {/* Tooltip */}
          <div className="absolute right-full mr-2 px-2 py-1 bg-[var(--card)] text-[var(--foreground)] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-[var(--border)]">
            {item.label}
          </div>
        </button>
      ))}
    </div>
  );
}
