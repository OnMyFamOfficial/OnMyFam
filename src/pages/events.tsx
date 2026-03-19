import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Users, Plus } from "lucide-react";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import type { FamilyEvent, Profile } from "@/lib/types";

type FullEvent = FamilyEvent & { creator: Profile };

export default function EventsPage() {
  const navigate = useNavigate();
  const { currentFamily } = useFamily();
  const [events, setEvents] = useState<FullEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="max-w-4xl mx-auto text-center py-16">
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Create or join a family first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
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
