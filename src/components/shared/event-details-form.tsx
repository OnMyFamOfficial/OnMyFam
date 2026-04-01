import { useState } from "react";
import { Plus, X, Globe, Phone, DollarSign, Shirt, FileText, Home, Car, Bed, MoreHorizontal } from "lucide-react";
import { AirportPicker } from "@/components/shared/airport-picker";
import { useTheme } from "@/components/shared/theme-provider";

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
  // Lodging
  lodging_hotel: string;
  lodging_address: string;
  lodging_same_address: boolean;
  lodging_phone: string;
  lodging_website: string;
  lodging_checkin: string;
  lodging_checkout: string;
  lodging_rate: string;
  lodging_has_shuttle: boolean;
  lodging_shuttle_info: string;
  lodging_notes: string;
  // Transportation
  transport_airports: string;
  transport_rental: string;
  transport_parking: string;
  transport_rideshare: string;
  transport_shuttle: string;
  transport_notes: string;
  // More
  more_what_to_bring: string;
  more_dietary: string;
  more_kids: string;
  more_pets: string;
  more_notes: string;
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
  lodging_hotel: "",
  lodging_address: "",
  lodging_same_address: false,
  lodging_phone: "",
  lodging_website: "",
  lodging_checkin: "",
  lodging_checkout: "",
  lodging_rate: "",
  lodging_has_shuttle: false,
  lodging_shuttle_info: "",
  lodging_notes: "",
  transport_airports: "",
  transport_rental: "",
  transport_parking: "",
  transport_rideshare: "",
  transport_shuttle: "",
  transport_notes: "",
  more_what_to_bring: "",
  more_dietary: "",
  more_kids: "",
  more_pets: "",
  more_notes: "",
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
    lodging_hotel: raw.lodging_hotel || "",
    lodging_address: raw.lodging_address || "",
    lodging_same_address: raw.lodging_same_address || false,
    lodging_phone: raw.lodging_phone || "",
    lodging_website: raw.lodging_website || "",
    lodging_checkin: raw.lodging_checkin || "",
    lodging_checkout: raw.lodging_checkout || "",
    lodging_rate: raw.lodging_rate || "",
    lodging_has_shuttle: raw.lodging_has_shuttle || false,
    lodging_shuttle_info: raw.lodging_shuttle_info || "",
    lodging_notes: raw.lodging_notes || "",
    transport_airports: raw.transport_airports || raw.nearby_airports || "",
    transport_rental: raw.transport_rental || "",
    transport_parking: raw.transport_parking || "",
    transport_rideshare: raw.transport_rideshare || "",
    transport_shuttle: raw.transport_shuttle || "",
    transport_notes: raw.transport_notes || "",
    more_what_to_bring: raw.more_what_to_bring || "",
    more_dietary: raw.more_dietary || "",
    more_kids: raw.more_kids || "",
    more_pets: raw.more_pets || "",
    more_notes: raw.more_notes || "",
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
  if (d.lodging_hotel.trim()) obj.lodging_hotel = d.lodging_hotel.trim();
  if (d.lodging_address.trim()) obj.lodging_address = d.lodging_address.trim();
  if (d.lodging_same_address) obj.lodging_same_address = true;
  if (d.lodging_phone.trim()) obj.lodging_phone = d.lodging_phone.trim();
  if (d.lodging_website.trim()) obj.lodging_website = d.lodging_website.trim();
  if (d.lodging_checkin.trim()) obj.lodging_checkin = d.lodging_checkin.trim();
  if (d.lodging_checkout.trim()) obj.lodging_checkout = d.lodging_checkout.trim();
  if (d.lodging_rate.trim()) obj.lodging_rate = d.lodging_rate.trim();
  if (d.lodging_has_shuttle) obj.lodging_has_shuttle = true;
  if (d.lodging_shuttle_info.trim()) obj.lodging_shuttle_info = d.lodging_shuttle_info.trim();
  if (d.lodging_notes.trim()) obj.lodging_notes = d.lodging_notes.trim();
  if (d.transport_airports.trim()) obj.transport_airports = d.transport_airports.trim();
  if (d.transport_rental.trim()) obj.transport_rental = d.transport_rental.trim();
  if (d.transport_parking.trim()) obj.transport_parking = d.transport_parking.trim();
  if (d.transport_rideshare.trim()) obj.transport_rideshare = d.transport_rideshare.trim();
  if (d.transport_shuttle.trim()) obj.transport_shuttle = d.transport_shuttle.trim();
  if (d.transport_notes.trim()) obj.transport_notes = d.transport_notes.trim();
  if (d.more_what_to_bring.trim()) obj.more_what_to_bring = d.more_what_to_bring.trim();
  if (d.more_dietary.trim()) obj.more_dietary = d.more_dietary.trim();
  if (d.more_kids.trim()) obj.more_kids = d.more_kids.trim();
  if (d.more_pets.trim()) obj.more_pets = d.more_pets.trim();
  if (d.more_notes.trim()) obj.more_notes = d.more_notes.trim();
  return Object.keys(obj).length > 0 ? obj : {};
}

interface Props {
  details: EventDetails;
  onChange: (d: EventDetails) => void;
  eventLat?: number | null;
  eventLon?: number | null;
  eventAddress?: string;
}

const inputClass = "w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50";

export function EventDetailsForm({ details, onChange, eventLat, eventLon, eventAddress }: Props) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("main");

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

  const tabs = [
    { key: "main", icon: Home, label: "Main" },
    { key: "lodging", icon: Bed, label: "Lodging" },
    { key: "transport", icon: Car, label: "Transportation" },
    { key: "more", icon: MoreHorizontal, label: "More" },
  ];

  const tabBtnClass = (key: string) =>
    `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
      activeTab === key ? "text-white font-medium shadow-lg" : "hover:bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    }`;

  const tabBtnStyle = (key: string) =>
    activeTab === key ? {
      background: theme === "dark"
        ? "linear-gradient(135deg, hsl(38, 65%, 55%), hsl(38, 65%, 40%))"
        : "#000000",
    } : undefined;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[var(--accent)] rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={tabBtnClass(tab.key)}
            style={tabBtnStyle(tab.key)}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main tab */}
      {activeTab === "main" && (
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              Cost
            </label>
            <input value={details.cost} onChange={(e) => update("cost", e.target.value)} className={inputClass} placeholder="e.g. Free, $25 per person, $50 per family" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Shirt className="w-3.5 h-3.5 text-purple-400" />
              Dress Code
            </label>
            <input value={details.dress_code} onChange={(e) => update("dress_code", e.target.value)} className={inputClass} placeholder="e.g. Casual, Semi-formal, White attire" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Websites
            </label>
            <div className="space-y-2">
              {details.websites.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <input value={w.label} onChange={(e) => updateWebsite(i, "label", e.target.value)} className={inputClass} placeholder="Label (e.g. Hotel, Venue)" style={{ width: "35%" }} />
                  <input value={w.url} onChange={(e) => updateWebsite(i, "url", e.target.value)} className={`${inputClass} flex-1`} placeholder="https://..." />
                  <button type="button" onClick={() => removeWebsite(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addWebsite} className="flex items-center gap-1.5 text-xs text-gold-500 hover:text-gold-400 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add website
              </button>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
              <Phone className="w-3.5 h-3.5 text-orange-400" />
              Contact Information
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input value={details.contact_name} onChange={(e) => update("contact_name", e.target.value)} className={inputClass} placeholder="Contact name" />
              <input value={details.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} className={inputClass} placeholder="Phone number" />
              <input value={details.contact_email} onChange={(e) => update("contact_email", e.target.value)} className={inputClass} placeholder="Email address" />
              <input value={details.contact_address} onChange={(e) => update("contact_address", e.target.value)} className={inputClass} placeholder="Contact address" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              Additional Notes
            </label>
            <textarea value={details.additional_notes} onChange={(e) => update("additional_notes", e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Anything else attendees should know..." />
          </div>
        </div>
      )}

      {/* Lodging tab */}
      {activeTab === "lodging" && (
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Bed className="w-3.5 h-3.5 text-indigo-400" />
              Hotel / Lodging Name
            </label>
            <input value={details.lodging_hotel} onChange={(e) => update("lodging_hotel", e.target.value)} className={inputClass} placeholder="e.g. Marriott Downtown, Aunt Carol's House" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={details.lodging_same_address}
                onChange={(e) => {
                  update("lodging_same_address", e.target.checked);
                  if (e.target.checked && eventAddress) update("lodging_address", eventAddress);
                }}
                className="rounded border-[var(--input)] accent-gold-500"
              />
              Same address as event
            </label>
            {!details.lodging_same_address && (
              <div>
                <label className="text-sm font-medium mb-1 block">Address</label>
                <input value={details.lodging_address} onChange={(e) => update("lodging_address", e.target.value)} className={inputClass} placeholder="Full address" />
              </div>
            )}
            {details.lodging_same_address && eventAddress && (
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Using event address: {eventAddress}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <input value={details.lodging_phone} onChange={(e) => update("lodging_phone", e.target.value)} className={inputClass} placeholder="Hotel phone number" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Website</label>
              <input value={details.lodging_website} onChange={(e) => update("lodging_website", e.target.value)} className={inputClass} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Check-in</label>
              <input value={details.lodging_checkin} onChange={(e) => update("lodging_checkin", e.target.value)} className={inputClass} placeholder="e.g. 3:00 PM, Friday March 14" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Check-out</label>
              <input value={details.lodging_checkout} onChange={(e) => update("lodging_checkout", e.target.value)} className={inputClass} placeholder="e.g. 11:00 AM, Sunday March 16" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rate / Cost</label>
            <input value={details.lodging_rate} onChange={(e) => update("lodging_rate", e.target.value)} className={inputClass} placeholder="e.g. $129/night, Group rate code: FAMILY2026" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={details.lodging_has_shuttle}
                onChange={(e) => update("lodging_has_shuttle", e.target.checked)}
                className="rounded border-[var(--input)] accent-gold-500"
              />
              Shuttle service available
            </label>
            {details.lodging_has_shuttle && (
              <div className="mt-2">
                <input value={details.lodging_shuttle_info} onChange={(e) => update("lodging_shuttle_info", e.target.value)} className={inputClass} placeholder="e.g. Free airport shuttle every 30 min, call front desk" />
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Lodging Notes</label>
            <textarea value={details.lodging_notes} onChange={(e) => update("lodging_notes", e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Reservation details, block code, amenities, parking at hotel..." />
          </div>
        </div>
      )}

      {/* Transportation tab */}
      {activeTab === "transport" && (
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              Nearby Airports
            </label>
            <AirportPicker
              value={details.transport_airports}
              onChange={(val) => update("transport_airports", val)}
              eventLat={eventLat}
              eventLon={eventLon}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Car Rental Info</label>
            <input value={details.transport_rental} onChange={(e) => update("transport_rental", e.target.value)} className={inputClass} placeholder="e.g. Enterprise at airport, discount code: FAM2026" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Parking Info</label>
            <input value={details.transport_parking} onChange={(e) => update("transport_parking", e.target.value)} className={inputClass} placeholder="e.g. Free parking at venue, street parking available" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rideshare / Taxi</label>
            <input value={details.transport_rideshare} onChange={(e) => update("transport_rideshare", e.target.value)} className={inputClass} placeholder="e.g. Uber/Lyft available, ~$25 from airport" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Shuttle / Group Transport</label>
            <input value={details.transport_shuttle} onChange={(e) => update("transport_shuttle", e.target.value)} className={inputClass} placeholder="e.g. Hotel shuttle from airport, van pickup at 2 PM" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Transportation Notes</label>
            <textarea value={details.transport_notes} onChange={(e) => update("transport_notes", e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Directions, carpool coordination, etc." />
          </div>
        </div>
      )}

      {/* More tab */}
      {activeTab === "more" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">What to Bring</label>
            <input value={details.more_what_to_bring} onChange={(e) => update("more_what_to_bring", e.target.value)} className={inputClass} placeholder="e.g. Swimsuit, sunscreen, a dish to share" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Dietary Info / Food</label>
            <input value={details.more_dietary} onChange={(e) => update("more_dietary", e.target.value)} className={inputClass} placeholder="e.g. Catered BBQ, vegetarian options available" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Kids / Childcare</label>
            <input value={details.more_kids} onChange={(e) => update("more_kids", e.target.value)} className={inputClass} placeholder="e.g. Kid-friendly, babysitter available, bring games" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Pets</label>
            <input value={details.more_pets} onChange={(e) => update("more_pets", e.target.value)} className={inputClass} placeholder="e.g. No pets allowed, dogs welcome in outdoor area" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Other Notes</label>
            <textarea value={details.more_notes} onChange={(e) => update("more_notes", e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Anything else..." />
          </div>
        </div>
      )}
    </div>
  );
}
