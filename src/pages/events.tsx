import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, Plus, Tag, Pencil, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { format } from "date-fns";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import type { FamilyEvent, Profile } from "@/lib/types";
import { useTour } from "@/components/shared/tour-provider";

type FullEvent = FamilyEvent & { creator: Profile };

export default function EventsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const { triggerPageTour } = useTour();
  useEffect(() => { triggerPageTour("events"); }, [triggerPageTour]);
  const [events, setEvents] = useState<FullEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [fromOnly, setFromOnly] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"upcoming" | "ongoing" | "past" | "mine">("upcoming");
  const statusModalRef = useRef<HTMLDivElement>(null);
  const dateModalRef = useRef<HTMLDivElement>(null);
  const typeModalRef = useRef<HTMLDivElement>(null);

  // Close modals on outside click
  useEffect(() => {
    if (!showDateModal && !showTypeModal && !showStatusModal) return;
    function handleClick(e: MouseEvent) {
      if (showDateModal && dateModalRef.current && !dateModalRef.current.contains(e.target as Node)) setShowDateModal(false);
      if (showTypeModal && typeModalRef.current && !typeModalRef.current.contains(e.target as Node)) setShowTypeModal(false);
      if (showStatusModal && statusModalRef.current && !statusModalRef.current.contains(e.target as Node)) setShowStatusModal(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDateModal, showTypeModal, showStatusModal]);

  useEffect(() => {
    if (currentFamily) loadEvents();
  }, [currentFamily]);

  async function loadEvents() {
    if (!currentFamily) return;
    setLoading(true);

    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("family_id", currentFamily.id)
      .order("starts_at", { ascending: true });

    if (!data || data.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const eventIds = data.map((e) => e.id);
    const creatorIds = [...new Set(data.map((e) => e.created_by))];

    const rsvpsRes = await supabase.from("event_rsvps").select("*").in("event_id", eventIds);

    // Collect all user IDs (creators + rsvp users) and fetch profiles
    const allUserIds = new Set(creatorIds);
    for (const r of rsvpsRes.data || []) allUserIds.add(r.user_id);
    const profilesRes = await supabase.from("profiles").select("*").in("id", [...allUserIds]);

    const profileMap = new Map<string, any>();
    for (const p of profilesRes.data || []) profileMap.set(p.id, p);

    const rsvpsByEvent = new Map<string, any[]>();
    for (const r of rsvpsRes.data || []) {
      const list = rsvpsByEvent.get(r.event_id) || [];
      list.push({ ...r, user: profileMap.get(r.user_id) || { display_name: "Unknown" } });
      rsvpsByEvent.set(r.event_id, list);
    }

    setEvents(data.map((e) => ({
      ...e,
      creator: profileMap.get(e.created_by) || { display_name: "Unknown" },
      rsvps: rsvpsByEvent.get(e.id) || [],
    })) as FullEvent[]);
    setLoading(false);
  }

  if (!currentFamily) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--muted-foreground)]">
          Create or join a family first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar + Create button */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-px">
        {([
          { id: "upcoming" as const, label: "Upcoming" },
          { id: "ongoing" as const, label: "Ongoing" },
          { id: "past" as const, label: "Past Events" },
          { id: "mine" as const, label: "My Events" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "text-gold-500 border-b-2 border-gold-500"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {/* Date Range button */}
          <div className="relative" ref={dateModalRef}>
            <button
              onClick={() => { setShowDateModal(!showDateModal); setShowTypeModal(false); }}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                dateFrom
                  ? "border-gold-500 bg-gold-500/10 text-gold-500"
                  : "border-[var(--border)] bg-white/5 dark:bg-white/5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{dateFrom
                ? fromOnly
                  ? format(dateFrom, "MMM d, yyyy")
                  : dateTo
                    ? `${format(dateFrom, "MMM d")} - ${format(dateTo, "MMM d")}`
                    : format(dateFrom, "MMM d, yyyy")
                : "Date Range"}</span>
            </button>

            {showDateModal && (
              <>
                <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowDateModal(false)} />
                <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                  <h3 className="font-semibold text-sm mb-3">Date Range</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block font-medium">From</label>
                      <CalendarPicker
                        selected={dateFrom}
                        onSelect={(d) => {
                          setDateFrom(d);
                          if (fromOnly) setShowDateModal(false);
                        }}
                      />
                    </div>
                    {!fromOnly && (
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] mb-1 block font-medium">To</label>
                        <CalendarPicker
                          selected={dateTo}
                          onSelect={(d) => { setDateTo(d); setShowDateModal(false); }}
                        />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fromOnly}
                      onChange={(e) => { setFromOnly(e.target.checked); if (e.target.checked) setDateTo(null); }}
                      className="rounded accent-gold-500"
                    />
                    From date only (no end date)
                  </label>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                    <button
                      onClick={() => { setDateFrom(null); setDateTo(null); setFromOnly(false); }}
                      className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Clear dates
                    </button>
                    <button
                      onClick={() => setShowDateModal(false)}
                      className="px-3 py-1 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Event Type button */}
          <div className="relative" ref={typeModalRef}>
            <button
              onClick={() => { setShowTypeModal(!showTypeModal); setShowDateModal(false); }}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                categoryFilter !== "all"
                  ? "border-gold-500 bg-gold-500/10 text-gold-500"
                  : "border-[var(--border)] bg-white/5 dark:bg-white/5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{categoryFilter !== "all"
                ? categoryFilter.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Type"}</span>
            </button>

            {showTypeModal && (
              <>
                <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowTypeModal(false)} />
                <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-4 px-2 min-w-[260px]">
                  <h3 className="font-semibold text-sm px-4 pb-2 border-b border-[var(--border)] mb-1">Event Type</h3>
                  <button
                    onClick={() => { setCategoryFilter("all"); setShowTypeModal(false); }}
                    className={`w-full flex items-center px-4 py-2 text-sm text-left transition-colors cursor-pointer ${
                      categoryFilter === "all" ? "bg-gold-500/10 text-gold-500 font-medium" : "hover:bg-[var(--accent)]"
                    }`}
                  >
                    All Types
                  </button>
                  {EVENT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setShowTypeModal(false); }}
                      className={`w-full flex items-center px-4 py-2 text-sm text-left transition-colors cursor-pointer ${
                        categoryFilter === cat ? "bg-gold-500/10 text-gold-500 font-medium" : "hover:bg-[var(--accent)]"
                      }`}
                    >
                      {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Status filter button */}
          <div className="relative" ref={statusModalRef}>
            <button
              onClick={() => { setShowStatusModal(!showStatusModal); setShowDateModal(false); setShowTypeModal(false); }}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                statusFilter !== "all"
                  ? "border-gold-500 bg-gold-500/10 text-gold-500"
                  : "border-[var(--border)] bg-white/5 dark:bg-white/5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{statusFilter !== "all"
                ? statusFilter === "going" ? "Going" : statusFilter === "maybe" ? "Interested" : "Not Going"
                : "Status"}</span>
            </button>

            {showStatusModal && (
              <>
                <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowStatusModal(false)} />
                <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-4 px-2 min-w-[260px]">
                  <h3 className="font-semibold text-sm px-4 pb-2 border-b border-[var(--border)] mb-1">RSVP Status</h3>
                  {[
                    { value: "all", label: "All Statuses" },
                    { value: "going", label: "Going" },
                    { value: "maybe", label: "Interested" },
                    { value: "cant_make_it", label: "Not Going" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setShowStatusModal(false); }}
                      className={`w-full flex items-center px-4 py-2 text-sm text-left transition-colors cursor-pointer ${
                        statusFilter === opt.value ? "bg-gold-500/10 text-gold-500 font-medium" : "hover:bg-[var(--accent)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Clear all filters */}
          {(dateFrom || categoryFilter !== "all" || statusFilter !== "all") && (
            <button
              onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setDateFrom(null); setDateTo(null); setFromOnly(false); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => navigate("/events/create")}
            className="px-3 py-1.5 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create Event</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
          <div className="text-5xl mb-4">&#x1F389;</div>
          <h2 className="text-xl font-semibold">No {activeTab === "mine" ? "" : activeTab + " "}events</h2>
          <p className="text-[var(--muted-foreground)] mt-2">
            Plan a family gathering and bring everyone together!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.filter((event) => {
            const now = new Date();
            const start = new Date(event.starts_at);
            const end = event.ends_at ? new Date(event.ends_at) : null;
            // For all-day events, extend start to end of day
            const effectiveStart = event.is_all_day
              ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
              : start;
            const effectiveEnd = end
              ? (event.is_all_day ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) : end)
              : (event.is_all_day ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59) : start);
            const isOngoing = effectiveStart <= now && effectiveEnd >= now;
            const isPast = effectiveEnd < now;
            const isUpcoming = effectiveStart > now;
            // Tab filter
            if (activeTab === "upcoming" && !isUpcoming) return false;
            if (activeTab === "ongoing" && !isOngoing) return false;
            if (activeTab === "past" && !isPast) return false;
            if (activeTab === "mine" && event.created_by !== user?.id) return false;
            // Category filter
            if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
            // Status filter
            if (statusFilter !== "all") {
              const myRsvp = event.rsvps?.find((r: any) => r.user_id === user?.id);
              if (!myRsvp && statusFilter !== "cant_make_it") return false;
              if (myRsvp && myRsvp.status !== statusFilter) return false;
            }
            // Date range filter
            if (dateFrom) {
              const from = new Date(dateFrom);
              from.setHours(0, 0, 0, 0);
              if (start < from) return false;
            }
            if (dateTo && !fromOnly) {
              const to = new Date(dateTo);
              to.setHours(23, 59, 59, 999);
              if (start > to) return false;
            }
            return true;
          }).map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/events/${event.id}${activeTab === "mine" ? "?edit=true" : ""}`)}
              className="rounded-lg border border-[var(--border)] overflow-hidden cursor-pointer hover:border-gold-500/30 transition-colors relative shadow-md dark:shadow-black/30 bg-[var(--card)]"
            >
              {activeTab === "mine" && (
                <div className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-gold-500 text-white">
                  <Pencil className="w-3.5 h-3.5" />
                </div>
              )}
              {event.cover_url ? (
                <img
                  src={event.cover_url}
                  alt=""
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-gold-500/50" />
                </div>
              )}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2 text-xs text-gold-500 font-medium uppercase">
                  <span className="px-2 py-0.5 bg-gold-500/10 rounded-full">
                    {event.category}
                  </span>
                  {(() => {
                    const now = new Date();
                    const start = new Date(event.starts_at);
                    const end = event.ends_at ? new Date(event.ends_at) : null;
                    const isOngoing = start <= now && end && end >= now;
                    const isPast = end ? end < now : start < now;
                    const status = event.status === "cancelled" ? "cancelled" : isOngoing ? "ongoing" : isPast ? "past" : "upcoming";
                    const styles = {
                      upcoming: "bg-sky-500/15 text-sky-400",
                      ongoing: "bg-green-500/15 text-green-400",
                      past: "bg-[var(--accent)] text-[var(--muted-foreground)]",
                      cancelled: "bg-red-500/15 text-red-400",
                    };
                    return (
                      <span className={`px-2 py-0.5 rounded-full ${styles[status]}`}>
                        {status}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="mt-2 font-semibold text-lg">{event.title}</h3>
                <div className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {event.is_all_day
                      ? format(new Date(event.starts_at), "MMM d, yyyy")
                        + (event.ends_at ? ` - ${format(new Date(event.ends_at), "MMM d, yyyy")}` : "")
                        + " (All Day)"
                      : format(new Date(event.starts_at), "MMM d, yyyy 'at' h:mm a")
                        + (event.ends_at
                          ? ` - ${format(new Date(event.ends_at), "MMM d, yyyy 'at' h:mm a")}`
                          : "")}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {(() => {
                      const goingRsvps = (event.rsvps || []).filter((r: any) => r.status === "going");
                      const totalWithGuests = goingRsvps.reduce((sum: number, r: any) => sum + 1 + (Number(r.guest_count) || 0), 0);
                      const guestCount = totalWithGuests - goingRsvps.length;
                      const shown = goingRsvps.slice(0, 5);
                      const extra = goingRsvps.length - 5;
                      return (
                        <>
                          <div className="flex -space-x-2">
                            {shown.map((r: any, i: number) => {
                              const guests = Number(r.guest_count) || 0;
                              return (
                              <div key={r.id} className="relative" style={{ zIndex: 5 - i }}>
                                <div className="w-9 h-9 rounded-full border-2 border-[var(--card)] bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                                  {r.user?.avatar_url ? (
                                    <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                                  )}
                                </div>
                                {guests > 0 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold-500 text-white text-[9px] font-bold flex items-center justify-center">+{guests}</span>
                                )}
                              </div>
                              );
                            })}
                            {extra > 0 && (
                              <div className="w-9 h-9 rounded-full border-2 border-[var(--card)] bg-[var(--accent)] flex items-center justify-center flex-shrink-0 z-0">
                                <span className="text-[10px] font-medium text-[var(--muted-foreground)]">+{extra}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {totalWithGuests} going{guestCount > 0 ? ` (${guestCount} guest${guestCount !== 1 ? 's' : ''})` : ""}{event.maybe_count > 0 ? ` \u00B7 ${event.maybe_count} maybe` : ""}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
