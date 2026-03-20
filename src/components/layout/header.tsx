import { useLocation } from "react-router-dom";
import { Menu, Users, Filter } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface HeaderProps {
  onMenuClick: () => void;
  onRightMenuClick?: () => void;
  onFilterClick?: () => void;
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

export function Header({ onMenuClick, onRightMenuClick, onFilterClick }: HeaderProps) {
  const location = useLocation();
  const basePath = "/" + (location.pathname.split("/")[1] || "feed");
  const isMessages = basePath === "/messages";
  const isFeed = basePath === "/feed";
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

      {/* Right: filter + notifications + right sidebar toggle */}
      <div className="flex items-center gap-2">
        {isFeed && onFilterClick && (
          <button
            onClick={onFilterClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            <Filter className="w-5 h-5 text-gold-500" />
          </button>
        )}

        <NotificationBell />

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
