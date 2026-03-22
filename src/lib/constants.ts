export const APP_NAME = "OnMyFam";
export const APP_TAGLINE = "Where Family Stays Connected";
export const APP_DESCRIPTION =
  "A private family social platform for sharing moments, events, photos, and staying connected with the people who matter most.";

export const REACTION_TYPES = [
  { type: "like", emoji: "\u{1F44D}", label: "Like" },
  { type: "love", emoji: "\u{2764}\u{FE0F}", label: "Love" },
  { type: "celebrate", emoji: "\u{1F389}", label: "Celebrate" },
  { type: "hug", emoji: "\u{1FAC2}", label: "Hug" },
  { type: "laugh", emoji: "\u{1F602}", label: "Laugh" },
] as const;

export const EVENT_CATEGORIES = [
  "birthday",
  "reunion",
  "holiday",
  "graduation",
  "wedding",
  "memorial",
  "cookout",
  "game_night",
  "other",
] as const;

export const RSVP_OPTIONS = ["going", "maybe", "cant_make_it"] as const;

export const FAMILY_ROLES = ["admin", "moderator", "member"] as const;

export const PRIVACY_LEVELS = ["family", "specific_members", "public"] as const;

export const NOTIFICATION_TYPES = [
  "post_reaction",
  "post_comment",
  "event_invite",
  "event_rsvp",
  "member_joined",
  "album_shared",
  "discussion_reply",
  "family_announcement",
] as const;
