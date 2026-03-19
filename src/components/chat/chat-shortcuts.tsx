import { useState, useEffect } from "react";
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
  X,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useFamily } from "@/lib/hooks/use-family";
import { format } from "date-fns";

interface ChatShortcutsProps {
  pinnedCount?: number;
  showPinnedOnly?: boolean;
  onPinUp?: () => void;
  onPinDown?: () => void;
  onTogglePinFilter?: () => void;
  onPinEvent?: (eventId: string, title: string) => void;
}

interface EventItem {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  is_all_day: boolean;
  location: string | null;
  cover_url: string | null;
}

export function ChatShortcuts({ pinnedCount = 0, showPinnedOnly = false, onPinUp, onPinDown, onTogglePinFilter, onPinEvent }: ChatShortcutsProps) {
  const navigate = useNavigate();
  const { currentFamily } = useFamily();
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  async function loadEvents() {
    if (!currentFamily) return;
    setLoadingEvents(true);
    const { data } = await supabase
      .from("events")
      .select("id, title, category, starts_at, is_all_day, location, cover_url")
      .eq("family_id", currentFamily.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(20);
    setEvents((data || []) as EventItem[]);
    setLoadingEvents(false);
  }

  useEffect(() => {
    if (showEventsModal) loadEvents();
  }, [showEventsModal]);

  const shortcuts = [
    { id: "events", label: "Events", icon: Calendar, color: "text-orange-400", action: () => setShowEventsModal(true) },
    { id: "feed", label: "Feed", icon: Home, color: "text-blue-400", action: () => navigate("/feed") },
    { id: "photos", label: "Photos", icon: Camera, color: "text-pink-400", action: () => navigate("/photos") },
    { id: "discussions", label: "Discussions", icon: MessageSquare, color: "text-purple-400", action: () => navigate("/discussions") },
    { id: "profile", label: "Profile", icon: User, color: "text-cyan-400", action: () => navigate("/profile") },
    { id: "settings", label: "Settings", icon: Settings, color: "text-gray-400", action: () => navigate("/settings") },
  ];

  return (
    <>
      {/* Events modal */}
      {showEventsModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowEventsModal(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-sm">Pin Event to Chat</h3>
              </div>
              <button
                onClick={() => setShowEventsModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Events list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loadingEvents ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No upcoming events</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
                    {event.cover_url ? (
                      <img src={event.cover_url} alt="" className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-16 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-gold-500/30" />
                      </div>
                    )}
                    <div className="p-3">
                      <span className="text-[10px] font-medium uppercase text-gold-500 px-1.5 py-0.5 bg-gold-500/10 rounded-full">
                        {event.category.replace(/_/g, " ")}
                      </span>
                      <h4 className="mt-1 font-semibold text-sm">{event.title}</h4>
                      <div className="mt-1 space-y-0.5 text-xs text-[var(--muted-foreground)]">
                        <p className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {event.is_all_day
                            ? format(new Date(event.starts_at), "MMM d, yyyy") + " (All Day)"
                            : format(new Date(event.starts_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {event.location && (
                          <p className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            onPinEvent?.(event.id, event.title);
                            setShowEventsModal(false);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          style={{ backgroundColor: "#393a4e" }}
                        >
                          <Pin className="w-3 h-3 rotate-45" />
                          Pin to Chat
                        </button>
                        <button
                          onClick={() => {
                            setShowEventsModal(false);
                            navigate(`/events/${event.id}`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gold-500 text-xs font-medium transition-colors cursor-pointer hover:bg-gold-600"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Event
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

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
            key={item.id}
            onClick={item.action}
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
    </>
  );
}
