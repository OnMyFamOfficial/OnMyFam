import { supabase } from "@/lib/supabase";

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "0",
  });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  return uploadFile("avatars", path, file);
}

export async function uploadCover(
  _entityType: "family" | "event" | "album",
  entityId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${entityId}/cover-${Date.now()}.${ext}`;
  return uploadFile("covers", path, file);
}

export async function uploadPostMedia(
  postId: string,
  file: File,
  index: number
): Promise<string | null> {
  // Handle clipboard-pasted files that may lack proper names/extensions
  let ext = file.name?.split(".").pop();
  if (!ext || ext === file.name) {
    // No extension found, derive from MIME type
    const mimeMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm",
    };
    ext = mimeMap[file.type] || "bin";
  }
  const path = `${postId}/${index}.${ext}`;
  return uploadFile("posts", path, file);
}

export async function uploadAlbumMedia(
  albumId: string,
  file: File,
  filename: string
): Promise<string | null> {
  const path = `${albumId}/${filename}`;
  return uploadFile("albums", path, file);
}
