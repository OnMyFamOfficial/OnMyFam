import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Image } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import type { Album, Profile } from "@/lib/types";

type FullAlbum = Album & { creator: Profile };

export default function PhotosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const [albums, setAlbums] = useState<FullAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  useEffect(() => {
    if (currentFamily) loadAlbums();
  }, [currentFamily]);

  async function loadAlbums() {
    if (!currentFamily) return;
    setLoading(true);

    const { data } = await supabase
      .from("albums")
      .select("*, creator:profiles!albums_created_by_fkey(*)")
      .eq("family_id", currentFamily.id)
      .order("created_at", { ascending: false });

    setAlbums((data as FullAlbum[]) || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!user || !currentFamily || !form.title.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("albums")
      .insert({
        family_id: currentFamily.id,
        created_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      navigate(`/photos/${data.id}`);
    }
    setSaving(false);
  }

  if (!currentFamily) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-[var(--muted-foreground)]">Create or join a family first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Album
        </button>
      </div>

      {creating && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create Album</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="Summer Reunion 2026"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating..." : "Create Album"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setForm({ title: "", description: "" });
              }}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Loading albums...
        </div>
      ) : albums.length === 0 ? (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
          <div className="text-5xl mb-4">&#x1F4F7;</div>
          <h2 className="text-xl font-semibold">No albums yet</h2>
          <p className="text-[var(--muted-foreground)] mt-2">
            Create an album and start sharing family photos!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <div
              key={album.id}
              onClick={() => navigate(`/photos/${album.id}`)}
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden cursor-pointer hover:border-gold-500/30 transition-colors"
            >
              {album.cover_url ? (
                <img
                  src={album.cover_url}
                  alt=""
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-gold-600/20 to-gold-400/20 flex items-center justify-center">
                  <Image className="w-10 h-10 text-gold-500/30" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold truncate">{album.title}</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {album.media_count} photo{album.media_count !== 1 ? "s" : ""}{" "}
                  &middot; by {album.creator?.display_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
