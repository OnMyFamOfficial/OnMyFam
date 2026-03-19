import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Users, Send, Pencil, Save, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { format, formatDistanceToNow } from "date-fns";
import type { FamilyEvent, EventRsvp, EventChatMessage, Profile } from "@/lib/types";

type FullEvent = FamilyEvent & {
  creator: Profile;
  rsvps: (EventRsvp & { user: Profile })[];
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<FullEvent | null>(null);
  const [messages, setMessages] = useState<(EventChatMessage & { user: Profile })[]>([]);
  const [chatText, setChatText] = useState("");
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [editForm, setEditForm] = useState({ title: "", description: "", location: "", category: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
    } as FullEvent);
    setEditForm({
      title: eventData.title || "",
      description: eventData.description || "",
      location: eventData.location || "",
      category: eventData.category || "other",
    });
    setLoading(false);
  }

  async function handleEditSave() {
    if (!id || !editForm.title.trim()) return;
    setEditSaving(true);
    await supabase.from("events").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      location: editForm.location.trim() || null,
      category: editForm.category,
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

  async function handleRsvp(status: "going" | "maybe" | "cant_make_it") {
    if (!user || !id) return;

    const existing = event?.rsvps.find((r) => r.user_id === user.id);
    if (existing) {
      await supabase
        .from("event_rsvps")
        .update({ status })
        .eq("id", existing.id);
    } else {
      await supabase.from("event_rsvps").insert({
        event_id: id,
        user_id: user.id,
        status,
      });
    }
    await loadEvent();
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/events")}
        className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      {/* Header */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
        {event.cover_url ? (
          <img
            src={event.cover_url}
            alt=""
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-r from-gold-600/30 to-gold-400/30 flex items-center justify-center">
            <Calendar className="w-16 h-16 text-gold-500/30" />
          </div>
        )}
        <div className="p-6">
          {editing ? (
            <div className="space-y-3">
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
              <div className="flex gap-2">
                <button onClick={handleEditSave} disabled={editSaving || !editForm.title.trim()} className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 cursor-pointer flex items-center gap-1">
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
                <span className="text-xs font-medium uppercase text-gold-500 px-2 py-0.5 bg-gold-500/10 rounded-full">
                  {event.category}
                </span>
                {event.created_by === user?.id && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--muted-foreground)] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
              {event.description && (
                <p className="mt-2 text-[var(--muted-foreground)]">
                  {event.description}
                </p>
              )}
            </>
          )}
          <div className="mt-4 space-y-2 text-sm text-[var(--muted-foreground)]">
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(event.starts_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              {event.ends_at &&
                ` - ${format(new Date(event.ends_at), "h:mm a")}`}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {event.location}
              </p>
            )}
            <p className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {goingList.length} going
              {maybeList.length > 0 && ` \u00B7 ${maybeList.length} maybe`}
            </p>
          </div>
        </div>
      </div>

      {/* RSVP */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-semibold mb-3">Are you going?</h3>
        <div className="flex gap-2">
          {(["going", "maybe", "cant_make_it"] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleRsvp(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
        </div>
      </div>

      {/* Attendees */}
      {goingList.length > 0 && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-semibold mb-3">
            Attending ({goingList.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {goingList.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-[var(--background)] rounded-full px-3 py-1"
              >
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
                <span className="text-sm">{r.user?.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event chat */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
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
  );
}
