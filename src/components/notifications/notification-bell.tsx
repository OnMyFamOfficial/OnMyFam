import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCheck, Trash2, Heart, MessageCircle, ThumbsUp, Users } from "lucide-react";
import { useNotifications } from "./notification-provider";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICONS: Record<string, any> = {
  relation_request: Heart,
  comment: MessageCircle,
  reaction: ThumbsUp,
  family: Users,
};

const TYPE_COLORS: Record<string, string> = {
  relation_request: "text-pink-400",
  comment: "text-sky-400",
  reaction: "text-gold-500",
  family: "text-green-400",
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNotificationClick(n: any) {
    markAsRead(n.id);
    // Navigate based on type
    if (n.type === "relation_request") {
      navigate("/family");
    } else if (n.type === "comment" && n.data?.post_id) {
      navigate("/feed");
    } else if (n.type === "reaction" && n.data?.post_id) {
      navigate("/feed");
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-[100] flex flex-col overflow-hidden" style={{ maxHeight: "70vh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[10px] text-gold-500 hover:text-gold-400 cursor-pointer flex items-center gap-1" title="Mark all as read">
                  <CheckCheck className="w-3.5 h-3.5" /> Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer" title="Clear all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const color = TYPE_COLORS[n.type] || "text-[var(--muted-foreground)]";
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--accent)] transition-colors cursor-pointer border-b border-[var(--border)] last:border-0 ${
                      !n.read ? "bg-gold-500/5" : ""
                    }`}
                  >
                    <div className={`mt-0.5 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-gold-500 flex-shrink-0 mt-2" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
