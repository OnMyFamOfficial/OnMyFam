// Supabase typed client helper — using Record<string, unknown> for
// Insert/Update to avoid complex Omit generics resolving to `never`.
// Row types still provide full type-safety on selects.
type TableDef<R> = {
  Row: R;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      families: TableDef<Family>;
      family_members: TableDef<FamilyMember>;
      posts: TableDef<Post>;
      post_media: TableDef<PostMedia>;
      post_reactions: TableDef<PostReaction>;
      comments: TableDef<Comment>;
      comment_likes: TableDef<CommentLike>;
      events: TableDef<FamilyEvent>;
      event_rsvps: TableDef<EventRsvp>;
      event_chat_messages: TableDef<EventChatMessage>;
      albums: TableDef<Album>;
      album_media: TableDef<AlbumMedia>;
      media_tags: TableDef<MediaTag>;
      discussions: TableDef<Discussion>;
      discussion_replies: TableDef<DiscussionReply>;
      invites: TableDef<Invite>;
      notifications: TableDef<Notification>;
      conversations: TableDef<Conversation>;
      conversation_participants: TableDef<ConversationParticipant>;
      messages: TableDef<Message>;
      message_read_receipts: TableDef<MessageReadReceipt>;
      video_calls: TableDef<VideoCall>;
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  phone: string | null;
  location: string | null;
  privacy_level: "public" | "family" | "private";
  is_god_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  established_year: number | null;
  privacy_level: "private" | "invite_only" | "public";
  member_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  relation_label: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface Post {
  id: string;
  family_id: string;
  author_id: string;
  content: string;
  privacy_level: "family" | "specific_members" | "public";
  is_pinned: boolean;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
  media?: PostMedia[];
  reactions?: PostReaction[];
  comments?: Comment[];
}

export interface PostMedia {
  id: string;
  post_id: string;
  media_url: string;
  media_type: "image" | "video";
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: "like" | "love" | "celebrate" | "hug" | "laugh";
  created_at: string;
  user?: Profile;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
  replies?: Comment[];
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface FamilyEvent {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  status: "upcoming" | "ongoing" | "past" | "cancelled";
  going_count: number;
  maybe_count: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  rsvps?: EventRsvp[];
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: "going" | "maybe" | "cant_make_it";
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface EventChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: Profile;
}

export interface Album {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  privacy_level: "family" | "specific_members";
  allow_download: boolean;
  media_count: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface AlbumMedia {
  id: string;
  album_id: string;
  uploaded_by: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  taken_at: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface MediaTag {
  id: string;
  media_id: string;
  media_source: "post" | "album";
  tagged_user_id: string;
  x_position: number;
  y_position: number;
  created_at: string;
  tagged_user?: Profile;
}

export interface Discussion {
  id: string;
  family_id: string;
  author_id: string;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface DiscussionReply {
  id: string;
  discussion_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Invite {
  id: string;
  family_id: string;
  created_by: string;
  token: string;
  email: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  family_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  actor_id: string | null;
  created_at: string;
  actor?: Profile;
}

// ============================================================
// Chat & Video Calling Types
// ============================================================

export interface Conversation {
  id: string;
  family_id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  last_read_at: string;
  joined_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: "text" | "image" | "video" | "file" | "system";
  media_url: string | null;
  media_metadata: {
    filename?: string;
    size?: number;
    mime_type?: string;
    width?: number;
    height?: number;
  } | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reply_to?: Message;
}

export interface MessageReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface VideoCall {
  id: string;
  conversation_id: string;
  initiated_by: string;
  call_type: "audio" | "video";
  status: "ringing" | "active" | "ended" | "missed" | "declined";
  room_url: string | null;
  room_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  initiator?: Profile;
}
