import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Calendar, MessageCircle, Camera } from "lucide-react";
import { useChat } from "@/components/chat/chat-provider";
import { useMobileMenu } from "./mobile-menu-context";
import { cn } from "@/lib/utils";

const items = [
  { path: "/feed", label: "Feed", icon: Home },
  { path: "/family", label: "Family", icon: Users },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/events", label: "Events", icon: Calendar },
  { path: "/photos", label: "Photos", icon: Camera },
];

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useChat();
  const { menuItems } = useMobileMenu();

  // When a page menu is active, show those items instead
  if (menuItems && menuItems.length > 0) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[var(--border)]">
        <div className="flex items-center justify-around px-1 py-2">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1",
                item.active
                  ? "text-gold-500"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium truncate">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[var(--border)] flex items-center justify-around px-1 py-2">
      {items.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0",
              isActive
                ? "text-gold-500"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <span className="relative">
              <item.icon className="w-5 h-5" />
              {item.path === "/messages" && totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium truncate">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
