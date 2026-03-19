import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, Plus, Tag, X } from "lucide-react";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { format } from "date-fns";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import type { FamilyEvent, Profile } from "@/lib/types";

type FullEvent = FamilyEvent & { creator: Profile };

export default function EventsPage() {
  const navigate = useNavigate();
  const { currentFamily } = useFamily();
  const [events, setEvents] = useState<FullEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [fromOnly, setFromOnly] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const dateModalRef = useRef<HTMLDivElement>(null);
  const typeModalRef = useRef<HTMLDivElement>(null);

  // Close modals on outside click
  useEffect(() => {
    if (!showDateModal && !showTypeModal) return;
    function handleClick(e: MouseEvent) {
      if (showDateModal && dateModalRef.current && !dateModalRef.current.contains(e.target as Node)) setShowDateModal(false);
      if (showTypeModal && typeModalRef.current && !typeModalRef.current.contains(e.target as Node)) setShowTypeModal(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDateModal, showTypeModal]);

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

    const creatorIds = [...new Set(data.map((e) => e.created_by))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", creatorIds);
    const profileMap = new Map<string, any>();
    for (const p of profiles || []) profileMap.set(p.id, p);

    setEvents(data.map((e) => ({ ...e, creator: profileMap.get(e.created_by) || { display_name: "Unknown" } })) as FullEvent[]);
    setLoading(false);
  }

  if (!currentFamily) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Create or join a family first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-[var(--muted-foreground)]">
            Family gatherings and celebrations
          </p>
        </div>
        <button
          onClick={() => navigate("/events/create")}
          className="px-4 py-2 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        {/* Date Range button */}
        <div className="relative" ref={dateModalRef}>
          <button
            onClick={() => { setShowDateModal(!showDateModal); setShowTypeModal(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
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
            <div className="absolute left-0 top-full mt-2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-4">
              <div className="flex gap-4">
                {/* From calendar */}
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

                {/* To calendar */}
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

              {/* From date only checkbox */}
              <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={fromOnly}
                  onChange={(e) => { setFromOnly(e.target.checked); if (e.target.checked) setDateTo(null); }}
                  className="rounded accent-gold-500"
                />
                From date only (no end date)
              </label>

              {/* Clear + Apply */}
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
          )}
        </div>

        {/* Event Type button */}
        <div className="relative" ref={typeModalRef}>
          <button
            onClick={() => { setShowTypeModal(!showTypeModal); setShowDateModal(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
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
            <div className="absolute left-0 top-full mt-2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-1 min-w-[180px]">
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
          )}
        </div>

        {/* Clear all filters */}
        {(dateFrom || categoryFilter !== "all") && (
          <button
            onClick={() => { setCategoryFilter("all"); setDateFrom(null); setDateTo(null); setFromOnly(false); }}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.filter((event) => {
            if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
            const eventDate = new Date(event.starts_at);
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
              onClick={() => navigate(`/events/${event.id}`)}
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden cursor-pointer hover:border-gold-500/30 transition-colors"
            >
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
              <div className="p-4">
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
                    {format(new Date(event.starts_at), "MMM d, yyyy 'at' h:mm a")}
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
