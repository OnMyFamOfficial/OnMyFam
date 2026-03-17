import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Upload, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { uploadAlbumMedia } from "@/services/storage";
import type { Album, AlbumMedia } from "@/lib/types";

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<AlbumMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (albumId) loadAlbum();
  }, [albumId]);

  async function loadAlbum() {
    if (!albumId) return;
    setLoading(true);

    const [albumRes, mediaRes] = await Promise.all([
      supabase.from("albums").select("*").eq("id", albumId).single(),
      supabase
        .from("album_media")
        .select("*")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false }),
    ]);

    setAlbum(albumRes.data as Album);
    setMedia((mediaRes.data as AlbumMedia[]) || []);
    setLoading(false);
  }

  async function handleUpload(files: FileList) {
    if (!user || !albumId) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const filename = `${Date.now()}-${file.name}`;
      const url = await uploadAlbumMedia(albumId, file, filename);
      if (url) {
        await supabase.from("album_media").insert({
          album_id: albumId,
          uploaded_by: user.id,
          media_url: url,
          media_type: file.type.startsWith("video") ? "video" : "image",
        });
      }
    }

    setUploading(false);
    await loadAlbum();
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Loading album...
      </div>
    );
  }

  if (!album) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Album not found
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{album.title}</h1>
          {album.description && (
            <p className="text-[var(--muted-foreground)]">
              {album.description}
            </p>
          )}
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {media.length} photo{media.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload Photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
          }}
          className="hidden"
        />
      </div>

      {/* Photo grid */}
      {media.length === 0 ? (
        <div
          className="bg-[var(--card)] rounded-lg border-2 border-dashed border-[var(--border)] p-16 text-center cursor-pointer hover:border-gold-500/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-[var(--muted-foreground)] mx-auto" />
          <p className="mt-4 text-[var(--muted-foreground)]">
            Click or drag photos here to upload
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {media.map((item, index) => (
            <div
              key={item.id}
              onClick={() => setViewerIndex(index)}
              className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img
                src={item.media_url}
                alt={item.caption || ""}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {viewerIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setViewerIndex(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewerIndex(null);
            }}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>

          {viewerIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(viewerIndex - 1);
              }}
              className="absolute left-4 p-2 text-white hover:bg-white/10 rounded-full"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          <img
            src={media[viewerIndex].media_url}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {viewerIndex < media.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(viewerIndex + 1);
              }}
              className="absolute right-4 p-2 text-white hover:bg-white/10 rounded-full"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="absolute bottom-4 text-white text-sm">
            {viewerIndex + 1} / {media.length}
          </div>
        </div>
      )}
    </div>
  );
}
