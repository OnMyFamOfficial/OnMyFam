import { supabase } from "@/lib/supabase";

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
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
  const path = `${userId}/avatar.${ext}`;
  return uploadFile("avatars", path, file);
}

export async function uploadCover(
  _entityType: "family" | "event" | "album",
  entityId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${entityId}/cover.${ext}`;
  return uploadFile("covers", path, file);
}

export async function uploadPostMedia(
  postId: string,
  file: File,
  index: number
): Promise<string | null> {
  const ext = file.name.split(".").pop();
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
