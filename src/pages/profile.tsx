import { useState, useRef } from "react";
import { Camera, MapPin, Phone, ImagePlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { uploadAvatar, uploadCover } from "@/services/storage";

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
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
    const updates: Record<string, string | null> = { ...form };

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

  const displayAvatar = avatarPreview || profile?.avatar_url;
  const displayCover =
    coverPreview || (profile as any)?.cover_url || null;

  return (
    <div className="space-y-6">
      {/* Profile header — full width */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        {/* Cover photo with black surround */}
        <div className="p-3 rounded-t-2xl bg-[var(--cover-surround)]">
          <div className="relative h-72 sm:h-80 lg:h-88 group rounded-2xl overflow-hidden">
            {displayCover ? (
              <img
                src={displayCover}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-gold-700 via-gold-500 to-gold-400" />
            )}
            {editing && (
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
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gold-500">
                      {profile?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                {editing && (
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
          {!editing && (
            <div className="flex items-start pt-3 px-6 lg:px-8">
              <div className="ml-[calc(21px-24px)] sm:ml-[calc(37px-24px)] lg:ml-[calc(53px-32px)] w-[270px] text-center">
                <h1 className="text-3xl font-bold">
                  {profile?.display_name || "Family Member"}
                </h1>
                {profile?.bio && (
                  <p className="mt-1 text-[var(--muted-foreground)] text-base">
                    {profile.bio}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap justify-center items-center gap-3 text-sm text-[var(--muted-foreground)]">
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
              <div className="ml-auto">
                <button
                  onClick={startEditing}
                  className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}

          {editing && (
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
    </div>
  );
}
