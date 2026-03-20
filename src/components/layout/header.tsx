import { useLocation } from "react-router-dom";
import { Bell, Menu, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface HeaderProps {
  onMenuClick: () => void;
  onRightMenuClick?: () => void;
}

const PAGE_INFO: Record<string, { title: string; subtitle: string }> = {
  "/feed": { title: "Feed", subtitle: "What's happening with the family" },
  "/family": { title: "Family", subtitle: "Your family circle" },
  "/events": { title: "Events", subtitle: "Family gatherings and celebrations" },
  "/events/create": { title: "Create Event", subtitle: "Plan a family gathering" },
  "/photos": { title: "Photos", subtitle: "Shared family memories" },
  "/discussions": { title: "Discussions", subtitle: "Family conversations and topics" },
  "/messages": { title: "Messages", subtitle: "Chat with your family" },
  "/profile": { title: "Profile", subtitle: "Your profile" },
  "/settings": { title: "Settings", subtitle: "App preferences" },
  "/admin": { title: "God Mode", subtitle: "Admin dashboard" },
};

export function Header({ onMenuClick, onRightMenuClick }: HeaderProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const basePath = "/" + (location.pathname.split("/")[1] || "feed");
  const isMessages = basePath === "/messages";
  const pageInfo = PAGE_INFO[location.pathname] || PAGE_INFO[basePath] || { title: "On My Fam", subtitle: "Where Family Stays Connected" };

  // Don't show the default header on messages page (it has its own)
  if (isMessages) return null;

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--header-background)] border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-6">
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">{pageInfo.title}</h1>
          <p className="text-[10px] text-[var(--muted-foreground)] leading-tight">{pageInfo.subtitle}</p>
        </div>
      </div>

      {/* Right: notifications + avatar + right sidebar toggle */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-[var(--accent)] transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full" />
        </button>

        <div className="w-8 h-8 rounded-md bg-gold-500/20 border border-gold-500/30 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-gold-500">
              {profile?.display_name?.charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>

        {onRightMenuClick && (
          <button
            onClick={onRightMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            <Users className="w-5 h-5 text-gold-500" />
          </button>
        )}
      </div>
    </header>
  );
}
