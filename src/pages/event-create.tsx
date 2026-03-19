import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other" as string,
    location: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    is_all_day: false,
  });

  function buildDateTime(date: string, time: string, allDay: boolean): string | null {
    if (!date) return null;
    if (allDay || !time) {
      return new Date(`${date}T00:00:00`).toISOString();
    }
    return new Date(`${date}T${time}`).toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !currentFamily || !form.title.trim() || !form.start_date) return;
    setSaving(true);

    const startsAt = buildDateTime(form.start_date, form.start_time, form.is_all_day);
    const endsAt = form.end_date ? buildDateTime(form.end_date, form.end_time, form.is_all_day) : null;

    if (!startsAt) { setSaving(false); return; }

    const { data, error } = await supabase
      .from("events")
      .insert({
        family_id: currentFamily.id,
        created_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        location: form.location.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_all_day: form.is_all_day,
      })
      .select()
      .single();

    if (error) {
      console.error("Event create error:", error);
      alert("Failed to create event: " + error.message);
      setSaving(false);
      return;
    }

    if (data) {
      // Auto-RSVP creator as going
      await supabase.from("event_rsvps").insert({
        event_id: data.id,
        user_id: user.id,
        status: "going",
      });
      navigate(`/events/${data.id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Event</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            placeholder="Family Reunion 2026"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={3}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
            placeholder="Tell everyone about this event..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            >
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="Grandma's house"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_all_day}
            onChange={(e) => setForm({ ...form, is_all_day: e.target.checked })}
            className="rounded border-[var(--input)] accent-gold-500"
          />
          All day event
        </label>

        <div className={`grid gap-4 ${form.is_all_day ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
          </div>
          {!form.is_all_day && (
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
          </div>
          {!form.is_all_day && (
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.start_date}
            className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Event"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
