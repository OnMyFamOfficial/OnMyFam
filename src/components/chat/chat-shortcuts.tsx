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
  Plus,
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

export function ChatShortcuts({ pinnedCount = 0, showPinnedOnly = false, onPinUp, onPinDown, onTogglePinFilter }: ChatShortcutsProps) {
  const navigate = useNavigate();
  const { currentFamily } = useFamily();
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState<EventItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [pinnedEvents, setPinnedEvents] = useState<EventItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omf-pinned-events");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("omf-pinned-events", JSON.stringify(pinnedEvents));
  }, [pinnedEvents]);

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
    if (showEventPicker) loadEvents();
  }, [showEventPicker]);

  function pinEvent(event: EventItem) {
    if (!pinnedEvents.find((e) => e.id === event.id)) {
      setPinnedEvents((prev) => [...prev, event]);
    }
    setShowEventPicker(false);
  }

  function unpinEvent(eventId: string) {
    setPinnedEvents((prev) => prev.filter((e) => e.id !== eventId));
  }

  const shortcuts = [
    { id: "events", label: "Events", icon: Calendar, color: "text-orange-400", action: () => setShowEventPicker(true) },
    { id: "feed", label: "Feed", icon: Home, color: "text-blue-400", action: () => navigate("/feed") },
    { id: "photos", label: "Photos", icon: Camera, color: "text-pink-400", action: () => navigate("/photos") },
    { id: "discussions", label: "Discussions", icon: MessageSquare, color: "text-purple-400", action: () => navigate("/discussions") },
    { id: "profile", label: "Profile", icon: User, color: "text-cyan-400", action: () => navigate("/profile") },
    { id: "settings", label: "Settings", icon: Settings, color: "text-gray-400", action: () => navigate("/settings") },
  ];

  return (
    <>
      {/* Event picker modal - list of events to pin */}
      {showEventPicker && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowEventPicker(false)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-sm">Pin Event to Sidebar</h3>
              </div>
              <button onClick={() => setShowEventPicker(false)} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loadingEvents ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">Loading...</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No upcoming events</p>
              ) : (
                events.map((event) => {
                  const alreadyPinned = pinnedEvents.some((e) => e.id === event.id);
                  return (
                    <button
                      key={event.id}
                      onClick={() => !alreadyPinned && pinEvent(event)}
                      disabled={alreadyPinned}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        alreadyPinned ? "opacity-50" : "hover:bg-[var(--accent)] cursor-pointer"
                      )}
                    >
                      <Calendar className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {event.is_all_day
                            ? format(new Date(event.starts_at), "MMM d, yyyy")
                            : format(new Date(event.starts_at), "MMM d 'at' h:mm a")}
                        </p>
                      </div>
                      {alreadyPinned ? (
                        <span className="text-[10px] text-gold-500">Pinned</span>
                      ) : (
                        <Plus className="w-4 h-4 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Event detail modal */}
      {showEventDetail && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowEventDetail(null)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {showEventDetail.cover_url ? (
              <img src={showEventDetail.cover_url} alt="" className="w-full h-36 object-cover" />
            ) : (
              <div className="w-full h-24 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-gold-500/30" />
              </div>
            )}
            <div className="p-5">
              <span className="text-[10px] font-medium uppercase text-gold-500 px-1.5 py-0.5 bg-gold-500/10 rounded-full">
                {showEventDetail.category.replace(/_/g, " ")}
              </span>
              <h3 className="mt-2 text-lg font-bold">{showEventDetail.title}</h3>
              <div className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                <p className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {showEventDetail.is_all_day
                    ? format(new Date(showEventDetail.starts_at), "EEEE, MMMM d, yyyy") + " (All Day)"
                    : format(new Date(showEventDetail.starts_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </p>
                {showEventDetail.location && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {showEventDetail.location}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { navigate(`/events/${showEventDetail.id}`); setShowEventDetail(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500 text-sm font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Event
                </button>
                <button
                  onClick={() => { unpinEvent(showEventDetail.id); setShowEventDetail(null); }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  Unpin
                </button>
                <button
                  onClick={() => setShowEventDetail(null)}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
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

        {/* Pinned event mini cards */}
        {pinnedEvents.length > 0 && (
          <div className="w-full px-2 pb-2 mb-1 border-b border-[var(--border)] space-y-1">
            {pinnedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => setShowEventDetail(event)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                title={event.title}
              >
                <Calendar className="w-3 h-3 text-orange-400 flex-shrink-0" />
                <span className="text-[10px] truncate flex-1">{event.title}</span>
              </button>
            ))}
          </div>
        )}

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
