import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Camera, MapPin, Phone, ImagePlus, Calendar, Shield, User, Users, Heart, X } from "lucide-react";
import { sanitizeForStorage } from "@/lib/sanitize";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { uploadAvatar, uploadCover } from "@/services/storage";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Profile } from "@/lib/types";

// Fix Leaflet default marker icon issue with bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const goldIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ProfileMapAndDetails({ profile: p }: { profile: Profile }) {
  const { members } = useFamily();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showFamily, setShowFamily] = useState(false);
  const [familyMarkers, setFamilyMarkers] = useState<{ name: string; avatar: string | null; lat: number; lon: number }[]>([]);
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());

  // Geocode the profile location
  useEffect(() => {
    if (!p.location) return;
    let cancelled = false;
    async function geocode() {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(p.location!)}&limit=1`);
        const data = await res.json();
        if (!cancelled && data.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        }
      } catch { /* silent */ }
    }
    geocode();
    return () => { cancelled = true; };
  }, [p.location]);

  // Geocode family members when toggle is on
  useEffect(() => {
    if (!showFamily || members.length === 0) { setFamilyMarkers([]); return; }
    let cancelled = false;
    async function geocodeFamily() {
      // Get profiles for all members
      const userIds = members.map((m) => m.user_id).filter((id) => id !== p.id);
      if (userIds.length === 0) return;
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      if (!profiles || cancelled) return;

      const withLocation = profiles.filter((pr) => pr.location);
      const results: { name: string; avatar: string | null; lat: number; lon: number }[] = [];

      for (const pr of withLocation) {
        try {
          // Rate limit: Nominatim requires 1 req/sec
          await new Promise((r) => setTimeout(r, 1100));
          if (cancelled) return;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pr.location)}&limit=1`);
          const data = await res.json();
          if (data.length > 0) {
            results.push({ name: pr.display_name, avatar: pr.avatar_url, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        } catch { /* skip */ }
      }
      if (!cancelled) setFamilyMarkers(results);
    }
    geocodeFamily();
    return () => { cancelled = true; };
  }, [showFamily, members, p.id]);

  const details = [
    p.display_name && { icon: User, label: "Name", value: p.display_name },
    p.location && { icon: MapPin, label: "Location", value: p.location },
    p.phone && { icon: Phone, label: "Phone", value: p.phone },
    p.date_of_birth && { icon: Calendar, label: "Birthday", value: new Date(p.date_of_birth).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) },
    p.privacy_level && { icon: Shield, label: "Privacy", value: p.privacy_level.charAt(0).toUpperCase() + p.privacy_level.slice(1) },
    { icon: Calendar, label: "Joined", value: new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Details card */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden lg:min-h-[500px]">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <span className="font-semibold text-sm">About</span>
        </div>
        <div className="p-4 space-y-3">
          {p.bio && (
            <p className="text-sm text-[var(--muted-foreground)] italic mb-4">{p.bio}</p>
          )}
          {details.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <d.icon className="w-4 h-4 text-gold-500 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)]">{d.label}</p>
                <p className="text-sm font-medium">{d.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map card */}
      {coords && (
        <div className="lg:col-span-2 bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gold-500" />
              <span className="font-semibold text-sm">{p.location}</span>
            </div>
            <button
              onClick={() => setShowFamily(!showFamily)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                showFamily ? "bg-gold-500 text-white" : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Family Map
            </button>
          </div>
          <div style={{ height: 450 }}>
            <MapContainer
              center={[coords.lat, coords.lon]}
              zoom={showFamily && familyMarkers.length > 0 ? 4 : 4}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup
                showCoverageOnHover={false}
                maxClusterRadius={40}
                spiderfyOnMaxZoom={true}
                iconCreateFunction={(cluster: any) => {
                  const count = cluster.getChildCount();
                  return L.divIcon({
                    html: `<div style="background:linear-gradient(135deg,#b8860b,#daa520);color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid white;">${count}</div>`,
                    className: "",
                    iconSize: L.point(36, 36),
                    iconAnchor: L.point(18, 18),
                  });
                }}
              >
                {/* Profile owner marker */}
                {!hiddenMembers.has(p.display_name) && (
                  <Marker position={[coords.lat, coords.lon]} icon={goldIcon}>
                    <Tooltip direction="top" offset={[0, -35]} permanent className="leaflet-name-tooltip">
                      {p.display_name}
                    </Tooltip>
                    <Popup>
                      <div className="text-center">
                        <strong>{p.display_name}</strong>
                        <br />
                        <span className="text-xs">{p.location}</span>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Family member markers */}
                {showFamily && familyMarkers.filter((fm) => !hiddenMembers.has(fm.name)).map((fm, i) => (
                  <Marker key={i} position={[fm.lat, fm.lon]} icon={defaultIcon}>
                    <Tooltip direction="top" offset={[0, -35]} permanent className="leaflet-name-tooltip">
                      {fm.name}
                    </Tooltip>
                    <Popup>
                      <div className="text-center">
                        <strong>{fm.name}</strong>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
          {showFamily && familyMarkers.length === 0 && members.length > 1 && (
            <div className="px-4 py-2 text-xs text-[var(--muted-foreground)] text-center">
              Loading family locations...
            </div>
          )}
          {showFamily && familyMarkers.length > 0 && (
            <div className="px-4 py-3 border-t border-[var(--border)]">
              <p className="text-[11px] text-[var(--muted-foreground)] mb-2">Family members on map:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setHiddenMembers((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.display_name)) next.delete(p.display_name); else next.add(p.display_name);
                    return next;
                  })}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-opacity ${
                    hiddenMembers.has(p.display_name) ? "opacity-40 bg-gold-500/10 text-gold-500/50" : "bg-gold-500/20 text-gold-500"
                  }`}
                >
                  <MapPin className="w-3 h-3" /> {p.display_name} (You)
                </button>
                {familyMarkers.map((fm, i) => (
                  <button
                    key={i}
                    onClick={() => setHiddenMembers((prev) => {
                      const next = new Set(prev);
                      if (next.has(fm.name)) next.delete(fm.name); else next.add(fm.name);
                      return next;
                    })}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-opacity ${
                      hiddenMembers.has(fm.name) ? "opacity-40 bg-sky-500/10 text-sky-400/50" : "bg-sky-500/20 text-sky-400"
                    }`}
                  >
                    <MapPin className="w-3 h-3" /> {fm.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const { user, profile: myProfile, updateProfile } = useAuth();
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // If viewing someone else's profile
  const isOwnProfile = !userId || userId === user?.id;
  const profile = isOwnProfile ? myProfile : viewingProfile;

  useEffect(() => {
    if (userId && userId !== user?.id) {
      setLoadingProfile(true);
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
        .then(({ data }) => {
          setViewingProfile(data as Profile | null);
          setLoadingProfile(false);
        });
    }
  }, [userId, user?.id]);

  const [editing, setEditing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: profile?.display_name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    phone: profile?.phone || "",
  });
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Incoming relation requests (only on own profile)
  const [profileRelationRequests, setProfileRelationRequests] = useState<any[]>([]);
  useEffect(() => {
    if (!user || !isOwnProfile) return;
    async function loadRequests() {
      const { data } = await supabase
        .from("relation_requests")
        .select("*")
        .eq("to_user_id", user!.id)
        .eq("status", "pending");
      if (!data || data.length === 0) { setProfileRelationRequests([]); return; }
      const senderIds = data.map((r) => r.from_user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", senderIds);
      const pm = new Map<string, any>();
      for (const p of profiles || []) pm.set(p.id, p);
      setProfileRelationRequests(data.map((r) => ({ ...r, sender: pm.get(r.from_user_id) })));
    }
    loadRequests();
  }, [user, isOwnProfile]);

  function startEditing() {
    setForm({
      display_name: profile?.display_name || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      phone: profile?.phone || "",
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setCoverPreview(null);
    setCoverFile(null);
    setEditing(true);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const updates: Record<string, string | null> = {
      display_name: sanitizeForStorage(form.display_name),
      bio: form.bio ? sanitizeForStorage(form.bio) : null,
      location: form.location ? sanitizeForStorage(form.location) : null,
      phone: form.phone ? sanitizeForStorage(form.phone) : null,
    };

    if (avatarFile) {
      const url = await uploadAvatar(user.id, avatarFile);
      if (url) updates.avatar_url = url;
    }

    if (coverFile) {
      const url = await uploadCover("family", user.id, coverFile);
      if (url) updates.cover_url = url;
    }

    await updateProfile(updates);
    setSaving(false);
    setEditing(false);
  }

  function bustCache(url: string | null | undefined) {
    if (!url) return null;
    const base = url.split("?")[0];
    return `${base}?t=${Date.now()}`;
  }
  const displayAvatar = avatarPreview || bustCache(profile?.avatar_url);
  const displayCover = coverPreview || bustCache(profile?.cover_url);

  if (loadingProfile) {
    return <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)]">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)]">Profile not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile header — full width */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        {/* Cover photo with black surround */}
        <div className="p-3 rounded-t-2xl bg-[var(--card)]">
          <div className="relative h-72 sm:h-80 lg:h-88 group rounded-2xl overflow-hidden">
            {displayCover ? (
              <img
                src={displayCover}
                alt="Cover"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => !editing && setLightboxImage(displayCover)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-gold-700 via-gold-500 to-gold-400" />
            )}
            {isOwnProfile && editing && (
              <button
                onClick={() => coverRef.current?.click()}
                className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
                  <ImagePlus className="w-5 h-5" />
                  Change Cover Photo
                </div>
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />

            {/* Avatar — inside cover, vertically centered, left gap = vertical gap */}
            <div className="absolute top-1/2 -translate-y-1/2 left-[5px] sm:left-[13px] lg:left-[21px]">
              <div className="relative group">
                <div className="rounded-2xl bg-[var(--background)] border-4 border-white/20 flex items-center justify-center overflow-hidden shadow-lg" style={{ width: 310, height: 310 }}>
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={profile?.display_name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => !editing && setLightboxImage(displayAvatar)}
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gold-500">
                      {profile?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                {isOwnProfile && editing && (
                  <button
                    onClick={() => avatarRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-7 h-7 text-white" />
                  </button>
                )}
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Profile info */}
        <div className="pb-6">
          {/* Name + Edit button row — tops aligned */}
          {!editing && !loadingProfile && (
            <div className="flex items-start pt-3 px-6 lg:px-8">
              <div className="ml-[calc(21px-24px)] sm:ml-[calc(37px-24px)] lg:ml-[calc(53px-32px)] w-[270px] text-left">
                <h1 className="text-3xl font-bold">
                  {profile?.display_name || "Family Member"}
                </h1>
                {profile?.bio && (
                  <p className="mt-1 text-[var(--muted-foreground)] text-base">
                    {profile.bio}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap justify-start items-center gap-3 text-sm text-[var(--muted-foreground)]">
                  {profile?.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </span>
                  )}
                  {profile?.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      {profile.phone}
                    </span>
                  )}
                </div>
              </div>
              {isOwnProfile && (
                <div className="ml-auto">
                  <button
                    onClick={startEditing}
                    className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          )}

          {isOwnProfile && editing && (
            <div className="mt-4 space-y-4 max-w-xl px-6 lg:px-8">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Display Name
                </label>
                <input
                  value={form.display_name}
                  onChange={(e) =>
                    setForm({ ...form, display_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                  placeholder="Tell your family about yourself..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Location
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    placeholder="City, State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Incoming relation requests */}
      {isOwnProfile && profileRelationRequests.length > 0 && (
        <div className="bg-[var(--card)] rounded-2xl border border-gold-500/30 p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-gold-500" />
            Pending Relation Requests ({profileRelationRequests.length})
          </h3>
          <div className="space-y-2">
            {profileRelationRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--accent)]">
                <div className="w-9 h-9 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {req.sender?.avatar_url ? (
                    <img src={req.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">{req.sender?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{req.sender?.display_name}</span>
                    {" "}says you are their{" "}
                    <span className="text-gold-500 font-medium">{req.relation_label}</span>
                    {req.reverse_label && <> and they are your <span className="text-gold-500 font-medium">{req.reverse_label}</span></>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      await supabase.rpc("approve_relation_request", { request_id: req.id });
                      setProfileRelationRequests((prev) => prev.filter((r) => r.id !== req.id));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("relation_requests").update({ status: "rejected" }).eq("id", req.id);
                      setProfileRelationRequests((prev) => prev.filter((r) => r.id !== req.id));
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details & Map */}
      {profile && <ProfileMapAndDetails profile={profile} />}

      {/* Image lightbox */}
      {lightboxImage && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/90" onClick={() => setLightboxImage(null)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
            <img
              src={lightboxImage}
              alt=""
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
