import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, Plus, Filter, X } from "lucide-react";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { format } from "date-fns";
import type { FamilyEvent, Profile } from "@/lib/types";

type FullEvent = FamilyEvent & { creator: Profile };

export default function EventsPage() {
  const navigate = useNavigate();
  const { currentFamily } = useFamily();
  const [events, setEvents] = useState<FullEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer ${
            showFilters || categoryFilter !== "all" || dateFrom || dateTo
              ? "border-gold-500 bg-gold-500/10 text-gold-500"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {(categoryFilter !== "all" || dateFrom || dateTo) && (
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
          )}
        </button>

        {showFilters && (
          <>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                title="From date"
              />
              <span className="text-xs text-[var(--muted-foreground)]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                title="To date"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
            >
              <option value="all">All Types</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>

            {(categoryFilter !== "all" || dateFrom || dateTo) && (
              <button
                onClick={() => { setCategoryFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </>
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
            if (dateFrom && new Date(event.starts_at) < new Date(dateFrom)) return false;
            if (dateTo && new Date(event.starts_at) > new Date(dateTo + "T23:59:59")) return false;
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
