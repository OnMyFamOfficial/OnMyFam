import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X, Plane, Globe, Phone, DollarSign, Shirt, FileText } from "lucide-react";

export interface EventDetails {
  cost: string;
  dress_code: string;
  nearby_airports: string;
  websites: { label: string; url: string }[];
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  additional_notes: string;
}

export const emptyDetails: EventDetails = {
  cost: "",
  dress_code: "",
  nearby_airports: "",
  websites: [],
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
  additional_notes: "",
};

export function parseDetails(raw: any): EventDetails {
  if (!raw || typeof raw !== "object") return { ...emptyDetails };
  return {
    cost: raw.cost || "",
    dress_code: raw.dress_code || "",
    nearby_airports: raw.nearby_airports || "",
    websites: Array.isArray(raw.websites) ? raw.websites : [],
    contact_name: raw.contact_name || "",
    contact_phone: raw.contact_phone || "",
    contact_email: raw.contact_email || "",
    contact_address: raw.contact_address || "",
    additional_notes: raw.additional_notes || "",
  };
}

export function detailsToJson(d: EventDetails): Record<string, any> {
  const obj: Record<string, any> = {};
  if (d.cost.trim()) obj.cost = d.cost.trim();
  if (d.dress_code.trim()) obj.dress_code = d.dress_code.trim();
  if (d.nearby_airports.trim()) obj.nearby_airports = d.nearby_airports.trim();
  if (d.websites.length > 0) obj.websites = d.websites.filter((w) => w.url.trim());
  if (d.contact_name.trim()) obj.contact_name = d.contact_name.trim();
  if (d.contact_phone.trim()) obj.contact_phone = d.contact_phone.trim();
  if (d.contact_email.trim()) obj.contact_email = d.contact_email.trim();
  if (d.contact_address.trim()) obj.contact_address = d.contact_address.trim();
  if (d.additional_notes.trim()) obj.additional_notes = d.additional_notes.trim();
  return Object.keys(obj).length > 0 ? obj : {};
}

interface Props {
  details: EventDetails;
  onChange: (d: EventDetails) => void;
}

const inputClass = "w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50";

export function EventDetailsForm({ details, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  function update(key: keyof EventDetails, value: any) {
    onChange({ ...details, [key]: value });
  }

  function addWebsite() {
    onChange({ ...details, websites: [...details.websites, { label: "", url: "" }] });
  }

  function updateWebsite(idx: number, field: "label" | "url", value: string) {
    const updated = [...details.websites];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...details, websites: updated });
  }

  function removeWebsite(idx: number) {
    onChange({ ...details, websites: details.websites.filter((_, i) => i !== idx) });
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Additional Details
        <span className="text-xs text-[var(--muted-foreground)] font-normal">(optional)</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
          {/* Cost */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              Cost
            </label>
            <input
              value={details.cost}
              onChange={(e) => update("cost", e.target.value)}
              className={inputClass}
              placeholder='e.g. Free, $25 per person, $50 per family'
            />
          </div>

          {/* Dress Code */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Shirt className="w-3.5 h-3.5 text-purple-400" />
              Dress Code
            </label>
            <input
              value={details.dress_code}
              onChange={(e) => update("dress_code", e.target.value)}
              className={inputClass}
              placeholder="e.g. Casual, Semi-formal, White attire"
            />
          </div>

          {/* Nearby Airports */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Plane className="w-3.5 h-3.5 text-sky-400" />
              Nearby Airports
            </label>
            <input
              value={details.nearby_airports}
              onChange={(e) => update("nearby_airports", e.target.value)}
              className={inputClass}
              placeholder="e.g. MCO (Orlando), SFB (Sanford)"
            />
          </div>

          {/* Websites */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Websites
            </label>
            <div className="space-y-2">
              {details.websites.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={w.label}
                    onChange={(e) => updateWebsite(i, "label", e.target.value)}
                    className={inputClass}
                    placeholder="Label (e.g. Hotel, Venue)"
                    style={{ width: "35%" }}
                  />
                  <input
                    value={w.url}
                    onChange={(e) => updateWebsite(i, "url", e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={() => removeWebsite(i)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addWebsite}
                className="flex items-center gap-1.5 text-xs text-gold-500 hover:text-gold-400 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add website
              </button>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
              <Phone className="w-3.5 h-3.5 text-orange-400" />
              Contact Information
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={details.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                className={inputClass}
                placeholder="Contact name"
              />
              <input
                value={details.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
                className={inputClass}
                placeholder="Phone number"
              />
              <input
                value={details.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                className={inputClass}
                placeholder="Email address"
              />
              <input
                value={details.contact_address}
                onChange={(e) => update("contact_address", e.target.value)}
                className={inputClass}
                placeholder="Contact address"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              Additional Notes
            </label>
            <textarea
              value={details.additional_notes}
              onChange={(e) => update("additional_notes", e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Anything else attendees should know..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
