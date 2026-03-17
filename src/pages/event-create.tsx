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
    starts_at: "",
    ends_at: "",
    is_all_day: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !currentFamily || !form.title.trim() || !form.starts_at) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("events")
      .insert({
        family_id: currentFamily.id,
        created_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        location: form.location.trim() || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_all_day: form.is_all_day,
      })
      .select()
      .single();

    if (!error && data) {
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              required
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
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

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.starts_at}
            className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
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
