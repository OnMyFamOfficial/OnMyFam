import { useState, useEffect, useRef } from "react";
import {
  Image,
  Video,
  Send,
  Heart,
  MessageCircle,
  ThumbsUp,
  PartyPopper,
  Smile,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { uploadPostMedia } from "@/services/storage";
import { formatDistanceToNow } from "date-fns";
import type { Post, PostMedia, PostReaction, Comment, Profile } from "@/lib/types";

const REACTIONS = [
  { type: "like", emoji: "\u{1F44D}", icon: ThumbsUp },
  { type: "love", emoji: "\u{2764}\u{FE0F}", icon: Heart },
  { type: "celebrate", emoji: "\u{1F389}", icon: PartyPopper },
  { type: "hug", emoji: "\u{1FAC2}", icon: Smile },
  { type: "laugh", emoji: "\u{1F602}", icon: Smile },
] as const;

const EMOJI_GRID = [
  "\u{1F600}", "\u{1F602}", "\u{1F60D}", "\u{1F970}", "\u{1F60A}", "\u{1F607}", "\u{1F917}", "\u{1F914}",
  "\u{1F60E}", "\u{1F973}", "\u{1F929}", "\u{1F618}", "\u{1F644}", "\u{1F62D}", "\u{1F622}", "\u{1F621}",
  "\u{1F525}", "\u{2764}\u{FE0F}", "\u{1F44D}", "\u{1F44F}", "\u{1F64F}", "\u{1F389}", "\u{1F4AA}", "\u{1F91D}",
  "\u{1F4AF}", "\u{2728}", "\u{1F31F}", "\u{1F60B}", "\u{1FAC2}", "\u{1F642}", "\u{1F60F}", "\u{1F92F}",
  "\u{1F971}", "\u{1F974}", "\u{1F47B}", "\u{1F4A5}", "\u{1F4A9}", "\u{1F921}", "\u{1F47C}", "\u{1F9D1}\u{200D}\u{1F373}",
  "\u{1F37D}\u{FE0F}", "\u{1F382}", "\u{1F370}", "\u{2615}", "\u{1F3E0}", "\u{1F697}", "\u{2708}\u{FE0F}", "\u{1F3D6}\u{FE0F}",
  "\u{1F305}", "\u{1F30D}", "\u{1F308}", "\u{26A1}", "\u{1F3B6}", "\u{1F3B5}", "\u{1F4F8}", "\u{1F381}",
  "\u{1F48E}", "\u{1F451}", "\u{1F3C6}", "\u{1F947}", "\u{2705}", "\u{274C}", "\u{2757}", "\u{2753}",
];

type FullPost = Post & {
  author: Profile;
  media: PostMedia[];
  reactions: (PostReaction & { user: Profile })[];
  comments: (Comment & { author: Profile })[];
};

export default function FeedPage() {
  const { user, profile } = useAuth();
  const { currentFamily } = useFamily();
  const [posts, setPosts] = useState<FullPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showReactionDetails, setShowReactionDetails] = useState<string | null>(null);

  // Composer modal state
  const [composerOpen, setComposerOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentFamily) loadPosts();
  }, [currentFamily]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (composerOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [composerOpen]);

  function openComposer(action?: "photo" | "video" | "emoji") {
    setComposerOpen(true);
    setShowEmojiPicker(false);
    if (action === "photo") {
      setTimeout(() => fileRef.current?.click(), 150);
    } else if (action === "video") {
      setTimeout(() => videoRef.current?.click(), 150);
    } else if (action === "emoji") {
      setTimeout(() => setShowEmojiPicker(true), 100);
    }
  }

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  function tryCloseComposer() {
    if (postText.trim() || postFiles.length > 0) {
      setShowDiscardConfirm(true);
    } else {
      closeComposer();
    }
  }

  function closeComposer() {
    setComposerOpen(false);
    setShowEmojiPicker(false);
    setShowDiscardConfirm(false);
  }

  function insertEmoji(emoji: string) {
    setPostText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }

  async function loadPosts() {
    if (!currentFamily) return;
    setLoading(true);

    const { data } = await supabase
      .from("posts")
      .select("*, media:post_media(*), reactions:post_reactions(*), comments:comments(*)")
      .eq("family_id", currentFamily.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data || data.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Collect all user IDs from posts, reactions, comments
    const userIds = new Set<string>();
    for (const post of data) {
      userIds.add(post.author_id);
      for (const r of post.reactions || []) userIds.add(r.user_id);
      for (const c of post.comments || []) userIds.add(c.author_id);
    }

    const { data: profiles } = await supabase.from("profiles").select("*").in("id", [...userIds]);
    const pm = new Map<string, any>();
    for (const p of profiles || []) pm.set(p.id, p);

    setPosts(data.map((post) => ({
      ...post,
      author: pm.get(post.author_id) || { display_name: "Unknown" },
      reactions: (post.reactions || []).map((r: any) => ({ ...r, user: pm.get(r.user_id) })),
      comments: (post.comments || []).map((c: any) => ({ ...c, author: pm.get(c.author_id) })),
    })) as FullPost[]);
    setLoading(false);
  }

  async function handlePost() {
    if (!user || !currentFamily || (!postText.trim() && postFiles.length === 0))
      return;
    setPosting(true);

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        family_id: currentFamily.id,
        author_id: user.id,
        content: postText.trim(),
      })
      .select()
      .single();

    if (error || !post) {
      setPosting(false);
      return;
    }

    for (let i = 0; i < postFiles.length; i++) {
      const url = await uploadPostMedia(post.id, postFiles[i], i);
      if (url) {
        await supabase.from("post_media").insert({
          post_id: post.id,
          media_url: url,
          media_type: postFiles[i].type.startsWith("video") ? "video" : "image",
        });
      }
    }

    setPostText("");
    setPostFiles([]);
    setPosting(false);
    closeComposer();
    await loadPosts();
  }

  async function toggleReaction(postId: string, type: string) {
    if (!user) return;

    const existing = posts
      .find((p) => p.id === postId)
      ?.reactions.find((r) => r.user_id === user.id);

    if (existing) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_reactions").insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: type,
      });
    }
    setShowReactions(null);
    await loadPosts();
  }

  async function submitComment(postId: string) {
    if (!user || !commentTexts[postId]?.trim()) return;

    await supabase.from("comments").insert({
      post_id: postId,
      author_id: user.id,
      content: commentTexts[postId].trim(),
    });

    setCommentTexts({ ...commentTexts, [postId]: "" });
    await loadPosts();
  }

  function removeFile(index: number) {
    setPostFiles(postFiles.filter((_, i) => i !== index));
  }

  if (!currentFamily) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-[var(--muted-foreground)]">
          Create or join a family first to see the feed.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Composer trigger bar + inline modal */}
      <div className="relative">
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gold-500">
                  {profile?.display_name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
            {/* Fake input that opens modal */}
            <div
              onClick={() => openComposer()}
              className="flex-1 flex items-center rounded-full border border-[var(--input)] bg-[var(--background)] px-4 py-2.5 cursor-pointer hover:border-gold-500/40 transition-colors"
            >
              <span className="flex-1 text-sm text-[var(--muted-foreground)]">
                What's happening in the family?
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openComposer("photo"); }}
                  className="rounded-full transition-colors text-gold-500 hover:text-white leading-none"
                  title="Add photo"
                >
                  <Image style={{ width: 30, height: 30 }} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openComposer("video"); }}
                  className="rounded-full transition-colors text-gold-500 hover:text-white leading-none"
                  title="Add video"
                >
                  <Video style={{ width: 30, height: 30 }} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openComposer("emoji"); }}
                  className="rounded-full transition-colors text-gold-500 hover:text-white leading-none"
                  title="Add emoji"
                >
                  <Smile style={{ width: 30, height: 30 }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Composer Modal — anchored to trigger bar */}
        {composerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={tryCloseComposer}
            />

            {/* Modal drops down from trigger */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-2xl">

            {showDiscardConfirm ? (
              /* Discard confirmation — inline */
              <div className="p-6 text-center">
                <h3 className="font-semibold text-lg">Discard post?</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                  You have unsaved changes. Are you sure you want to discard this post?
                </p>
                <div className="flex gap-3 mt-5 justify-center">
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                  >
                    Keep Editing
                  </button>
                  <button
                    onClick={() => { setPostText(""); setPostFiles([]); closeComposer(); }}
                    className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
            <>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <h3 className="font-semibold">Create Post</h3>
              <button
                onClick={tryCloseComposer}
                className="p-1 rounded-full hover:bg-[var(--accent)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5">
              {/* Author row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gold-500">
                      {profile?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <p className="font-medium text-sm">{profile?.display_name}</p>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What's happening in the family?"
                rows={4}
                className="w-full bg-transparent text-base focus:outline-none resize-none placeholder:text-[var(--muted-foreground)]"
              />

              {/* File previews */}
              {postFiles.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {postFiles.map((file, i) => (
                    <div
                      key={i}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)]"
                    >
                      {file.type.startsWith("video") ? (
                        <div className="w-full h-full bg-[var(--muted)] flex items-center justify-center">
                          <Video className="w-6 h-6 text-[var(--muted-foreground)]" />
                        </div>
                      ) : (
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Emoji picker dropdown */}
              {showEmojiPicker && (
                <div className="mt-3 p-4 bg-[var(--background)] rounded-lg border border-[var(--border)] max-h-[240px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="grid grid-cols-8 gap-1.5">
                    {EMOJI_GRID.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => insertEmoji(emoji)}
                        className="w-12 h-12 flex items-center justify-center text-3xl hover:bg-[var(--accent)] rounded-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-2 rounded-full hover:bg-[var(--accent)] transition-colors text-gold-500 hover:text-white"
                  title="Add photo"
                >
                  <Image className="w-5 h-5" />
                </button>
                <button
                  onClick={() => videoRef.current?.click()}
                  className="p-2 rounded-full hover:bg-[var(--accent)] transition-colors text-gold-500 hover:text-white"
                  title="Add video"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-full hover:bg-[var(--accent)] transition-colors hover:text-white ${
                    showEmojiPicker ? "text-white bg-gold-500/10" : "text-gold-500"
                  }`}
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handlePost}
                disabled={posting || (!postText.trim() && postFiles.length === 0)}
                className="px-5 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                {posting ? "Posting..." : "Post"}
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files)
                  setPostFiles([...postFiles, ...Array.from(e.target.files)]);
                e.target.value = "";
              }}
              className="hidden"
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => {
                if (e.target.files)
                  setPostFiles([...postFiles, ...Array.from(e.target.files)]);
                e.target.value = "";
              }}
              className="hidden"
            />
          </>
          )}
          </div>
          </>
        )}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <p className="text-lg">No posts yet</p>
          <p className="text-sm mt-1">
            Share the first update with your family!
          </p>
        </div>
      ) : (
        posts.map((post) => {
          const myReaction = post.reactions.find(
            (r) => r.user_id === user?.id
          );
          const commentsOpen = expandedComments.has(post.id);

          return (
            <div
              key={post.id}
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden"
            >
              {/* Author */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                  {post.author?.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gold-500">
                      {post.author?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {post.author?.display_name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDistanceToNow(new Date(post.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              {/* Content */}
              {post.content && (
                <div className="px-4 pb-3">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                </div>
              )}

              {/* Media */}
              {post.media.length > 0 && (
                <div
                  className={`grid gap-0.5 ${
                    post.media.length === 1
                      ? "grid-cols-1"
                      : "grid-cols-2"
                  }`}
                >
                  {post.media.map((m) =>
                    m.media_type === "video" ? (
                      <video
                        key={m.id}
                        src={m.media_url}
                        controls
                        className="w-full max-h-96"
                      />
                    ) : (
                      <img
                        key={m.id}
                        src={m.media_url}
                        alt=""
                        className="w-full object-cover max-h-96"
                      />
                    )
                  )}
                </div>
              )}

              {/* Reaction/comment counts */}
              {(post.reaction_count > 0 || post.comment_count > 0) && (
                <div className="px-4 py-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    {post.reaction_count > 0 && (
                      <>
                        <button
                          onClick={() => setShowReactionDetails(showReactionDetails === post.id ? null : post.id)}
                          className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-gold-500/50 transition-colors cursor-pointer text-xs"
                          title="See who reacted"
                        >
                          +
                        </button>
                        {(() => {
                          const reactionsByType: Record<string, number> = {};
                          for (const r of post.reactions || []) {
                            const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                            reactionsByType[emoji] = (reactionsByType[emoji] || 0) + 1;
                          }
                          return Object.entries(reactionsByType).map(([emoji, count]) => (
                            <span key={emoji} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)]">
                              <span className="text-xl">{emoji}</span>
                              <span className="text-[10px]">{count}</span>
                            </span>
                          ));
                        })()}
                      </>
                    )}
                  </div>
                  {/* Reaction details dropdown */}
                  {showReactionDetails === post.id && post.reactions.length > 0 && (
                    <div className="mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 space-y-1">
                      {post.reactions.map((r: any) => {
                        const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                        return (
                          <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--accent)] transition-colors">
                            <span className="text-base">{emoji}</span>
                            <div className="w-5 h-5 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {r.user?.avatar_url ? (
                                <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[8px] font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                              )}
                            </div>
                            <span className="text-xs">{r.user?.display_name || "Unknown"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )
                  <span>
                    {post.comment_count > 0 &&
                      `${post.comment_count} comment${post.comment_count !== 1 ? "s" : ""}`}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={() =>
                      myReaction
                        ? toggleReaction(post.id, myReaction.reaction_type)
                        : setShowReactions(
                            showReactions === post.id ? null : post.id
                          )
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      myReaction
                        ? "text-gold-500 bg-gold-500/10"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {myReaction ? (
                      <span className="text-base">{REACTIONS.find((r) => r.type === myReaction.reaction_type)?.emoji || "\u{1F44D}"}</span>
                    ) : (
                      <ThumbsUp className="w-4 h-4" />
                    )}
                    {myReaction ? "Liked" : "Like"}
                  </button>

                  {/* Reaction picker */}
                  {showReactions === post.id && (
                    <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                      {REACTIONS.map((r) => (
                        <button
                          key={r.type}
                          onClick={() => toggleReaction(post.id, r.type)}
                          className="text-lg hover:scale-125 transition-transform p-1"
                          title={r.type}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const next = new Set(expandedComments);
                    if (next.has(post.id)) next.delete(post.id);
                    else next.add(post.id);
                    setExpandedComments(next);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Comment
                </button>
              </div>

              {/* Comments section */}
              {commentsOpen && (
                <div className="px-4 pb-4 border-t border-[var(--border)]">
                  {post.comments
                    .filter((c) => !c.parent_id)
                    .sort(
                      (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                    )
                    .map((comment) => (
                      <div key={comment.id} className="flex gap-2 mt-3">
                        <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {comment.author?.avatar_url ? (
                            <img
                              src={comment.author.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-gold-500">
                              {comment.author?.display_name
                                ?.charAt(0)
                                .toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <div className="bg-[var(--background)] rounded-lg px-3 py-2 flex-1">
                          <p className="text-xs font-medium">
                            {comment.author?.display_name}
                          </p>
                          <p className="text-sm mt-0.5">{comment.content}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                            {formatDistanceToNow(
                              new Date(comment.created_at),
                              { addSuffix: true }
                            )}
                          </p>
                        </div>
                      </div>
                    ))}

                  {/* Comment input */}
                  <div className="flex gap-2 mt-3">
                    <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <span className="text-xs font-medium text-gold-500">
                        {profile?.display_name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 flex gap-2">
                      <input
                        value={commentTexts[post.id] || ""}
                        onChange={(e) =>
                          setCommentTexts({
                            ...commentTexts,
                            [post.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitComment(post.id);
                          }
                        }}
                        placeholder="Write a comment..."
                        className="flex-1 rounded-full border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={!commentTexts[post.id]?.trim()}
                        className="p-1.5 rounded-full text-gold-500 hover:bg-gold-500/10 disabled:opacity-30 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
