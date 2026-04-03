import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Upload, X, ChevronLeft, ChevronRight, ArrowLeft, Trash2, ImageIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { uploadAlbumMedia } from "@/services/storage";
import type { Album, AlbumMedia } from "@/lib/types";
import { DeleteConfirmModal } from "@/components/shared/delete-confirm-modal";

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myMembership } = useFamily();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<AlbumMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pickingCover, setPickingCover] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  useEffect(() => {
    if (albumId && user) loadAlbum();
  }, [albumId, user]);

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

    if (albumRes.error) console.error("Album load error:", albumRes.error);
    if (mediaRes.error) console.error("Media load error:", mediaRes.error);

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

  async function handleSetCover(mediaUrl: string) {
    if (!album) return;
    await supabase.from("albums").update({ cover_url: mediaUrl }).eq("id", album.id);
    setAlbum({ ...album, cover_url: mediaUrl });
    setPickingCover(false);
  }

  async function handleDeletePhoto(mediaId: string) {
    await supabase.from("album_media").delete().eq("id", mediaId);
    // If deleted photo was the cover, clear it
    const deleted = media.find((m) => m.id === mediaId);
    if (deleted && album?.cover_url === deleted.media_url) {
      await supabase.from("albums").update({ cover_url: null }).eq("id", album.id);
    }
    setShowDeletePhotoModal(false);
    // Adjust viewer index
    if (viewerIndex !== null) {
      if (media.length <= 1) {
        setViewerIndex(null);
      } else if (viewerIndex >= media.length - 1) {
        setViewerIndex(media.length - 2);
      }
    }
    await loadAlbum();
  }

  async function handleDeleteAlbum() {
    if (!album) return;
    await supabase.from("albums").delete().eq("id", album.id);
    navigate("/photos");
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

  const isCreator = album.created_by === user?.id;
  const isAdmin = myMembership?.role === "admin";
  const canDeletePhotos = isCreator || isAdmin;

  return (
    <div
      className="max-w-5xl mx-auto space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--card)] border-2 border-dashed border-gold-500 rounded-2xl p-12 text-center">
            <Upload className="w-16 h-16 text-gold-500 mx-auto" />
            <p className="mt-4 text-lg font-medium text-gold-500">Drop photos to upload</p>
          </div>
        </div>
      )}
      {/* Back button */}
      <button
        onClick={() => navigate("/photos")}
        className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Photos
      </button>

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload Photos"}
          </button>
          {isCreator && media.length > 0 && (
            <button
              onClick={() => setPickingCover(!pickingCover)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                pickingCover
                  ? "border-gold-500 bg-gold-500/10 text-gold-500"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-gold-500/50"
              }`}
              title="Set album cover image"
            >
              <ImageIcon className="w-4 h-4" />
              {pickingCover ? "Click a photo" : "Set Cover"}
            </button>
          )}
          {isCreator && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors cursor-pointer"
              title="Delete album"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
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
          className={`bg-[var(--card)] rounded-lg border-2 border-dashed p-16 text-center cursor-pointer transition-colors ${
            dragging ? "border-gold-500 bg-gold-500/5" : "border-[var(--border)] hover:border-gold-500/30"
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className={`w-12 h-12 mx-auto ${dragging ? "text-gold-500" : "text-[var(--muted-foreground)]"}`} />
          <p className={`mt-4 ${dragging ? "text-gold-500" : "text-[var(--muted-foreground)]"}`}>
            Click or drag photos here to upload
          </p>
        </div>
      ) : (
        <>
        {pickingCover && (
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg px-4 py-2 text-sm text-gold-500 flex items-center gap-2 mb-3">
            <ImageIcon className="w-4 h-4" />
            Click a photo to set it as the album cover
          </div>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {media.map((item, index) => (
            <div
              key={item.id}
              onClick={() => pickingCover ? handleSetCover(item.media_url) : setViewerIndex(index)}
              className={`aspect-square rounded-md overflow-hidden cursor-pointer transition-all bg-black/20 relative ${
                pickingCover
                  ? "hover:ring-2 hover:ring-gold-500 hover:opacity-100"
                  : "hover:opacity-90"
              } ${album?.cover_url === item.media_url ? "ring-2 ring-gold-500" : ""}`}
            >
              <img
                src={item.media_url}
                alt={item.caption || ""}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {album?.cover_url === item.media_url && (
                <div className="absolute top-1 left-1 bg-gold-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  COVER
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      {/* Lightbox */}
      {viewerIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setViewerIndex(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {canDeletePhotos && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeletePhotoModal(true);
                }}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition-colors"
                title="Delete photo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(null);
              }}
              className="p-2 text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

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

      {/* Delete photo confirmation modal */}
      {viewerIndex !== null && (
        <DeleteConfirmModal
          isOpen={showDeletePhotoModal}
          onClose={() => setShowDeletePhotoModal(false)}
          onConfirm={() => handleDeletePhoto(media[viewerIndex].id)}
          title="Delete Photo"
          itemName="DELETE"
          description="This will permanently remove this photo from the album. This action cannot be undone."
          confirmLabel="Delete Photo"
        />
      )}

      {/* Delete album confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAlbum}
        title="Delete Album"
        itemName={album.title}
        description={`This will permanently delete "${album.title}" and all ${media.length} photo${media.length !== 1 ? "s" : ""} in it. This action cannot be undone.`}
      />
    </div>
  );
}
