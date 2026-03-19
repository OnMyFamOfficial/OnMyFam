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

type FullEvent = FamilyEvent & { creator: Profile };

export default function EventsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily } = useFamily();
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
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "mine">("upcoming");
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

    const [profilesRes, rsvpsRes] = await Promise.all([
      supabase.from("profiles").select("*").in("id", creatorIds),
      supabase.from("event_rsvps").select("*").in("event_id", eventIds),
    ]);

    const profileMap = new Map<string, any>();
    for (const p of profilesRes.data || []) profileMap.set(p.id, p);

    const rsvpsByEvent = new Map<string, any[]>();
    for (const r of rsvpsRes.data || []) {
      const list = rsvpsByEvent.get(r.event_id) || [];
      list.push(r);
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
          { id: "past" as const, label: "Past Events" },
          { id: "mine" as const, label: "My Events" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[var(--accent)] text-[var(--foreground)] border-b-2 border-gold-500"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => navigate("/events/create")}
          className="px-3 py-1.5 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Event
        </button>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        {/* Date Range button */}
        <div className="relative" ref={dateModalRef}>
          <button
            onClick={() => { setShowDateModal(!showDateModal); setShowTypeModal(false); }}
            className={`w-[150px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
              dateFrom
                ? "border-gold-500 bg-gold-500/10 text-gold-500"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {dateFrom
              ? fromOnly
                ? format(dateFrom, "MMM d, yyyy")
                : dateTo
                  ? `${format(dateFrom, "MMM d")} - ${format(dateTo, "MMM d")}`
                  : format(dateFrom, "MMM d, yyyy")
              : "Date Range"}
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
            className={`w-[150px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
              categoryFilter !== "all"
                ? "border-gold-500 bg-gold-500/10 text-gold-500"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            {categoryFilter !== "all"
              ? categoryFilter.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "Event Type"}
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
            className={`w-[150px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
              statusFilter !== "all"
                ? "border-gold-500 bg-gold-500/10 text-gold-500"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {statusFilter !== "all"
              ? statusFilter === "going" ? "Going" : statusFilter === "maybe" ? "Interested" : "Not Going"
              : "Status"}
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
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
          <div className="text-5xl mb-4">&#x1F389;</div>
          <h2 className="text-xl font-semibold">No upcoming events</h2>
          <p className="text-[var(--muted-foreground)] mt-2">
            Plan a family gathering and bring everyone together!
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.filter((event) => {
            const now = new Date();
            const eventDate = new Date(event.starts_at);
            // Tab filter - compare by end of day for all-day events
            const compareDate = event.is_all_day
              ? new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59)
              : eventDate;
            if (activeTab === "upcoming" && compareDate < now) return false;
            if (activeTab === "past" && compareDate >= now) return false;
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
              if (eventDate < from) return false;
            }
            if (dateTo && !fromOnly) {
              const to = new Date(dateTo);
              to.setHours(23, 59, 59, 999);
              if (eventDate > to) return false;
            }
            return true;
          }).map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/events/${event.id}${activeTab === "mine" ? "?edit=true" : ""}`)}
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden cursor-pointer hover:border-gold-500/30 transition-colors relative"
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
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-gold-500/50" />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-gold-500 font-medium uppercase">
                  <span className="px-2 py-0.5 bg-gold-500/10 rounded-full">
                    {event.category}
                  </span>
                  <span className="px-2 py-0.5 bg-[var(--accent)] rounded-full text-[var(--muted-foreground)]">
                    {event.status}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-lg">{event.title}</h3>
                <div className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {event.is_all_day
                      ? format(new Date(event.starts_at), "MMM d, yyyy") + " (All Day)"
                      : format(new Date(event.starts_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {event.going_count} going
                    {event.maybe_count > 0 &&
                      ` \u00B7 ${event.maybe_count} maybe`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
