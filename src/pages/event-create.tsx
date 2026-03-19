import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import { format } from "date-fns";

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
    start_time: "",
    end_time: "",
    is_all_day: false,
  });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function removeCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    if (coverRef.current) coverRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !currentFamily || !form.title.trim() || !startDate) return;
    setSaving(true);

    // Build date/time
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const startsAt = form.is_all_day || !form.start_time
      ? new Date(`${startDateStr}T00:00:00`).toISOString()
      : new Date(`${startDateStr}T${form.start_time}`).toISOString();

    let endsAt: string | null = null;
    if (endDate) {
      const endDateStr = format(endDate, "yyyy-MM-dd");
      endsAt = form.is_all_day || !form.end_time
        ? new Date(`${endDateStr}T23:59:59`).toISOString()
        : new Date(`${endDateStr}T${form.end_time}`).toISOString();
    }

    // Upload cover image if provided
    let coverUrl: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("events").upload(path, coverFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("events").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        family_id: currentFamily.id,
        created_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        location: form.location.trim() || null,
        cover_url: coverUrl,
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
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Event</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-5"
      >
        {/* Cover image */}
        <div>
          <label className="block text-sm font-medium mb-1">Cover Image</label>
          {coverPreview ? (
            <div className="relative rounded-lg overflow-hidden">
              <img src={coverPreview} alt="Cover" className="w-full h-40 object-cover rounded-lg" />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="w-full h-32 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-gold-500/50 flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-sm">Add a cover image</span>
            </button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            onChange={handleCoverSelect}
            className="hidden"
          />
        </div>

        {/* Title */}
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

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
            placeholder="Tell everyone about this event..."
          />
        </div>

        {/* Category + Location */}
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

        {/* All day toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_all_day}
            onChange={(e) => setForm({ ...form, is_all_day: e.target.checked })}
            className="rounded border-[var(--input)] accent-gold-500"
          />
          All day event
        </label>

        {/* Date pickers */}
        <div className="flex flex-col sm:flex-row gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Start Date *
              {startDate && <span className="ml-2 text-gold-500 font-normal">{format(startDate, "MMM d, yyyy")}</span>}
            </label>
            <CalendarPicker selected={startDate} onSelect={setStartDate} />
            {!form.is_all_day && (
              <div className="mt-2">
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              End Date
              {endDate && <span className="ml-2 text-gold-500 font-normal">{format(endDate, "MMM d, yyyy")}</span>}
            </label>
            <CalendarPicker selected={endDate} onSelect={setEndDate} />
            {!form.is_all_day && (
              <div className="mt-2">
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !startDate}
            className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Creating..." : "Create Event"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
