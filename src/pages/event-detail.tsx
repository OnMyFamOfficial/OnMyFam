import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Users, Send, Pencil, Save, X, Trash2, Navigation, UserCheck, ImagePlus, UserPlus, ExternalLink, Menu, Home, Info, MessageSquare, Star, Download, Luggage } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import { EventDetailsForm, parseDetails, detailsToJson, type EventDetails } from "@/components/shared/event-details-form";
import { InfoTip } from "@/components/shared/info-tip";
import { format, formatDistanceToNow } from "date-fns";
import { useTheme } from "@/components/shared/theme-provider";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { US_AIRPORTS } from "@/lib/airports";

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timers = [100, 300, 600, 1000, 2000].map((ms) =>
      setTimeout(() => map.invalidateSize(), ms)
    );
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function DeferredMap({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) setReady(true);
    };
    check();
    if (!ready) {
      const observer = new ResizeObserver(check);
      observer.observe(el);
      const timer = setTimeout(() => setReady(true), 500);
      return () => { observer.disconnect(); clearTimeout(timer); };
    }
  }, [ready]);
  return (
    <div ref={ref} style={style} className={className}>
      {ready ? children : null}
    </div>
  );
}
import type { FamilyEvent, EventRsvp, EventChatMessage, Profile } from "@/lib/types";

const goldIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const blueIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

type FullEvent = FamilyEvent & {
  creator: Profile;
  rsvps: (EventRsvp & { user: Profile })[];
  hosts?: Profile[];
};

function TimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  let hour = "";
  let minute = "";
  let period = "AM";
  if (value) {
    const [h, m] = value.split(":");
    const h24 = parseInt(h);
    period = h24 >= 12 ? "PM" : "AM";
    hour = String(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);
    minute = m;
  }
  function update(newHour: string, newMinute: string, newPeriod: string) {
    if (!newHour || !newMinute) { onChange(""); return; }
    let h24 = parseInt(newHour);
    if (newPeriod === "AM" && h24 === 12) h24 = 0;
    else if (newPeriod === "PM" && h24 !== 12) h24 += 12;
    onChange(`${String(h24).padStart(2, "0")}:${newMinute}`);
  }
  const sc = "rounded-lg border border-gold-500/40 bg-[var(--background)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 cursor-pointer appearance-none text-center";
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <span className="text-xs font-medium text-gold-500">Time</span>
      <div className="flex items-center gap-1.5 bg-[var(--accent)] rounded-xl px-3 py-2.5 border border-[var(--border)]">
        <select value={hour} onChange={(e) => update(e.target.value, minute || "00", period)} className={sc} style={{ width: "52px" }}>
          <option value="">--</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (<option key={h} value={String(h)}>{h}</option>))}
        </select>
        <span className="text-lg font-bold text-gold-500">:</span>
        <select value={minute} onChange={(e) => update(hour || "12", e.target.value, period)} className={sc} style={{ width: "52px" }}>
          <option value="">--</option>
          {["00", "15", "30", "45"].map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
        <select value={period} onChange={(e) => update(hour || "12", minute || "00", e.target.value)} className={`${sc} font-semibold`} style={{ width: "58px" }}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function dateToTimeString(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useFamily();
  const { theme } = useTheme();
  const [event, setEvent] = useState<FullEvent | null>(null);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [eventSection, setEventSection] = useState<string | null>(null);
  const [showEventPin, setShowEventPin] = useState(true);
  const [showLodgingPin, setShowLodgingPin] = useState(true);
  const [showAirportPins, setShowAirportPins] = useState(true);
  const [messages, setMessages] = useState<(EventChatMessage & { user: Profile })[]>([]);
  const [chatText, setChatText] = useState("");
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [editForm, setEditForm] = useState({ title: "", description: "", location: "", address: "", latitude: "", longitude: "", category: "" });
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editEndDate, setEditEndDate] = useState<Date | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editAllDay, setEditAllDay] = useState(false);
  const [editAllowGuests, setEditAllowGuests] = useState(false);
  const [editReportAccess, setEditReportAccess] = useState("creator_admin");
  const [editHosts, setEditHosts] = useState<string[]>([]);
  const [showEditHostPicker, setShowEditHostPicker] = useState(false);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const editCoverRef = useRef<HTMLInputElement>(null);
  const [editDetails, setEditDetails] = useState<EventDetails>(parseDetails(null));
  const [editSaving, setEditSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapCoords, setMapCoords] = useState<[number, number] | null>(null);

  // Use saved coordinates or geocode location, with fallback
  useEffect(() => {
    if (!event) return;

    // Use saved lat/lng if available
    if ((event as any).latitude && (event as any).longitude) {
      setMapCoords([(event as any).latitude, (event as any).longitude]);
      return;
    }

    const address = event.address;
    const location = event.location;
    if (!address && !location) { setMapCoords(null); return; }

    async function geocode() {
      // Try full address first
      if (address) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        if (data?.[0]) { setMapCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]); return; }

        // Fallback: strip street number/name, try city/state/zip
        const parts = address.split(",").slice(1).join(",").trim();
        if (parts) {
          const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parts)}&limit=1`);
          const data2 = await res2.json();
          if (data2?.[0]) { setMapCoords([parseFloat(data2[0].lat), parseFloat(data2[0].lon)]); return; }
        }
      }

      // Try location field
      if (location) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`);
        const data = await res.json();
        if (data?.[0]) { setMapCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]); return; }
      }

      setMapCoords(null);
    }
    geocode().catch(() => setMapCoords(null));
  }, [event?.address, event?.location]);

  useEffect(() => {
    if (id) {
      loadEvent();
      loadMessages();
      // Subscribe to realtime chat
      const channel = supabase
        .channel(`event-chat-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "event_chat_messages",
            filter: `event_id=eq.${id}`,
          },
          () => loadMessages()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  async function loadEvent() {
    if (!id) return;

    const { data: eventData, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !eventData) {
      console.error("Event load error:", error);
      setLoading(false);
      return;
    }

    // Fetch RSVPs
    const { data: rsvpData } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", id);

    // Collect all user IDs
    const userIds = new Set<string>();
    userIds.add(eventData.created_by);
    for (const r of rsvpData || []) userIds.add(r.user_id);
    for (const hid of eventData.hosted_by || []) userIds.add(hid);

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", [...userIds]);

    const profileMap = new Map<string, Profile>();
    for (const p of (profiles || []) as Profile[]) profileMap.set(p.id, p);

    setEvent({
      ...eventData,
      creator: profileMap.get(eventData.created_by) || { display_name: "Unknown" },
      rsvps: (rsvpData || []).map((r: EventRsvp) => ({
        ...r,
        user: profileMap.get(r.user_id) || { display_name: "Unknown" },
      })),
      hosts: (eventData.hosted_by || []).map((hid: string) => profileMap.get(hid)).filter(Boolean) as Profile[],
    } as FullEvent);
    setEditForm({
      title: eventData.title || "",
      description: eventData.description || "",
      location: eventData.location || "",
      address: eventData.address || "",
      latitude: eventData.latitude ? String(eventData.latitude) : "",
      longitude: eventData.longitude ? String(eventData.longitude) : "",
      category: eventData.category || "other",
    });
    setEditStartDate(new Date(eventData.starts_at));
    setEditEndDate(eventData.ends_at ? new Date(eventData.ends_at) : null);
    setEditStartTime(eventData.is_all_day ? "" : dateToTimeString(eventData.starts_at));
    setEditEndTime(eventData.ends_at && !eventData.is_all_day ? dateToTimeString(eventData.ends_at) : "");
    setEditAllDay(eventData.is_all_day);
    setEditAllowGuests((eventData as any).allow_guests || false);
    setEditReportAccess((eventData as any).report_access || "creator_admin");
    setEditHosts(eventData.hosted_by || []);
    setEditDetails(parseDetails(eventData.details));
    setEditCoverPreview(null);
    setEditCoverFile(null);
    setLoading(false);
  }

  async function handleEditSave() {
    if (!id || !editForm.title.trim() || !editStartDate) return;
    setEditSaving(true);

    // Upload new cover if changed
    let coverUrl = event?.cover_url || null;
    if (editCoverFile && user) {
      const ext = editCoverFile.name.split(".").pop();
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("events").upload(path, editCoverFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("events").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }
    }

    // Build dates
    const startDateStr = format(editStartDate, "yyyy-MM-dd");
    const startsAt = editAllDay || !editStartTime
      ? new Date(`${startDateStr}T12:00:00`).toISOString()
      : new Date(`${startDateStr}T${editStartTime}`).toISOString();

    let endsAt: string | null = null;
    if (editEndDate) {
      const endDateStr = format(editEndDate, "yyyy-MM-dd");
      endsAt = editAllDay || !editEndTime
        ? new Date(`${endDateStr}T12:00:00`).toISOString()
        : new Date(`${endDateStr}T${editEndTime}`).toISOString();
    }

    await supabase.from("events").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      location: editForm.location.trim() || null,
      address: editForm.address.trim() || null,
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
      category: editForm.category,
      cover_url: coverUrl,
      starts_at: startsAt,
      ends_at: endsAt,
      is_all_day: editAllDay,
      allow_guests: editAllowGuests,
      report_access: editReportAccess,
      hosted_by: editHosts,
      details: detailsToJson(editDetails),
    }).eq("id", id);
    await loadEvent();
    setEditing(false);
    setEditSaving(false);
  }

  async function loadMessages() {
    if (!id) return;
    const { data } = await supabase
      .from("event_chat_messages")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setMessages([]);
      return;
    }

    const userIds = [...new Set(data.map((m) => m.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
    const profileMap = new Map<string, Profile>();
    for (const p of (profiles || []) as Profile[]) profileMap.set(p.id, p);

    setMessages(
      data.map((m) => ({
        ...m,
        user: profileMap.get(m.user_id) || { display_name: "Unknown" },
      })) as (EventChatMessage & { user: Profile })[]
    );
  }

  const [guestInput, setGuestInput] = useState(0);

  async function handleRsvp(status: "going" | "maybe" | "cant_make_it") {
    if (!user || !id) return;

    const existing = event?.rsvps.find((r) => r.user_id === user.id);
    const guestCount = status === "going" ? guestInput : 0;
    if (existing) {
      await supabase
        .from("event_rsvps")
        .update({ status, guest_count: guestCount })
        .eq("id", existing.id);
    } else {
      await supabase.from("event_rsvps").insert({
        event_id: id,
        user_id: user.id,
        status,
        guest_count: guestCount,
      });
    }
    await loadEvent();
  }

  async function updateGuestCount(count: number) {
    if (!user || !id) return;
    setGuestInput(count);
    const existing = event?.rsvps.find((r) => r.user_id === user.id);
    if (existing && existing.status === "going") {
      await supabase
        .from("event_rsvps")
        .update({ guest_count: count })
        .eq("id", existing.id);
      await loadEvent();
    }
  }

  async function sendMessage() {
    if (!user || !id || !chatText.trim()) return;

    await supabase.from("event_chat_messages").insert({
      event_id: id,
      user_id: user.id,
      content: chatText.trim(),
    });

    setChatText("");
  }

  async function generateAttendeeReport() {
    if (!event) return;
    const going = event.rsvps.filter((r) => r.status === "going");
    if (going.length === 0) { alert("No attendees to report."); return; }

    const rows: string[][] = [["Name", "Phone", "Location", "Email", "RSVP Status"]];
    let totalCount = 0;
    for (const r of going) {
      const p = r.user;
      const name = p?.display_name || "Unknown";
      const guests = Number((r as any).guest_count) || 0;
      rows.push([name, (p as any)?.phone || "", p?.location || "", (p as any)?.email || "", "Going"]);
      totalCount++;
      for (let g = 1; g <= guests; g++) {
        rows.push([`${name} Guest ${g}`, "", "", "", "Going"]);
        totalCount++;
      }
    }
    const maybe = event.rsvps.filter((r) => r.status === "maybe");
    for (const r of maybe) {
      const p = r.user;
      rows.push([p?.display_name || "Unknown", (p as any)?.phone || "", p?.location || "", (p as any)?.email || "", "Maybe"]);
      totalCount++;
    }
    rows.push([]);
    rows.push([`Total: ${totalCount}`, "", "", "", ""]);

    const csv = rows.map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_Attendees.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCancelEvent() {
    if (!id || !user) return;
    if (!confirm("Are you sure you want to cancel this event? This cannot be undone.")) return;
    await supabase.from("events").delete().eq("id", id).eq("created_by", user.id);
    navigate("/events");
  }

  // Sync guest input with current RSVP (must be before early returns)
  const currentMyRsvp = event?.rsvps.find((r) => r.user_id === user?.id);
  useEffect(() => {
    if (currentMyRsvp) setGuestInput(Number((currentMyRsvp as any).guest_count) || 0);
  }, [currentMyRsvp?.id]);

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Loading event...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Event not found
      </div>
    );
  }

  const myRsvp = event.rsvps.find((r) => r.user_id === user?.id);
  const goingList = event.rsvps.filter((r) => r.status === "going");
  const maybeList = event.rsvps.filter((r) => r.status === "maybe");
  const totalGoing = goingList.reduce((sum, r) => sum + 1 + (Number((r as any).guest_count) || 0), 0);

  // Report access check
  const reportAccess = (event as any).report_access || "creator_admin";
  const myMemberRole = members.find((m) => m.user_id === user?.id)?.role;
  const canGenerateReport =
    reportAccess === "creator_only" ? event.created_by === user?.id :
    reportAccess === "creator_admin" ? (event.created_by === user?.id || myMemberRole === "admin") :
    reportAccess === "verified_members" ? !!myMemberRole :
    false;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back button + RSVP row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate("/events")}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium mr-1 hidden sm:inline">Are you going?</span>
          {(["going", "maybe", "cant_make_it"] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleRsvp(status)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                myRsvp?.status === status
                  ? "bg-gold-500 text-white"
                  : "border border-[var(--border)] hover:bg-[var(--accent)]"
              }`}
            >
              {status === "going"
                ? "Going"
                : status === "maybe"
                  ? "Maybe"
                  : "Can't Make It"}
            </button>
          ))}
          {(event as any).allow_guests && myRsvp?.status === "going" && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs text-[var(--muted-foreground)]">+Guests:</span>
              <input
                type="number"
                min={0}
                max={20}
                value={guestInput}
                onChange={(e) => updateGuestCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Event header card — folds up when menu is open */}
      <div
        className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-md dark:shadow-black/30 transition-all duration-500 ease-in-out"
        style={{
          maxHeight: eventMenuOpen ? "0px" : "none",
          opacity: eventMenuOpen ? 0 : 1,
          marginBottom: eventMenuOpen ? 0 : undefined,
          overflow: eventMenuOpen ? "hidden" : "visible",
        }}
      >
        {event.cover_url ? (
          <img
            src={event.cover_url}
            alt=""
            className="w-full h-64 object-cover rounded-t-2xl"
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center rounded-t-2xl">
            <Calendar className="w-16 h-16 text-gold-500/30" />
          </div>
        )}
        <div className="p-6">
          {editing ? (
            <div className="space-y-4">
              {/* Cover image edit */}
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Cover Image</label>
                {(editCoverPreview || event?.cover_url) ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={editCoverPreview || event?.cover_url || ""} alt="Cover" className="w-full h-32 object-cover rounded-lg" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button type="button" onClick={() => editCoverRef.current?.click()} className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => editCoverRef.current?.click()} className="w-full h-24 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-gold-500/50 flex flex-col items-center justify-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs">Add cover image</span>
                  </button>
                )}
                <input ref={editCoverRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setEditCoverFile(f); setEditCoverPreview(URL.createObjectURL(f)); } }} className="hidden" />
              </div>

              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Title *</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  >
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Location</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Address</label>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Coordinates <span className="text-[10px] font-normal">(optional, for precise map pin)</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    placeholder="Longitude"
                  />
                </div>
              </div>

              {/* Hosted By */}
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Hosted By</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editHosts.map((hostId) => {
                    const member = members.find((m) => m.user_id === hostId);
                    return (
                      <div key={hostId} className="flex items-center gap-1.5 bg-gold-500/10 border border-gold-500/30 rounded-full px-2.5 py-1">
                        <div className="w-5 h-5 rounded-full bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {member?.profile?.avatar_url ? (
                            <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-medium text-gold-500">{member?.profile?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                          )}
                        </div>
                        <span className="text-xs font-medium">{member?.profile?.display_name || "Unknown"}</span>
                        <button type="button" onClick={() => setEditHosts(editHosts.filter((h) => h !== hostId))} className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setShowEditHostPicker(!showEditHostPicker)} className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-gold-500/50 transition-colors cursor-pointer">
                    <UserPlus className="w-3 h-3" /> Add host
                  </button>
                </div>
                {showEditHostPicker && (
                  <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                    {members.filter((m) => !editHosts.includes(m.user_id)).map((m) => (
                      <button type="button" key={m.user_id} onClick={() => { setEditHosts([...editHosts, m.user_id]); setShowEditHostPicker(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer text-left">
                        <div className="w-6 h-6 rounded-full bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {m.profile?.avatar_url ? (<img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />) : (<span className="text-[9px] font-medium text-gold-500">{m.profile?.display_name?.charAt(0).toUpperCase() || "?"}</span>)}
                        </div>
                        <span className="text-sm">{m.profile?.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editAllDay} onChange={(e) => setEditAllDay(e.target.checked)} className="rounded border-[var(--input)] accent-gold-500" />
                All day event
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editAllowGuests} onChange={(e) => setEditAllowGuests(e.target.checked)} className="rounded border-[var(--input)] accent-gold-500" />
                Allow guests
              </label>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Attendee Report Access</label>
                <select
                  value={editReportAccess}
                  onChange={(e) => setEditReportAccess(e.target.value)}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                >
                  <option value="creator_admin">Creator & Family Admin</option>
                  <option value="creator_only">Creator Only</option>
                  <option value="verified_members">All Verified Members</option>
                </select>
              </div>

              {/* Date pickers */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                    Start Date *
                    {editStartDate && <span className="ml-2 text-gold-500">{format(editStartDate, "MMM d, yyyy")}</span>}
                  </label>
                  <div className="flex items-start gap-4">
                    <CalendarPicker selected={editStartDate} onSelect={setEditStartDate} rangeStart={editStartDate} rangeEnd={editEndDate} />
                    {!editAllDay && <TimePicker value={editStartTime} onChange={setEditStartTime} />}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                    End Date
                    {editEndDate && <span className="ml-2 text-gold-500">{format(editEndDate, "MMM d, yyyy")}</span>}
                  </label>
                  <div className="flex items-start gap-4">
                    <CalendarPicker selected={editEndDate} onSelect={setEditEndDate} rangeStart={editStartDate} rangeEnd={editEndDate} />
                    {!editAllDay && <TimePicker value={editEndTime} onChange={setEditEndTime} />}
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <EventDetailsForm
                details={editDetails}
                onChange={setEditDetails}
                eventLat={editForm.latitude ? parseFloat(editForm.latitude) : (event as any)?.latitude || null}
                eventLon={editForm.longitude ? parseFloat(editForm.longitude) : (event as any)?.longitude || null}
                eventAddress={editForm.address || editForm.location || event?.address || event?.location || ""}
              />

              <div className="flex gap-2 pt-2">
                <button onClick={handleEditSave} disabled={editSaving || !editForm.title.trim() || !editStartDate} className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 cursor-pointer flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> {editSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] cursor-pointer flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase text-gold-500 px-2 py-0.5 bg-gold-500/10 rounded-full">
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
                      <span className={`text-xs font-medium uppercase px-2 py-0.5 rounded-full ${styles[status]}`}>
                        {status}
                      </span>
                    );
                  })()}
                </div>
                {event.created_by === user?.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(true)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={handleCancelEvent}
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Cancel Event
                    </button>
                  </div>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-bold">{event.title}</h1>
              {event.description && (
                <p className="mt-2 text-base text-[var(--foreground)]/80">
                  {event.description}
                </p>
              )}
            </>
          )}
          <div className="mt-4 space-y-2.5 text-base text-[var(--foreground)]/70">
            <p className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold-500 flex-shrink-0" />
              {event.is_all_day
                ? format(new Date(event.starts_at), "EEEE, MMMM d, yyyy") + " (All Day)"
                : format(new Date(event.starts_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              {event.ends_at && !event.is_all_day &&
                ` - ${format(new Date(event.ends_at), "h:mm a")}`}
              {event.ends_at && event.is_all_day &&
                ` - ${format(new Date(event.ends_at), "MMMM d, yyyy")}`}
            </p>
            <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span className="w-5 text-center text-gold-500 font-mono text-xs flex-shrink-0">TZ</span>
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gold-500 flex-shrink-0" />
                {event.location}
              </p>
            )}
            {event.address && (
              <p className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-gold-500 flex-shrink-0" />
                {event.address}
              </p>
            )}
            {event.hosts && event.hosts.length > 0 && (
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-gold-500 flex-shrink-0" />
                <span>Hosted by </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {event.hosts.map((host, i) => (
                    <span key={host.id} className="inline-flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {host.avatar_url ? (
                          <img src={host.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-medium text-gold-500">{host.display_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="font-medium text-[var(--foreground)]">{host.display_name}</span>
                      {i < event.hosts!.length - 1 && <span>,</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-500 flex-shrink-0" />
              {goingList.length} going
              {maybeList.length > 0 && ` \u00B7 ${maybeList.length} maybe`}
            </p>
          </div>
          {/* Menu button — bottom right of card */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => { setEventMenuOpen(true); setEventSection("details"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-lg hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                color: "#2e303f",
              }}
            >
              <Menu className="w-4 h-4" />
              Menu
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in event menu bar */}
      <div
        className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--card)] transition-all duration-500 ease-in-out"
        style={{
          maxHeight: eventMenuOpen ? "200px" : "0px",
          opacity: eventMenuOpen ? 1 : 0,
          overflow: "hidden",
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => { setEventSection(null); setEventMenuOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              eventSection === null ? "text-white shadow-lg" : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            style={eventSection === null ? {
              background: theme === "dark"
                ? "linear-gradient(135deg, hsl(38, 65%, 55%), hsl(38, 65%, 40%))"
                : "#000000",
            } : undefined}
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <div className="flex-1 flex items-center gap-1 bg-[var(--accent)] rounded-lg p-1">
            {[
              { key: "details", icon: Info, label: "Details" },
              { key: "travel", icon: Luggage, label: "Travel" },
              { key: "attending", icon: Users, label: "Attending" },
              { key: "chat", icon: MessageSquare, label: "Chat" },
              { key: "more", icon: Star, label: "More" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setEventSection(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  eventSection === tab.key ? "text-white font-medium shadow-lg" : "hover:bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                style={eventSection === tab.key ? {
                  background: theme === "dark"
                    ? "linear-gradient(135deg, hsl(38, 65%, 55%), hsl(38, 65%, 40%))"
                    : "#000000",
                } : undefined}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event section content */}
      {eventSection && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--card)] shadow-md dark:shadow-black/30">
          {eventSection === "details" && (
            <div className="p-6 space-y-6">
              {/* Map */}
              {mapCoords ? (
                <div className="rounded-lg border border-[var(--border)] overflow-hidden shadow-md dark:shadow-black/30">
                  <DeferredMap className="h-72 rounded-t-lg overflow-hidden">
                    <MapContainer center={mapCoords} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} key={mapCoords.join(",")}>
                      <MapResizer />
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
                      <Marker position={mapCoords} icon={goldIcon}>
                        <Popup>{event.address || event.location}</Popup>
                      </Marker>
                    </MapContainer>
                  </DeferredMap>
                  <div className="p-3 space-y-1">
                    {event.location && (
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gold-500 flex-shrink-0" />
                        {event.location}
                        <InfoTip text="If the map doesn't display properly, press Ctrl+Shift+R (Cmd+Shift+R on Mac) or hard refresh on your mobile device." />
                      </p>
                    )}
                    {event.address && (
                      <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                        <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                        {event.address}
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.location || "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-gold-500 hover:text-gold-400 mt-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      Get Directions
                    </a>
                  </div>
                </div>
              ) : (event.location || event.address) ? (
                <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-gold-500" />
                    <h3 className="font-semibold text-sm">Location</h3>
                  </div>
                  {event.location && <p className="text-sm">{event.location}</p>}
                  {event.address && <p className="text-xs text-[var(--muted-foreground)] mt-1">{event.address}</p>}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.location || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gold-500 hover:text-gold-400 mt-2 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    Get Directions
                  </a>
                </div>
              ) : null}

              {/* Two-column: Event Info (left) + Additional Info (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Event Info */}
                <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Event Info</h3>
                  <h2 className="text-xl font-bold">{event.title}</h2>
                  {event.description && (
                    <p className="text-sm text-[var(--muted-foreground)]">{event.description}</p>
                  )}
                  <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gold-500 flex-shrink-0" />
                      {event.is_all_day
                        ? format(new Date(event.starts_at), "EEEE, MMMM d, yyyy") + " (All Day)"
                        : format(new Date(event.starts_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                      {event.ends_at && !event.is_all_day && ` - ${format(new Date(event.ends_at), "h:mm a")}`}
                      {event.ends_at && event.is_all_day && ` - ${format(new Date(event.ends_at), "MMMM d, yyyy")}`}
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gold-500 flex-shrink-0" />
                        {event.location}
                      </p>
                    )}
                    {event.address && (
                      <p className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-gold-500 flex-shrink-0" />
                        {event.address}
                      </p>
                    )}
                    {event.hosts && event.hosts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-gold-500 flex-shrink-0" />
                        <span>Hosted by </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {event.hosts.map((host, i) => (
                            <span key={host.id} className="inline-flex items-center gap-1">
                              <div className="w-5 h-5 rounded-full bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                                {host.avatar_url ? (
                                  <img src={host.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-medium text-gold-500">{host.display_name?.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="font-medium text-[var(--foreground)]">{host.display_name}</span>
                              {i < event.hosts!.length - 1 && <span>,</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gold-500 flex-shrink-0" />
                      {goingList.length} going{maybeList.length > 0 && ` \u00B7 ${maybeList.length} maybe`}
                    </p>
                    <p className="flex items-center gap-2 text-xs">
                      <span className="text-gold-500 font-medium">{event.category}</span>
                      <span>{"\u00B7"}</span>
                      <span>Created by {event.creator?.display_name || "Unknown"}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Additional Info */}
                {(() => {
                  const d = parseDetails((event as any).details);
                  const hasAny = d.cost || d.dress_code || d.nearby_airports || d.websites.length > 0 || d.contact_name || d.contact_phone || d.contact_email || d.additional_notes;
                  if (!hasAny) return <div />;
                  return (
                    <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4 space-y-3">
                      <h3 className="font-semibold text-sm">Additional Info</h3>
                      <div className="space-y-2 text-sm">
                        {d.cost && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <span className="text-green-400 font-medium">$</span>
                            <span>{d.cost}</span>
                          </div>
                        )}
                        {d.dress_code && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <span className="text-gold-500 text-xs">Dress:</span>
                            <span>{d.dress_code}</span>
                          </div>
                        )}
                        {d.nearby_airports && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <span className="text-gold-500 text-xs">Airports:</span>
                            <span>{d.nearby_airports}</span>
                          </div>
                        )}
                        {d.websites.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="text-gold-500 text-xs">Websites:</span>
                            {d.websites.filter((w) => w.url).map((w, i) => (
                              <a key={i} href={w.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gold-500 hover:text-gold-400 text-sm underline underline-offset-2">
                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{w.label || w.url}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {(d.contact_name || d.contact_phone || d.contact_email) && (
                          <div className="border-t border-[var(--border)] pt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                            <p className="text-[var(--foreground)] font-medium text-sm">Contact</p>
                            {d.contact_name && <p>{d.contact_name}</p>}
                            {d.contact_phone && <p>{d.contact_phone}</p>}
                            {d.contact_email && <a href={`mailto:${d.contact_email}`} className="text-gold-500 hover:text-gold-400">{d.contact_email}</a>}
                          </div>
                        )}
                        {d.additional_notes && (
                          <div className="border-t border-[var(--border)] pt-2">
                            <p className="text-xs text-[var(--muted-foreground)] whitespace-pre-wrap">{d.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {eventSection === "travel" && (() => {
            const d = parseDetails((event as any).details);
            const hasLodging = d.lodging_hotel || d.lodging_address || d.lodging_phone || d.lodging_website || d.lodging_checkin || d.lodging_checkout || d.lodging_rate || d.lodging_notes || d.lodging_has_shuttle;
            const hasTransport = d.transport_airports || d.transport_rental || d.transport_parking || d.transport_rideshare || d.transport_shuttle || d.transport_notes;
            const lodgingAddr = d.lodging_same_address ? (event.address || event.location || "") : d.lodging_address;

            // Parse airport codes from transport_airports string
            const airportCodes = d.transport_airports ? d.transport_airports.split(",").map((s: string) => s.trim().split(" ")[0].replace(/[()]/g, "")).filter(Boolean) : [];
            const airportMarkers = airportCodes.map((code: string) => US_AIRPORTS.find((a) => a.code === code)).filter(Boolean);

            // Directions URL from first airport to lodging/event
            const destAddr = lodgingAddr || event.address || event.location || "";
            const firstAirport = airportMarkers[0];

            return (
            <div className="p-6 space-y-6">
              {/* Map */}
              {mapCoords && (
                <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 overflow-hidden">
                  <DeferredMap className="h-72 overflow-hidden">
                    <MapContainer center={mapCoords} zoom={10} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} key={`travel-${mapCoords.join(",")}`}>
                      <MapResizer />
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
                      {showEventPin && <Marker position={mapCoords} icon={goldIcon}><Popup>{event.title}<br />{event.address || event.location}</Popup></Marker>}
                      {showAirportPins && airportMarkers.map((a: any) => (
                        <Marker key={a.code} position={[a.lat, a.lon]} icon={blueIcon}><Popup>{a.code} - {a.name}<br />{a.city}, {a.state}</Popup></Marker>
                      ))}
                    </MapContainer>
                  </DeferredMap>
                  {/* Pin toggles */}
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
                    <InfoTip text="If the map doesn't display properly, press Ctrl+Shift+R (Cmd+Shift+R on Mac) or hard refresh on your mobile device." />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={showEventPin} onChange={(e) => setShowEventPin(e.target.checked)} className="accent-gold-500" />
                      <span className="text-gold-500 font-medium">Event</span>
                    </label>
                    {airportMarkers.length > 0 && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={showAirportPins} onChange={(e) => setShowAirportPins(e.target.checked)} className="accent-blue-500" />
                        <span className="text-blue-400 font-medium">Airports</span>
                      </label>
                    )}
                    {hasLodging && lodgingAddr && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={showLodgingPin} onChange={(e) => setShowLodgingPin(e.target.checked)} className="accent-purple-500" />
                        <span className="text-purple-400 font-medium">Lodging</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {!hasLodging && !hasTransport && (
                <p className="text-[var(--muted-foreground)] text-sm text-center py-8">No lodging or transportation info has been added for this event yet.</p>
              )}

              {hasLodging && (
                <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4 space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-lg">🏨</span> Lodging
                  </h3>
                  <div className="space-y-2 text-sm">
                    {d.lodging_hotel && (
                      <div><span className="text-gold-500 text-xs">Hotel:</span> <span className="ml-1 font-medium">{d.lodging_hotel}</span></div>
                    )}
                    {lodgingAddr && (
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <MapPin className="w-3.5 h-3.5 text-gold-500 flex-shrink-0" />
                        <span>{lodgingAddr}{d.lodging_same_address ? " (same as event)" : ""}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {d.lodging_phone && <div><span className="text-gold-500 text-xs">Phone:</span> <span className="ml-1">{d.lodging_phone}</span></div>}
                      {d.lodging_rate && <div><span className="text-gold-500 text-xs">Rate:</span> <span className="ml-1">{d.lodging_rate}</span></div>}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {d.lodging_checkin && <div><span className="text-gold-500 text-xs">Check-in:</span> <span className="ml-1">{d.lodging_checkin}</span></div>}
                      {d.lodging_checkout && <div><span className="text-gold-500 text-xs">Check-out:</span> <span className="ml-1">{d.lodging_checkout}</span></div>}
                    </div>
                    {d.lodging_has_shuttle && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 text-xs font-medium">✓ Shuttle Available</span>
                        {d.lodging_shuttle_info && <span className="text-[var(--muted-foreground)]">— {d.lodging_shuttle_info}</span>}
                      </div>
                    )}
                    {d.lodging_website && (
                      <a href={d.lodging_website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gold-500 hover:text-gold-400 text-sm underline underline-offset-2">
                        <ExternalLink className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                    {d.lodging_notes && <p className="text-[var(--muted-foreground)] text-xs whitespace-pre-wrap border-t border-[var(--border)] pt-2 mt-2">{d.lodging_notes}</p>}
                  </div>
                </div>
              )}

              {hasTransport && (
                <div className="rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4 space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-lg">🚗</span> Transportation
                  </h3>
                  <div className="space-y-2 text-sm">
                    {d.transport_airports && <div><span className="text-gold-500 text-xs">Airports:</span> <span className="ml-1">{d.transport_airports}</span></div>}
                    {firstAirport && destAddr && (
                      <a
                        href={`https://www.google.com/maps/dir/${encodeURIComponent(firstAirport.name + " " + firstAirport.city + " " + firstAirport.state)}/${encodeURIComponent(destAddr)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-gold-500 hover:text-gold-400 text-sm underline underline-offset-2"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Directions from {firstAirport.code} to {lodgingAddr ? "hotel" : "event"}
                      </a>
                    )}
                    {d.transport_rental && <div><span className="text-gold-500 text-xs">Car Rental:</span> <span className="ml-1">{d.transport_rental}</span></div>}
                    {d.transport_parking && <div><span className="text-gold-500 text-xs">Parking:</span> <span className="ml-1">{d.transport_parking}</span></div>}
                    {d.transport_rideshare && <div><span className="text-gold-500 text-xs">Rideshare:</span> <span className="ml-1">{d.transport_rideshare}</span></div>}
                    {d.transport_shuttle && <div><span className="text-gold-500 text-xs">Shuttle:</span> <span className="ml-1">{d.transport_shuttle}</span></div>}
                    {d.transport_notes && <p className="text-[var(--muted-foreground)] text-xs whitespace-pre-wrap border-t border-[var(--border)] pt-2 mt-2">{d.transport_notes}</p>}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {eventSection === "attending" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Attending ({totalGoing}{totalGoing !== goingList.length ? ` incl. ${totalGoing - goingList.length} guest${totalGoing - goingList.length !== 1 ? 's' : ''}` : ''})
                </h3>
                {canGenerateReport && goingList.length > 0 && (
                  <button
                    onClick={generateAttendeeReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Report
                  </button>
                )}
              </div>
              {goingList.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {goingList.map((r) => {
                    const guests = Number((r as any).guest_count) || 0;
                    return (
                    <div key={r.id} className="flex items-center gap-2 bg-[var(--background)] rounded-full px-3 py-1">
                      <div className="relative">
                        <div className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                          {r.user?.avatar_url ? (
                            <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        {guests > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold-500 text-white text-[9px] font-bold flex items-center justify-center">+{guests}</span>
                        )}
                      </div>
                      <span className="text-sm">{r.user?.display_name}</span>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[var(--muted-foreground)] text-sm">No one has RSVP'd yet.</p>
              )}
              {maybeList.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 text-[var(--muted-foreground)]">Maybe ({maybeList.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {maybeList.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 bg-[var(--background)] rounded-full px-3 py-1">
                        <div className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                          {r.user?.avatar_url ? (
                            <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-sm">{r.user?.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {eventSection === "chat" && (
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Event Chat
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-2">
                      <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {msg.user?.avatar_url ? (
                          <img src={msg.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gold-500">{msg.user?.display_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">{msg.user?.display_name}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                />
                <button onClick={sendMessage} className="p-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {eventSection === "more" && (
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" />
                More
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm">More content coming soon.</p>
            </div>
          )}
        </div>
      )}

      {/* Original content — hidden when menu is open */}
      {!eventMenuOpen && (
        <div className="space-y-6">

      {/* Attendees */}
      {goingList.length > 0 && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4">
          <h3 className="font-semibold mb-3">
            Attending ({totalGoing}{totalGoing !== goingList.length ? ` incl. ${totalGoing - goingList.length} guest${totalGoing - goingList.length !== 1 ? 's' : ''}` : ''})
          </h3>
          <div className="flex flex-wrap gap-2">
            {goingList.map((r) => {
              const guests = Number((r as any).guest_count) || 0;
              return (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-[var(--background)] rounded-full px-3 py-1"
              >
                <div className="relative">
                <div className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                  {r.user?.avatar_url ? (
                    <img
                      src={r.user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-medium text-gold-500">
                      {r.user?.display_name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {guests > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold-500 text-white text-[9px] font-bold flex items-center justify-center">+{guests}</span>
                )}
                </div>
                <span className="text-sm">{r.user?.display_name}</span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event chat */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-md dark:shadow-black/30 p-4">
        <h3 className="font-semibold mb-3">Event Chat</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {msg.user?.avatar_url ? (
                    <img
                      src={msg.user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">
                      {msg.user?.display_name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {msg.user?.display_name}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />
          <button
            onClick={sendMessage}
            disabled={!chatText.trim()}
            className="px-3 py-2 rounded-md bg-gold-500 text-white hover:bg-gold-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      </div>
      )}
      {/* end original content */}
    </div>
  );
}
