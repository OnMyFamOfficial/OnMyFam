/**
 * Sanitize user input to prevent XSS attacks.
 * Strips HTML tags and encodes dangerous characters.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize for display - decode back for rendering as text content.
 * React's JSX already escapes text content, so this is mainly for
 * content that goes into attributes or dangerouslySetInnerHTML.
 */
export function sanitizeForStorage(input: string): string {
  // Strip any HTML tags entirely
  const stripped = input.replace(/<[^>]*>/g, "");
  // Remove any script-like patterns
  return stripped
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:\s*text\/html/gi, "");
}

/**
 * Validate file type against allowed MIME types.
 */
export function isAllowedFileType(file: File, allowed: string[]): boolean {
  return allowed.some((type) => {
    if (type.endsWith("/*")) {
      return file.type.startsWith(type.replace("/*", "/"));
    }
    return file.type === type;
  });
}

/**
 * Validate file size (in bytes).
 */
export function isAllowedFileSize(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  if (file.type.startsWith("image/")) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: `Image type ${file.type} not allowed. Use JPEG, PNG, GIF, or WebP.` };
    }
    if (!isAllowedFileSize(file, MAX_IMAGE_SIZE)) {
      return { valid: false, error: "Image must be under 10MB." };
    }
  } else if (file.type.startsWith("video/")) {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return { valid: false, error: `Video type ${file.type} not allowed. Use MP4, WebM, or MOV.` };
    }
    if (!isAllowedFileSize(file, MAX_VIDEO_SIZE)) {
      return { valid: false, error: "Video must be under 100MB." };
    }
  } else {
    return { valid: false, error: "Only image and video files are allowed." };
  }
  return { valid: true };
}
