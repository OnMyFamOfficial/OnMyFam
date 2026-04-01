import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X, UserPlus } from "lucide-react";
import { InfoTip } from "@/components/shared/info-tip";
import { EventDetailsForm, emptyDetails, detailsToJson, type EventDetails } from "@/components/shared/event-details-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import { format } from "date-fns";

function TimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  // Parse "HH:mm" 24h value into hour/minute/period
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
    if (!newHour || !newMinute) {
      onChange("");
      return;
    }
    let h24 = parseInt(newHour);
    if (newPeriod === "AM" && h24 === 12) h24 = 0;
    else if (newPeriod === "PM" && h24 !== 12) h24 += 12;
    onChange(`${String(h24).padStart(2, "0")}:${newMinute}`);
  }

  const selectClass = "rounded-lg border border-gold-500/40 bg-[var(--background)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 cursor-pointer appearance-none text-center";

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <span className="text-xs font-medium text-gold-500">Time</span>
      <div className="flex items-center gap-1.5 bg-[var(--accent)] rounded-xl px-3 py-2.5 border border-[var(--border)]">
        <select
          value={hour}
          onChange={(e) => update(e.target.value, minute || "00", period)}
          className={selectClass}
          style={{ width: "52px" }}
        >
          <option value="">--</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={String(h)}>{h}</option>
          ))}
        </select>
        <span className="text-lg font-bold text-gold-500">:</span>
        <select
          value={minute}
          onChange={(e) => update(hour || "12", e.target.value, period)}
          className={selectClass}
          style={{ width: "52px" }}
        >
          <option value="">--</option>
          {["00", "15", "30", "45"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={period}
          onChange={(e) => update(hour || "12", minute || "00", e.target.value)}
          className={`${selectClass} font-semibold`}
          style={{ width: "58px" }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily, members } = useFamily();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other" as string,
    location: "",
    address: "",
    latitude: "",
    longitude: "",
    start_time: "",
    end_time: "",
    is_all_day: false,
    allow_guests: false,
    report_access: "creator_admin",
  });
  const [details, setDetails] = useState<EventDetails>({ ...emptyDetails });
  const [hosts, setHosts] = useState<string[]>([]);
  const [showHostPicker, setShowHostPicker] = useState(false);
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

    // Build date/time - use noon for all-day events to avoid timezone date-shift
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const startsAt = form.is_all_day || !form.start_time
      ? new Date(`${startDateStr}T12:00:00`).toISOString()
      : new Date(`${startDateStr}T${form.start_time}`).toISOString();

    let endsAt: string | null = null;
    if (endDate) {
      const endDateStr = format(endDate, "yyyy-MM-dd");
      endsAt = form.is_all_day || !form.end_time
        ? new Date(`${endDateStr}T12:00:00`).toISOString()
        : new Date(`${endDateStr}T${form.end_time}`).toISOString();
    }

    // Upload cover image if provided
    let coverUrl: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("events").upload(path, coverFile);
      if (uploadErr) {
        console.error("Cover upload error:", uploadErr);
      } else {
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
        address: form.address.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        hosted_by: hosts.length > 0 ? hosts : [],
        cover_url: coverUrl,
        starts_at: startsAt,
        ends_at: endsAt,
        is_all_day: form.is_all_day,
        allow_guests: form.allow_guests,
        report_access: form.report_access,
        details: detailsToJson(details),
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

        {/* Address */}
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            placeholder="123 Main St, City, State 12345"
          />
        </div>

        {/* Coordinates */}
        <div>
          <label className="block text-sm font-medium mb-1">Coordinates <span className="text-xs text-[var(--muted-foreground)] font-normal">(optional, for precise map pin)</span></label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="Latitude (e.g. 28.2919)"
            />
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="Longitude (e.g. -81.4076)"
            />
          </div>
        </div>

        {/* Hosted By */}
        <div>
          <label className="block text-sm font-medium mb-1">Hosted By</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {hosts.map((hostId) => {
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
                  <button
                    type="button"
                    onClick={() => setHosts(hosts.filter((h) => h !== hostId))}
                    className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setShowHostPicker(!showHostPicker)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-gold-500/50 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3 h-3" /> Add host
            </button>
          </div>
          {showHostPicker && (
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
              {members
                .filter((m) => !hosts.includes(m.user_id))
                .map((m) => (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => { setHosts([...hosts, m.user_id]); setShowHostPicker(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-gold-500/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {m.profile?.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-medium text-gold-500">{m.profile?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <span className="text-sm">{m.profile?.display_name}</span>
                  </button>
                ))}
              {members.filter((m) => !hosts.includes(m.user_id)).length === 0 && (
                <p className="text-xs text-[var(--muted-foreground)] text-center py-2">All members added</p>
              )}
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_all_day}
              onChange={(e) => setForm({ ...form, is_all_day: e.target.checked })}
              className="rounded border-[var(--input)] accent-gold-500"
            />
            All day event
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.allow_guests}
              onChange={(e) => setForm({ ...form, allow_guests: e.target.checked })}
              className="rounded border-[var(--input)] accent-gold-500"
            />
            Allow attendees to bring guests
          </label>
        </div>

        {/* Report access */}
        <div>
          <label className="flex items-center text-sm font-medium mb-1">Attendee Report Access <InfoTip text="Controls who can download a CSV report of attendees with their contact info. Creator Only: just you. Creator & Admin: you and family admins. Verified Members: any verified family member." /></label>
          <select
            value={form.report_access}
            onChange={(e) => setForm({ ...form, report_access: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          >
            <option value="creator_admin">Creator & Family Admin</option>
            <option value="creator_only">Creator Only</option>
            <option value="verified_members">All Verified Members</option>
          </select>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Controls who can download the attendee report</p>
        </div>

        {/* Date pickers */}
        <div className="space-y-6">
          {/* Start date + time */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Start Date *
              {startDate && <span className="ml-2 text-gold-500 font-normal">{format(startDate, "MMM d, yyyy")}</span>}
            </label>
            <div className="flex items-start gap-4">
              <CalendarPicker selected={startDate} onSelect={setStartDate} rangeStart={startDate} rangeEnd={endDate} />
              {!form.is_all_day && (
                <TimePicker
                  value={form.start_time}
                  onChange={(val) => setForm({ ...form, start_time: val })}
                />
              )}
            </div>
          </div>
          {/* End date + time */}
          <div>
            <label className="block text-sm font-medium mb-2">
              End Date
              {endDate && <span className="ml-2 text-gold-500 font-normal">{format(endDate, "MMM d, yyyy")}</span>}
            </label>
            <div className="flex items-start gap-4">
              <CalendarPicker selected={endDate} onSelect={setEndDate} rangeStart={startDate} rangeEnd={endDate} />
              {!form.is_all_day && (
                <TimePicker
                  value={form.end_time}
                  onChange={(val) => setForm({ ...form, end_time: val })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Event Details Tabs */}
        <div>
          <h3 className="text-sm font-medium mb-2">Event Details <span className="text-xs text-[var(--muted-foreground)] font-normal">(optional)</span></h3>
          <EventDetailsForm
            details={details}
            onChange={setDetails}
            eventLat={form.latitude ? parseFloat(form.latitude) : null}
            eventLon={form.longitude ? parseFloat(form.longitude) : null}
            eventAddress={form.address || form.location}
          />
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
