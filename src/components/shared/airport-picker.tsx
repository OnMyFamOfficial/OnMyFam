import { useState, useMemo, useRef, useEffect } from "react";
import { Plane, X, ChevronDown } from "lucide-react";
import { US_AIRPORTS } from "@/lib/airports";

interface Props {
  value: string;
  onChange: (val: string) => void;
  eventLat?: number | null;
  eventLon?: number | null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function AirportPicker({ value, onChange, eventLat, eventLon }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Parse current selected codes
  const selectedCodes = useMemo(() => {
    if (!value) return [];
    return value.split(",").map((s) => s.trim().split(" ")[0].replace(/[()]/g, "")).filter(Boolean);
  }, [value]);

  // Sort airports by distance if we have coordinates
  const sortedAirports = useMemo(() => {
    if (eventLat != null && eventLon != null) {
      return [...US_AIRPORTS]
        .map((a) => ({ ...a, dist: haversineDistance(eventLat, eventLon, a.lat, a.lon) }))
        .sort((a, b) => a.dist - b.dist);
    }
    return US_AIRPORTS.map((a) => ({ ...a, dist: null as number | null }));
  }, [eventLat, eventLon]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return sortedAirports.slice(0, 20);
    const q = search.toLowerCase();
    return sortedAirports.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.state.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [sortedAirports, search]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleAirport(code: string) {
    const airport = US_AIRPORTS.find((a) => a.code === code);
    if (!airport) return;
    const label = `${code} (${airport.city})`;
    if (selectedCodes.includes(code)) {
      // Remove
      const parts = value.split(",").map((s) => s.trim()).filter((s) => !s.startsWith(code));
      onChange(parts.join(", "));
    } else {
      // Add
      onChange(value ? `${value}, ${label}` : label);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 min-h-[38px]"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedCodes.length > 0 ? (
            selectedCodes.map((code) => {
              return (
                <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-500 text-xs font-medium">
                  {code}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAirport(code); }}
                    className="hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-[var(--muted-foreground)]">Select nearby airports...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, city, or name..."
              className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--muted-foreground)] text-center">No airports found</div>
            ) : (
              filtered.map((airport) => {
                const isSelected = selectedCodes.includes(airport.code);
                return (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => toggleAirport(airport.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                      isSelected ? "bg-gold-500/10" : "hover:bg-[var(--accent)]"
                    }`}
                  >
                    <Plane className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-gold-500" : "text-[var(--muted-foreground)]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${isSelected ? "text-gold-500" : ""}`}>{airport.code}</span>
                        <span className="truncate">{airport.city}, {airport.state}</span>
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{airport.name}</div>
                    </div>
                    {airport.dist != null && (
                      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 font-mono">
                        {airport.dist < 100 ? `${Math.round(airport.dist)} mi` : `${Math.round(airport.dist)} mi`}
                      </span>
                    )}
                    {isSelected && <span className="text-gold-500 text-xs font-bold flex-shrink-0">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
