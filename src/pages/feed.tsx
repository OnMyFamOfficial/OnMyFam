import { useState, useEffect, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
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
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  Check,
  Reply,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Users,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { uploadPostMedia } from "@/services/storage";
import { sanitizeForStorage, validateMediaFile } from "@/lib/sanitize";
import { CommentToolbar } from "@/components/shared/comment-toolbar";
import { LinkifyText, LinkPreviewFromText } from "@/components/shared/linkify-text";
import { useRef as useRefFold, useState as useStateFold } from "react";

function FoldableContent({ text, lines = 4 }: { text: string; lines?: number }) {
  const [folded, setFolded] = useStateFold(true);
  const contentRef = useRefFold<HTMLDivElement>(null);
  const needsFold = text.split("\n").length > lines || text.length > lines * 75;

  if (!needsFold) {
    return <LinkifyText text={text} className="text-sm whitespace-pre-wrap" />;
  }

  return (
    <div>
      <div ref={contentRef} style={folded ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>
        <LinkifyText text={text} className="text-sm whitespace-pre-wrap" hidePreview />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const wasFolded = folded;
          setFolded(!folded);
          if (!wasFolded && contentRef.current) {
            // Folding back - scroll the post card to center
            setTimeout(() => {
              contentRef.current?.closest("[data-post-card]")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          }
        }}
        className="w-full mt-1 py-1 rounded text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer text-center"
        style={{ backgroundColor: "#323345" }}
      >
        {folded ? "Unfold" : "Fold"}
      </button>
      <LinkPreviewFromText text={text} />
    </div>
  );
}
import { formatDistanceToNow } from "date-fns";
import type { Post, PostMedia, PostReaction, Comment, Profile } from "@/lib/types";

const REACTIONS = [
  { type: "like", emoji: "\u{1F44D}", icon: ThumbsUp },
  { type: "dislike", emoji: "\u{1F44E}", icon: ThumbsDown },
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
  const navigate = useNavigate();
  const { filterOpen, setFilterOpen } = useOutletContext<{ filterOpen: boolean; setFilterOpen: (v: boolean) => void }>();
  const { user, profile } = useAuth();
  const { currentFamily, families, members } = useFamily();
  const [posts, setPosts] = useState<FullPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showReactionDetails, setShowReactionDetails] = useState<string | null>(null);
  const [postMenu, setPostMenu] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; authorName: string } | null>(null);
  const [commentLikes, setCommentLikes] = useState<Map<string, Map<string, string>>>(new Map()); // commentId -> (userId -> reactionType)
  const [commentReactionPicker, setCommentReactionPicker] = useState<string | null>(null);
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const [filterByMembers, setFilterByMembers] = useState<Set<string>>(new Set());
  const [memberFilterSearch, setMemberFilterSearch] = useState("");
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(() => new Set(families.map(f => f.id)));
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [deletingComment, setDeletingComment] = useState<{ commentId: string; postId: string } | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePostMode, setActivePostMode] = useState<"full" | "comments">("full");
  const postMenuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

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
      setTimeout(() => openFilePicker(fileRef), 150);
    } else if (action === "video") {
      setTimeout(() => openFilePicker(videoRef), 150);
    } else if (action === "emoji") {
      setTimeout(() => setShowEmojiPicker(true), 100);
    }
  }

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const fileDialogOpen = useRef(false);

  function tryCloseComposer() {
    // Don't close while a file picker dialog is open
    if (fileDialogOpen.current) return;
    if (postText.trim() || postFiles.length > 0) {
      setShowDiscardConfirm(true);
    } else {
      closeComposer();
    }
  }

  function openFilePicker(ref: React.RefObject<HTMLInputElement | null>) {
    fileDialogOpen.current = true;
    ref.current?.click();
    // Reset after a delay (file dialog blocks, so this fires after it closes)
    const reset = () => { fileDialogOpen.current = false; };
    window.addEventListener("focus", reset, { once: true });
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

  // Close post menu on outside click
  useEffect(() => {
    if (!postMenu) return;
    function handleClick(e: MouseEvent) {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setPostMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [postMenu]);

  async function handleEditPost(postId: string) {
    if (!editPostText.trim()) return;
    await supabase.from("posts").update({ content: sanitizeForStorage(editPostText.trim()) }).eq("id", postId);
    setEditingPost(null);
    setEditPostText("");
    await loadPosts();
  }

  async function handleDeletePost(postId: string) {
    // Delete media, reactions, comments first, then the post
    await supabase.from("post_media").delete().eq("post_id", postId);
    await supabase.from("post_reactions").delete().eq("post_id", postId);
    await supabase.from("comments").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
    setDeletingPost(null);
    await loadPosts();
  }

  function handleSharePost(postId: string) {
    const url = `${window.location.origin}/feed?post=${postId}`;
    if (navigator.share) {
      navigator.share({ title: "Check out this post on OnMyFam", url });
    } else {
      navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
    setPostMenu(null);
  }

  async function loadPosts(silent = false) {
    if (!currentFamily) return;
    if (!silent) setLoading(true);

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

    // Collect all comment IDs for likes
    const commentIds: string[] = [];
    for (const post of data) {
      for (const c of post.comments || []) commentIds.push(c.id);
    }

    const [{ data: profiles }, likesResult] = await Promise.all([
      supabase.from("profiles").select("*").in("id", [...userIds]),
      commentIds.length > 0
        ? supabase.from("comment_likes").select("*").in("comment_id", commentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const pm = new Map<string, any>();
    for (const p of profiles || []) pm.set(p.id, p);

    // Build comment likes map: commentId -> (userId -> reactionType)
    const clMap = new Map<string, Map<string, string>>();
    for (const like of likesResult.data || []) {
      if (!clMap.has(like.comment_id)) clMap.set(like.comment_id, new Map());
      clMap.get(like.comment_id)!.set(like.user_id, like.reaction_type || "like");
    }
    setCommentLikes(clMap);

    // Debug: check if media is coming back from the query
    for (const post of data) {
      if (post.media && post.media.length > 0) {
        console.log(`[loadPosts] Post ${post.id} has ${post.media.length} media:`, post.media);
      }
    }

    setPosts(data.map((post) => ({
      ...post,
      author: pm.get(post.author_id) || { display_name: "Unknown" },
      reactions: (post.reactions || []).map((r: any) => ({ ...r, user: pm.get(r.user_id) })),
      comments: (post.comments || []).map((c: any) => ({ ...c, author: pm.get(c.author_id) })),
    })) as FullPost[]);
    setLoading(false);
  }

  const postingRef = useRef(false);
  async function handlePost() {
    if (!user || !currentFamily || (!postText.trim() && postFiles.length === 0))
      return;
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);

    // Validate files before uploading
    for (const file of postFiles) {
      const result = validateMediaFile(file);
      if (!result.valid) {
        alert(result.error);
        setPosting(false);
        postingRef.current = false;
        return;
      }
    }

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        family_id: currentFamily.id,
        author_id: user.id,
        content: sanitizeForStorage(postText.trim()),
      })
      .select()
      .single();

    if (error || !post) {
      setPosting(false);
      return;
    }

    for (let i = 0; i < postFiles.length; i++) {
      console.log(`Uploading file ${i}:`, postFiles[i].name, postFiles[i].type, postFiles[i].size);
      const url = await uploadPostMedia(post.id, postFiles[i], i);
      console.log(`Upload result:`, url);
      if (url) {
        const { error: mediaError } = await supabase.from("post_media").insert({
          post_id: post.id,
          media_url: url,
          media_type: postFiles[i].type.startsWith("video") ? "video" : "image",
        });
        if (mediaError) console.error("post_media insert error:", mediaError);
      }
    }

    // Notify other family members about the new post
    const otherMembers = members.filter((m) => m.user_id !== user.id);
    if (otherMembers.length > 0) {
      const notifications = otherMembers.map((m) => ({
        user_id: m.user_id,
        type: "post",
        title: `${profile?.display_name || "Someone"} posted in ${currentFamily.name}`,
        body: postText.trim().slice(0, 100) || "Shared a photo",
        data: { post_id: post.id, family_id: currentFamily.id },
      }));
      await supabase.from("notifications").insert(notifications);
    }

    setPostText("");
    setPostFiles([]);
    setPosting(false);
    postingRef.current = false;
    closeComposer();
    await loadPosts();
  }

  async function toggleReaction(postId: string, type: string) {
    if (!user || !profile) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const existing = post.reactions.find((r) => r.user_id === user.id);
    const isSameType = existing?.reaction_type === type;

    // Optimistic update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      if (isSameType && existing) {
        // Remove reaction (toggle off)
        return {
          ...p,
          reactions: p.reactions.filter((r) => r.id !== existing.id),
          reaction_count: Math.max(0, p.reaction_count - 1),
        };
      } else if (existing) {
        // Swap reaction type
        return {
          ...p,
          reactions: p.reactions.map((r) => r.id === existing.id ? { ...r, reaction_type: type } : r),
        };
      } else {
        // Add new reaction
        const tempId = `temp-${Date.now()}`;
        return {
          ...p,
          reactions: [...p.reactions, { id: tempId, post_id: postId, user_id: user.id, reaction_type: type, created_at: new Date().toISOString(), user: profile } as any],
          reaction_count: p.reaction_count + 1,
        };
      }
    }));
    setShowReactions(null);

    // Persist to DB
    if (existing) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    }
    if (!isSameType) {
      await supabase.from("post_reactions").insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: type,
      });
    }
  }

  async function submitComment(postId: string, mediaUrl?: string) {
    if (!user || !profile) return;
    const text = commentTexts[postId]?.trim() || "";
    if (!text && !mediaUrl) return;

    const content = text ? sanitizeForStorage(text) : "";
    const parentId = (replyingTo && replyingTo.postId === postId) ? replyingTo.commentId : null;
    const tempId = `temp-${Date.now()}`;

    // Optimistic update
    const newComment = {
      id: tempId,
      post_id: postId,
      author_id: user.id,
      parent_id: parentId,
      content,
      media_url: mediaUrl || null,
      like_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: profile,
    } as any;

    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...p.comments, newComment], comment_count: p.comment_count + 1 };
    }));
    setCommentTexts({ ...commentTexts, [postId]: "" });
    setReplyingTo(null);

    // Persist to DB
    const insertData: any = { post_id: postId, author_id: user.id, content: content || " " };
    if (parentId) insertData.parent_id = parentId;
    if (mediaUrl) insertData.media_url = mediaUrl;
    await supabase.from("comments").insert(insertData);
    loadPosts(true);
  }

  async function toggleCommentReaction(commentId: string, reactionType: string) {
    if (!user) return;
    const reactions = commentLikes.get(commentId);
    const existingReaction = reactions?.get(user.id);
    const isSameReaction = existingReaction === reactionType;

    // Optimistic update
    setCommentLikes((prev) => {
      const next = new Map(prev);
      const map = new Map(next.get(commentId) || []);
      if (isSameReaction) {
        map.delete(user.id);
      } else {
        map.set(user.id, reactionType);
      }
      next.set(commentId, map);
      return next;
    });
    setCommentReactionPicker(null);

    // Persist to DB
    if (existingReaction) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
    }
    if (!isSameReaction) {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id, reaction_type: reactionType });
    }
  }

  async function handleEditComment(commentId: string) {
    if (!editCommentText.trim()) return;
    const sanitized = sanitizeForStorage(editCommentText.trim());
    await supabase.from("comments").update({ content: sanitized }).eq("id", commentId);
    setPosts((prev) => prev.map((p) => ({
      ...p,
      comments: p.comments.map((c) => c.id === commentId ? { ...c, content: sanitized } : c),
    }) as FullPost));
    setEditingComment(null);
    setEditCommentText("");
  }

  async function handleDeleteComment(commentId: string, postId: string) {
    // Optimistic update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments.filter((c) => c.id !== commentId && c.parent_id !== commentId),
        comment_count: Math.max(0, p.comment_count - 1 - p.comments.filter((c) => c.parent_id === commentId).length),
      } as FullPost;
    }));
    // Delete replies first, then the comment
    await supabase.from("comments").delete().eq("parent_id", commentId);
    await supabase.from("comments").delete().eq("id", commentId);
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

  const filteredPosts = filterByMembers.size === 0
    ? posts
    : posts.filter((p) => filterByMembers.has(p.author_id));

  function toggleMemberFilter(userId: string) {
    setFilterByMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  return (
    <div className="flex flex-col lg:flex-row -m-4 lg:-m-6">
      {/* Left: Member filter sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 flex-shrink-0 border-r border-[var(--border)] lg:h-[calc(100vh-4rem)]">
        <div className="px-3 pt-2 pb-2 border-b border-[var(--border)] flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gold-500" />
              <span className="font-semibold text-sm">Filter by Member</span>
            </div>
            {filterByMembers.size > 0 && (
              <button
                onClick={() => setFilterByMembers(new Set())}
                className="text-[10px] text-gold-500 hover:text-gold-400 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search members..."
              value={memberFilterSearch}
              onChange={(e) => setMemberFilterSearch(e.target.value)}
              className="bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(() => {
              // Sort by hierarchy: parents first, then children, alphabetical within each level
              const roots = families.filter((f) => !f.parent_family_id).sort((a, b) => a.name.localeCompare(b.name));
              const sorted: { family: typeof families[0]; depth: number }[] = [];
              function addWithChildren(parent: typeof families[0], depth: number) {
                sorted.push({ family: parent, depth });
                const children = families.filter((f) => f.parent_family_id === parent.id).sort((a, b) => a.name.localeCompare(b.name));
                for (const child of children) addWithChildren(child, depth + 1);
              }
              for (const root of roots) addWithChildren(root, 0);
              // Add any orphans (parent not in user's families)
              for (const f of families) {
                if (!sorted.some((s) => s.family.id === f.id)) sorted.push({ family: f, depth: 0 });
              }
              return sorted;
            })().map(({ family, depth }) => {
              const isCollapsed = collapsedFamilies.has(family.id);
              const isCurrent = family.id === currentFamily?.id;
              return (
                <div key={family.id}>
                  {/* Family header */}
                  <button
                    onClick={() => setCollapsedFamilies((prev) => {
                      const next = new Set(prev);
                      if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 py-2 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left border-b border-[var(--border)]"
                    style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12 }}
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />}
                    <span className={`text-xs font-semibold truncate ${isCurrent ? "text-gold-500" : ""}`}>{family.name}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">{family.member_count}</span>
                  </button>
                  {/* Members list */}
                  {!isCollapsed && (
                    isCurrent ? (
                      <div className="p-1.5 space-y-0.5">
                        {members.filter((m) => !memberFilterSearch || m.profile?.display_name?.toLowerCase().includes(memberFilterSearch.toLowerCase())).map((member) => {
                          const p = member.profile;
                          const isSelected = filterByMembers.has(member.user_id);
                          return (
                            <button
                              key={member.id}
                              onClick={() => toggleMemberFilter(member.user_id)}
                              className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-lg transition-colors cursor-pointer text-left ${
                                isSelected ? "bg-gold-500/15 border border-gold-500/30" : "hover:bg-[var(--accent)] border border-transparent"
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 ${isSelected ? "ring-2 ring-gold-500" : "bg-gold-500/20"}`}>
                                {p?.avatar_url ? (
                                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-medium text-gold-500">{p?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                                )}
                              </div>
                              <span className={`text-xs truncate ${isSelected ? "font-medium text-gold-500" : "text-[var(--muted-foreground)]"}`}>
                                {p?.display_name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
                        Switch to this family to see members
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
      </div>

      {/* Right: Feed content */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 lg:overflow-y-auto lg:h-[calc(100vh-4rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="max-w-2xl space-y-6 lg:[margin-left:calc(50vw-336px-210px-256px+5vw)]">
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
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const imageFiles: File[] = [];
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    setPostFiles((prev) => [...prev, ...imageFiles]);
                  }
                }}
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
                  onClick={() => openFilePicker(fileRef)}
                  className="p-2 rounded-full hover:bg-[var(--accent)] transition-colors text-gold-500 hover:text-white"
                  title="Add photo"
                >
                  <Image className="w-5 h-5" />
                </button>
                <button
                  onClick={() => openFilePicker(videoRef)}
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
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <p className="text-sm">No posts from selected members</p>
          <button onClick={() => setFilterByMembers(new Set())} className="text-xs text-gold-500 hover:text-gold-400 mt-2 cursor-pointer">Clear filters</button>
        </div>
      ) : (
        filteredPosts.map((post) => {
          const myReaction = post.reactions.find(
            (r) => r.user_id === user?.id
          );

          return (
            <div
              key={post.id}
              data-post-card
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-visible cursor-pointer hover:border-gold-500/30 transition-colors"
              onClick={(e) => {
                // Don't open modal if clicking interactive elements
                if ((e.target as HTMLElement).closest("button, a, input, textarea, video")) return;
                const card = e.currentTarget as HTMLElement;
                setActivePostMode("full");
                setActivePostId(post.id);
                // Scroll after refold completes
                setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
              }}
            >
              {/* Author + menu */}
              <div className="p-4 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.author_id}`); }}
                >
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-gold-500">
                      {post.author?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{post.author?.display_name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    {post.updated_at !== post.created_at && " (edited)"}
                  </p>
                </div>
                {/* Three-dot menu */}
                <div className="relative" ref={postMenu === post.id ? postMenuRef : undefined}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPostMenu(postMenu === post.id ? null : post.id); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {postMenu === post.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-1 min-w-[160px]">
                      {post.author_id === user?.id && (
                        <button
                          onClick={() => { setActivePostMode("full"); setActivePostId(post.id); setEditingPost(post.id); setEditPostText(post.content || ""); setPostMenu(null); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleSharePost(post.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                      >
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                      {post.author_id === user?.id && (
                        <>
                          <div className="my-1 border-t border-[var(--border)]" />
                          <button
                            onClick={() => { setDeletingPost(post.id); setPostMenu(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Content preview */}
              {post.content && (
                <div className="px-4 pb-3">
                  <FoldableContent key={`${post.id}-${activePostId}`} text={post.content} />
                </div>
              )}

              {/* Media preview */}
              {post.media.length > 0 && (
                <div className={`grid gap-0.5 ${post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {post.media.slice(0, 4).map((m) =>
                    m.media_type === "video" ? (
                      <video key={m.id} src={m.media_url} controls className="w-full max-h-96" />
                    ) : (
                      <img
                        key={m.id}
                        src={m.media_url}
                        alt=""
                        className="w-full max-h-96 object-contain bg-black/20 rounded-sm"
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
                          onClick={(e) => { e.stopPropagation(); setShowReactionDetails(showReactionDetails === post.id ? null : post.id); }}
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
                  {post.comment_count > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setActivePostMode("comments"); setActivePostId(post.id); setTimeout(() => commentInputRef.current?.focus(), 200); }}
                      className="hover:underline cursor-pointer"
                    >
                      {post.comment_count} comment{post.comment_count !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}

              {/* Reaction details modal */}
              {showReactionDetails === post.id && post.reactions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-[60] bg-black/50" onClick={(e) => { e.stopPropagation(); setShowReactionDetails(null); }} />
                  <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                      <h3 className="font-semibold text-sm">Reactions ({post.reactions.length})</h3>
                      <button onClick={(e) => { e.stopPropagation(); setShowReactionDetails(null); }} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {post.reactions.map((r: any) => {
                        const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                        const isFam = members.some((m) => m.user_id === r.user_id);
                        return (
                          <button
                            key={r.id}
                            onClick={(e) => { e.stopPropagation(); setShowReactionDetails(null); navigate(`/profile/${r.user_id}`); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                          >
                            <span className="text-xl">{emoji}</span>
                            <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {r.user?.avatar_url ? (
                                <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">{r.user?.display_name || "Unknown"}</span>
                              <span className="text-[10px] text-[var(--muted-foreground)]">
                                {r.user_id === user?.id ? "You" : isFam ? "Fam" : "Not in your family"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      myReaction
                        ? toggleReaction(post.id, myReaction.reaction_type)
                        : setShowReactions(showReactions === post.id ? null : post.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      myReaction ? "text-gold-500 bg-gold-500/10" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {myReaction ? (
                      <span className="text-base">{REACTIONS.find((r) => r.type === myReaction.reaction_type)?.emoji || "\u{1F44D}"}</span>
                    ) : (
                      <ThumbsUp className="w-4 h-4" />
                    )}
                    {myReaction ? "Liked" : "Like"}
                  </button>
                  {showReactions === post.id && (
                    <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                      {REACTIONS.map((r) => (
                        <button
                          key={r.type}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(post.id, r.type); }}
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
                  onClick={(e) => { e.stopPropagation(); setActivePostMode("comments"); setActivePostId(post.id); setTimeout(() => commentInputRef.current?.focus(), 200); }}
                  className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Comment
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* ===== Active Post Modal ===== */}
      {activePostId && (() => {
        const post = posts.find((p) => p.id === activePostId);
        if (!post) return null;
        const myReaction = post.reactions.find((r) => r.user_id === user?.id);
        const hasMedia = post.media.length > 0;

        // Shared comments panel (used in both modes)
        const commentsPanel = (
          <div className="flex flex-col h-full">
            {/* Author header (fixed top) */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => { setActivePostId(null); navigate(`/profile/${post.author_id}`); }}
                  >
                    {post.author?.avatar_url ? (
                      <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gold-500">{post.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{post.author?.display_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      {post.updated_at !== post.created_at && " (edited)"}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setActivePostId(null); setEditingPost(null); setReplyingTo(null); }} className="p-1.5 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable content + comments */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Post content (or edit mode) */}
              {editingPost === post.id ? (
                <div className="px-4 py-2">
                  <textarea
                    value={editPostText}
                    onChange={(e) => setEditPostText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleEditPost(post.id); }
                      if (e.key === "Escape") { setEditingPost(null); setEditPostText(""); }
                    }}
                    className="w-full bg-[var(--background)] border border-gold-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => handleEditPost(post.id)} disabled={!editPostText.trim() || editPostText.trim() === post.content} className="px-3 py-1 rounded-md bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => { setEditingPost(null); setEditPostText(""); }} className="px-3 py-1 rounded-md border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : post.content ? (
                <div className="px-4 py-2">
                  <FoldableContent text={post.content} lines={9} />
                </div>
              ) : null}

              {/* Reaction counts */}
              {(post.reaction_count > 0 || post.comment_count > 0) && (
                <div className="px-4 py-1.5 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    {post.reaction_count > 0 && (() => {
                      const reactionsByType: Record<string, number> = {};
                      for (const r of post.reactions || []) {
                        const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                        reactionsByType[emoji] = (reactionsByType[emoji] || 0) + 1;
                      }
                      return Object.entries(reactionsByType).map(([emoji, count]) => (
                        <span key={emoji} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)]">
                          <span className="text-lg">{emoji}</span>
                          <span className="text-[10px]">{count}</span>
                        </span>
                      ));
                    })()}
                  </div>
                  <span>{post.comment_count > 0 && `${post.comment_count} comment${post.comment_count !== 1 ? "s" : ""}`}</span>
                </div>
              )}

              {/* Like / Share buttons */}
              <div className="px-4 py-1.5 border-y border-[var(--border)] flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={() =>
                      myReaction
                        ? toggleReaction(post.id, myReaction.reaction_type)
                        : setShowReactions(showReactions === post.id ? null : post.id)
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      myReaction ? "text-gold-500 bg-gold-500/10" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {myReaction ? (
                      <span className="text-base">{REACTIONS.find((r) => r.type === myReaction.reaction_type)?.emoji || "\u{1F44D}"}</span>
                    ) : (
                      <ThumbsUp className="w-4 h-4" />
                    )}
                    {myReaction ? "Liked" : "Like"}
                  </button>
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
                  onClick={() => handleSharePost(post.id)}
                  className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {/* Comments */}
              <div className="px-4 pb-3">
              {post.comments
                .filter((c) => !c.parent_id)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((comment) => {
                  const cReactions = commentLikes.get(comment.id);
                  const cReactionCount = cReactions?.size || 0;
                  const myCommentReaction = cReactions?.get(user?.id || "");
                  const replies = post.comments
                    .filter((c) => c.parent_id === comment.id)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                  return (
                    <div key={comment.id} className="mt-3">
                      <div className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                          onClick={() => { setActivePostId(null); navigate(`/profile/${comment.author_id}`); }}
                        >
                          {comment.author?.avatar_url ? (
                            <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-gold-500">{comment.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingComment === comment.id ? (
                            <div className="bg-[var(--accent)] rounded-lg px-3 py-2">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditComment(comment.id); }
                                  if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); }
                                }}
                                className="w-full bg-[var(--background)] border border-gold-500/50 rounded-lg px-2 py-1 text-sm focus:outline-none resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <button onClick={() => handleEditComment(comment.id)} disabled={!editCommentText.trim()} className="text-[10px] text-gold-500 font-semibold cursor-pointer disabled:opacity-50">Save</button>
                                <button onClick={() => { setEditingComment(null); setEditCommentText(""); }} className="text-[10px] text-[var(--muted-foreground)] cursor-pointer">Cancel</button>
                              </div>
                            </div>
                          ) : (
                          <div className="bg-[var(--accent)] rounded-lg px-3 py-2">
                            <p className="text-xs font-medium text-gold-500">{comment.author?.display_name}</p>
                            {comment.content?.trim() && <LinkifyText text={comment.content} className="text-sm mt-0.5" />}
                            {comment.media_url && (
                              <img src={comment.media_url} alt="" className="mt-1 max-h-40 rounded-lg object-contain" />
                            )}
                            {comment.author_id === user?.id && (
                              <div className="flex items-center gap-2 mt-1 justify-end">
                                <button onClick={() => { setEditingComment(comment.id); setEditCommentText(comment.content); }} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">Edit</button>
                                <button onClick={() => setDeletingComment({ commentId: comment.id, postId: post.id })} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">Delete</button>
                              </div>
                            )}
                          </div>
                          )}
                          {/* Reaction pills */}
                          {cReactionCount > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5 px-1">
                              {(() => {
                                const byType: Record<string, number> = {};
                                for (const [, type] of cReactions!) { byType[type] = (byType[type] || 0) + 1; }
                                return Object.entries(byType).map(([type, count]) => {
                                  const emoji = REACTIONS.find((r) => r.type === type)?.emoji || "\u{1F44D}";
                                  return (
                                    <span key={type} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)] text-xs">
                                      <span>{emoji}</span>
                                      <span className="text-[9px] text-[var(--muted-foreground)]">{count}</span>
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-0.5 px-1 relative">
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                            <button
                              onClick={() => myCommentReaction ? toggleCommentReaction(comment.id, myCommentReaction) : setCommentReactionPicker(commentReactionPicker === comment.id ? null : comment.id)}
                              className={`text-[11px] font-semibold transition-colors cursor-pointer ${myCommentReaction ? "text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                            >
                              {myCommentReaction ? (REACTIONS.find((r) => r.type === myCommentReaction)?.emoji || "\u{1F44D}") : "Like"}
                            </button>
                            {commentReactionPicker === comment.id && (
                              <div className="absolute bottom-full left-8 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                                {REACTIONS.map((r) => (
                                  <button key={r.type} onClick={() => toggleCommentReaction(comment.id, r.type)} className="text-base hover:scale-125 transition-transform p-0.5" title={r.type}>{r.emoji}</button>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => { setReplyingTo({ postId: post.id, commentId: comment.id, authorName: comment.author?.display_name || "Unknown" }); setTimeout(() => commentInputRef.current?.focus(), 100); }}
                              className="text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                      {replies.length > 0 && (
                        <div className="ml-10 mt-1">
                          <button
                            onClick={() => setCollapsedReplies((prev) => {
                              const next = new Set(prev);
                              if (next.has(comment.id)) next.delete(comment.id);
                              else next.add(comment.id);
                              return next;
                            })}
                            className="text-[11px] font-semibold text-gold-500 hover:text-gold-400 cursor-pointer mb-1 flex items-center gap-1"
                          >
                            {collapsedReplies.has(comment.id)
                              ? `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
                              : `Hide ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
                            }
                          </button>
                          {!collapsedReplies.has(comment.id) && (
                          <div className="border-l-2 border-[var(--border)] pl-3">
                          {replies.map((reply) => {
                            const rReactions = commentLikes.get(reply.id);
                            const rReactionCount = rReactions?.size || 0;
                            const myReplyReaction = rReactions?.get(user?.id || "");
                            return (
                              <div key={reply.id} className="flex gap-2 mt-2">
                                <div
                                  className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                                  onClick={() => { setActivePostId(null); navigate(`/profile/${reply.author_id}`); }}
                                >
                                  {reply.author?.avatar_url ? (
                                    <img src={reply.author.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[9px] font-medium text-gold-500">{reply.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {editingComment === reply.id ? (
                                    <div className="bg-[var(--accent)] rounded-lg px-2.5 py-1.5">
                                      <textarea
                                        value={editCommentText}
                                        onChange={(e) => setEditCommentText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditComment(reply.id); }
                                          if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); }
                                        }}
                                        className="w-full bg-[var(--background)] border border-gold-500/50 rounded-lg px-2 py-1 text-xs focus:outline-none resize-none"
                                        rows={2}
                                        autoFocus
                                      />
                                      <div className="flex items-center gap-2 mt-1">
                                        <button onClick={() => handleEditComment(reply.id)} disabled={!editCommentText.trim()} className="text-[10px] text-gold-500 font-semibold cursor-pointer disabled:opacity-50">Save</button>
                                        <button onClick={() => { setEditingComment(null); setEditCommentText(""); }} className="text-[10px] text-[var(--muted-foreground)] cursor-pointer">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                  <div className="bg-[var(--accent)] rounded-lg px-2.5 py-1.5">
                                    <p className="text-[11px] font-medium">
                                      <span className="text-gold-500">{reply.author?.display_name}</span>
                                      <span className="text-[var(--muted-foreground)] mx-2">&gt;</span>
                                      <span className="text-sky-400">@{comment.author?.display_name}</span>
                                    </p>
                                    {reply.content?.trim() && <LinkifyText text={reply.content} className="text-xs mt-0.5" />}
                                    {reply.media_url && <img src={reply.media_url} alt="" className="mt-1 max-h-32 rounded-lg object-contain" />}
                                    {reply.author_id === user?.id && (
                                      <div className="flex items-center gap-2 mt-1 justify-end">
                                        <button onClick={() => { setEditingComment(reply.id); setEditCommentText(reply.content); }} className="text-[9px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">Edit</button>
                                        <button onClick={() => setDeletingComment({ commentId: reply.id, postId: post.id })} className="text-[9px] text-red-400 hover:text-red-300 cursor-pointer">Delete</button>
                                      </div>
                                    )}
                                  </div>
                                  )}
                                  {rReactionCount > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 mt-0.5 px-1">
                                      {(() => {
                                        const byType: Record<string, number> = {};
                                        for (const [, type] of rReactions!) { byType[type] = (byType[type] || 0) + 1; }
                                        return Object.entries(byType).map(([type, count]) => {
                                          const emoji = REACTIONS.find((r) => r.type === type)?.emoji || "\u{1F44D}";
                                          return (
                                            <span key={type} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)] text-xs">
                                              <span>{emoji}</span>
                                              <span className="text-[9px] text-[var(--muted-foreground)]">{count}</span>
                                            </span>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-3 mt-0.5 px-1 relative">
                                    <span className="text-[10px] text-[var(--muted-foreground)]">
                                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                    </span>
                                    <button
                                      onClick={() => myReplyReaction ? toggleCommentReaction(reply.id, myReplyReaction) : setCommentReactionPicker(commentReactionPicker === reply.id ? null : reply.id)}
                                      className={`text-[10px] font-semibold transition-colors cursor-pointer ${myReplyReaction ? "text-gold-500" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                                    >
                                      {myReplyReaction ? (REACTIONS.find((r) => r.type === myReplyReaction)?.emoji || "\u{1F44D}") : "Like"}
                                    </button>
                                    {commentReactionPicker === reply.id && (
                                      <div className="absolute bottom-full left-8 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                                        {REACTIONS.map((r) => (
                                          <button key={r.type} onClick={() => toggleCommentReaction(reply.id, r.type)} className="text-sm hover:scale-125 transition-transform p-0.5" title={r.type}>{r.emoji}</button>
                                        ))}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => { setReplyingTo({ postId: post.id, commentId: comment.id, authorName: reply.author?.display_name || "Unknown" }); setTimeout(() => commentInputRef.current?.focus(), 100); }}
                                      className="text-[10px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                                    >
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            </div>{/* end scrollable content + comments */}

            {/* Fixed bottom: reply indicator + toolbar + comment input */}
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--card)]">
              {replyingTo && replyingTo.postId === post.id && (
                <div className="flex items-center gap-2 px-4 pt-2 text-xs text-gold-500">
                  <Reply className="w-3 h-3" />
                  <span>Replying to {replyingTo.authorName}</span>
                  <button onClick={() => setReplyingTo(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 px-4 py-3 items-center">
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">{profile?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    ref={commentInputRef}
                    value={commentTexts[post.id] || ""}
                    onChange={(e) => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); }
                    }}
                    placeholder={replyingTo?.postId === post.id ? `Reply to ${replyingTo.authorName}...` : "Write a comment..."}
                    className="flex-1 rounded-full border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                  <CommentToolbar
                    postId={post.id}
                    onEmojiSelect={(emoji) => setCommentTexts({ ...commentTexts, [post.id]: (commentTexts[post.id] || "") + emoji })}
                    onMediaSelect={(url) => submitComment(post.id, url)}
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
          </div>
        );

        // Mobile single-column layout with image on top
        const mobileModal = (
          <div className="fixed z-[70] inset-0 bg-[var(--card)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <button onClick={() => { setActivePostId(null); setEditingPost(null); setReplyingTo(null); }} className="p-1.5 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">{post.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <span className="text-sm font-medium">{post.author?.display_name}</span>
              </div>
              <div className="w-8" />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Media */}
              {hasMedia && activePostMode === "full" && (
                <div className="bg-black">
                  {post.media.map((m) =>
                    m.media_type === "video" ? (
                      <video key={m.id} src={m.media_url} controls className="w-full max-h-[60vh] object-contain" />
                    ) : (
                      <img key={m.id} src={m.media_url} alt="" className="w-full max-h-[60vh] object-contain" />
                    )
                  )}
                </div>
              )}

              {/* Post content */}
              {post.content && (
                <div className="px-4 py-2">
                  <FoldableContent text={post.content} lines={9} />
                </div>
              )}

              {/* Reaction counts */}
              {(post.reaction_count > 0 || post.comment_count > 0) && (
                <div className="px-4 py-1.5 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    {post.reaction_count > 0 && (() => {
                      const reactionsByType: Record<string, number> = {};
                      for (const r of post.reactions || []) {
                        const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                        reactionsByType[emoji] = (reactionsByType[emoji] || 0) + 1;
                      }
                      return Object.entries(reactionsByType).map(([emoji, count]) => (
                        <span key={emoji} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)]">
                          <span className="text-lg">{emoji}</span>
                          <span className="text-[10px]">{count}</span>
                        </span>
                      ));
                    })()}
                  </div>
                  <span>{post.comment_count > 0 && `${post.comment_count} comment${post.comment_count !== 1 ? "s" : ""}`}</span>
                </div>
              )}

              {/* Like / Share */}
              <div className="px-4 py-1.5 border-y border-[var(--border)] flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={() => myReaction ? toggleReaction(post.id, myReaction.reaction_type) : setShowReactions(showReactions === post.id ? null : post.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${myReaction ? "text-gold-500 bg-gold-500/10" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
                  >
                    {myReaction ? (
                      <span className="text-base">{REACTIONS.find((r) => r.type === myReaction.reaction_type)?.emoji || "\u{1F44D}"}</span>
                    ) : (
                      <ThumbsUp className="w-4 h-4" />
                    )}
                    {myReaction ? "Liked" : "Like"}
                  </button>
                  {showReactions === post.id && (
                    <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                      {REACTIONS.map((r) => (
                        <button key={r.type} onClick={() => toggleReaction(post.id, r.type)} className="text-lg hover:scale-125 transition-transform p-1" title={r.type}>{r.emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => handleSharePost(post.id)} className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>

              {/* Comments */}
              <div className="px-4 pb-3">
                {post.comments
                  .filter((c) => !c.parent_id)
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((comment) => {
                    const cReactions = commentLikes.get(comment.id);
                    const cReactionCount = cReactions?.size || 0;
                    const myCommentReaction = cReactions?.get(user?.id || "");
                    const replies = post.comments
                      .filter((c) => c.parent_id === comment.id)
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                    return (
                      <div key={comment.id} className="mt-3">
                        <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {comment.author?.avatar_url ? (
                              <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium text-gold-500">{comment.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingComment === comment.id ? (
                              <div className="bg-[var(--accent)] rounded-lg px-3 py-2">
                                <textarea
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditComment(comment.id); }
                                    if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); }
                                  }}
                                  className="w-full bg-[var(--background)] border border-gold-500/50 rounded-lg px-2 py-1 text-sm focus:outline-none resize-none"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex items-center gap-2 mt-1">
                                  <button onClick={() => handleEditComment(comment.id)} disabled={!editCommentText.trim()} className="text-[10px] text-gold-500 font-semibold cursor-pointer disabled:opacity-50">Save</button>
                                  <button onClick={() => { setEditingComment(null); setEditCommentText(""); }} className="text-[10px] text-[var(--muted-foreground)] cursor-pointer">Cancel</button>
                                </div>
                              </div>
                            ) : (
                            <div className="bg-[var(--accent)] rounded-lg px-3 py-2">
                              <p className="text-xs font-medium text-gold-500">{comment.author?.display_name}</p>
                              <LinkifyText text={comment.content} className="text-sm mt-0.5" />
                              {comment.author_id === user?.id && (
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                  <button onClick={() => { setEditingComment(comment.id); setEditCommentText(comment.content); }} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">Edit</button>
                                  <button onClick={() => setDeletingComment({ commentId: comment.id, postId: post.id })} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">Delete</button>
                                </div>
                              )}
                            </div>
                            )}
                            {cReactionCount > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5 px-1">
                                {(() => {
                                  const byType: Record<string, number> = {};
                                  for (const [, type] of cReactions!) { byType[type] = (byType[type] || 0) + 1; }
                                  return Object.entries(byType).map(([type, count]) => {
                                    const emoji = REACTIONS.find((r) => r.type === type)?.emoji || "\u{1F44D}";
                                    return (
                                      <span key={type} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-[var(--accent)] border border-[var(--border)] text-xs">
                                        <span>{emoji}</span><span className="text-[9px] text-[var(--muted-foreground)]">{count}</span>
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-0.5 px-1 relative">
                              <span className="text-[10px] text-[var(--muted-foreground)]">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                              <button
                                onTouchStart={(e) => { e.stopPropagation(); }}
                                onClick={() => myCommentReaction ? toggleCommentReaction(comment.id, myCommentReaction) : setCommentReactionPicker(commentReactionPicker === comment.id ? null : comment.id)}
                                className={`text-[11px] font-semibold transition-colors cursor-pointer ${myCommentReaction ? "text-gold-500" : "text-[var(--muted-foreground)]"}`}
                              >
                                {myCommentReaction ? (REACTIONS.find((r) => r.type === myCommentReaction)?.emoji || "\u{1F44D}") : "Like"}
                              </button>
                              {commentReactionPicker === comment.id && (
                                <div className="absolute bottom-full left-8 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                                  {REACTIONS.map((r) => (<button key={r.type} onClick={() => toggleCommentReaction(comment.id, r.type)} className="text-base hover:scale-125 transition-transform p-0.5">{r.emoji}</button>))}
                                </div>
                              )}
                              <button
                                onClick={() => { setReplyingTo({ postId: post.id, commentId: comment.id, authorName: comment.author?.display_name || "Unknown" }); setTimeout(() => commentInputRef.current?.focus(), 100); }}
                                className="text-[11px] font-semibold text-[var(--muted-foreground)] cursor-pointer"
                              >Reply</button>
                            </div>
                          </div>
                        </div>
                        {replies.length > 0 && (
                          <div className="ml-10 mt-1">
                            <button
                              onClick={() => setCollapsedReplies((prev) => { const next = new Set(prev); if (next.has(comment.id)) next.delete(comment.id); else next.add(comment.id); return next; })}
                              className="text-[11px] font-semibold text-gold-500 cursor-pointer mb-1"
                            >
                              {collapsedReplies.has(comment.id) ? `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : `Hide ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                            </button>
                            {!collapsedReplies.has(comment.id) && (
                              <div className="border-l-2 border-[var(--border)] pl-3">
                                {replies.map((reply) => {
                                  const rReactions = commentLikes.get(reply.id);
                                  const myReplyReaction = rReactions?.get(user?.id || "");
                                  return (
                                    <div key={reply.id} className="flex gap-2 mt-2">
                                      <div className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {reply.author?.avatar_url ? (
                                          <img src={reply.author.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[9px] font-medium text-gold-500">{reply.author?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        {editingComment === reply.id ? (
                                          <div className="bg-[var(--accent)] rounded-lg px-2.5 py-1.5">
                                            <textarea
                                              value={editCommentText}
                                              onChange={(e) => setEditCommentText(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditComment(reply.id); }
                                                if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); }
                                              }}
                                              className="w-full bg-[var(--background)] border border-gold-500/50 rounded-lg px-2 py-1 text-xs focus:outline-none resize-none"
                                              rows={2}
                                              autoFocus
                                            />
                                            <div className="flex items-center gap-2 mt-1">
                                              <button onClick={() => handleEditComment(reply.id)} disabled={!editCommentText.trim()} className="text-[10px] text-gold-500 font-semibold cursor-pointer disabled:opacity-50">Save</button>
                                              <button onClick={() => { setEditingComment(null); setEditCommentText(""); }} className="text-[10px] text-[var(--muted-foreground)] cursor-pointer">Cancel</button>
                                            </div>
                                          </div>
                                        ) : (
                                        <div className="bg-[var(--accent)] rounded-lg px-2.5 py-1.5">
                                          <p className="text-[11px] font-medium">
                                            <span className="text-gold-500">{reply.author?.display_name}</span>
                                            <span className="text-[var(--muted-foreground)] mx-2">&gt;</span>
                                            <span className="text-sky-400">@{comment.author?.display_name}</span>
                                          </p>
                                          {reply.content?.trim() && <LinkifyText text={reply.content} className="text-xs mt-0.5" />}
                                    {reply.media_url && <img src={reply.media_url} alt="" className="mt-1 max-h-32 rounded-lg object-contain" />}
                                          {reply.author_id === user?.id && (
                                            <div className="flex items-center gap-2 mt-1 justify-end">
                                              <button onClick={() => { setEditingComment(reply.id); setEditCommentText(reply.content); }} className="text-[9px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">Edit</button>
                                              <button onClick={() => setDeletingComment({ commentId: reply.id, postId: post.id })} className="text-[9px] text-red-400 hover:text-red-300 cursor-pointer">Delete</button>
                                            </div>
                                          )}
                                        </div>
                                        )}
                                        <div className="flex items-center gap-3 mt-0.5 px-1 relative">
                                          <span className="text-[10px] text-[var(--muted-foreground)]">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                                          <button
                                            onClick={() => myReplyReaction ? toggleCommentReaction(reply.id, myReplyReaction) : setCommentReactionPicker(commentReactionPicker === reply.id ? null : reply.id)}
                                            className={`text-[10px] font-semibold cursor-pointer ${myReplyReaction ? "text-gold-500" : "text-[var(--muted-foreground)]"}`}
                                          >
                                            {myReplyReaction ? (REACTIONS.find((r) => r.type === myReplyReaction)?.emoji || "\u{1F44D}") : "Like"}
                                          </button>
                                          {commentReactionPicker === reply.id && (
                                            <div className="absolute bottom-full left-8 mb-1 flex gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-lg z-10">
                                              {REACTIONS.map((r) => (<button key={r.type} onClick={() => toggleCommentReaction(reply.id, r.type)} className="text-sm hover:scale-125 transition-transform p-0.5">{r.emoji}</button>))}
                                            </div>
                                          )}
                                          <button
                                            onClick={() => { setReplyingTo({ postId: post.id, commentId: comment.id, authorName: reply.author?.display_name || "Unknown" }); setTimeout(() => commentInputRef.current?.focus(), 100); }}
                                            className="text-[10px] font-semibold text-[var(--muted-foreground)] cursor-pointer"
                                          >Reply</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Fixed input - uses sticky so keyboard pushes it up naturally */}
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--card)]">
              {replyingTo && replyingTo.postId === post.id && (
                <div className="flex items-center gap-2 px-4 pt-2 text-xs text-gold-500">
                  <Reply className="w-3 h-3" />
                  <span>Replying to {replyingTo.authorName}</span>
                  <button onClick={() => setReplyingTo(null)} className="text-[var(--muted-foreground)] cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
              )}
              <div className="flex gap-2 px-4 py-2 items-center">
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">{profile?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    ref={commentInputRef}
                    value={commentTexts[post.id] || ""}
                    onChange={(e) => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
                    placeholder={replyingTo?.postId === post.id ? `Reply to ${replyingTo.authorName}...` : "Write a comment..."}
                    className="flex-1 rounded-full border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                  <CommentToolbar
                    postId={post.id}
                    onEmojiSelect={(emoji) => setCommentTexts({ ...commentTexts, [post.id]: (commentTexts[post.id] || "") + emoji })}
                    onMediaSelect={(url) => submitComment(post.id, url)}
                  />
                  <button onClick={() => submitComment(post.id)} disabled={!commentTexts[post.id]?.trim()} className="p-1.5 rounded-full text-gold-500 hover:bg-gold-500/10 disabled:opacity-30 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

        return (
          <>
            <div className="fixed z-[60] bg-black/60" style={{ top: 0, left: 0, right: 0, bottom: 0, height: "100vh", width: "100vw" }} onClick={() => { setActivePostId(null); setEditingPost(null); setReplyingTo(null); }} />

            {/* Mobile: full-screen single column */}
            <div className="lg:hidden">
              {mobileModal}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block">
            {activePostMode === "full" && hasMedia ? (
              /* ---- Two-column layout: Image left, info+comments right ---- */
              <div className="fixed z-[70] inset-0 flex items-stretch justify-center p-4" onClick={() => { setActivePostId(null); setEditingPost(null); setReplyingTo(null); }}>
                <div className="flex w-full max-w-6xl h-full rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  {/* Left: Media */}
                  <div className="flex-1 bg-black flex items-center justify-center min-w-0 overflow-hidden">
                    {post.media.map((m) =>
                      m.media_type === "video" ? (
                        <video key={m.id} src={m.media_url} controls className="w-full h-full object-contain" />
                      ) : (
                        <img key={m.id} src={m.media_url} alt="" className="w-full h-full object-contain" />
                      )
                    )}
                  </div>
                  {/* Right: Info + Comments */}
                  <div className="w-[420px] flex-shrink-0 bg-[var(--card)] border-l border-[var(--border)] flex flex-col h-full">
                    {commentsPanel}
                  </div>
                </div>
              </div>
            ) : (
              /* ---- Single column layout: Comments or text-only post ---- */
              <div className="fixed z-[70] top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ height: "100vh", maxHeight: "100vh", left: "calc(50% + 2.5vw)" }}>
                {commentsPanel}
              </div>
            )}
            </div>

            {/* Reaction details modal */}
            {showReactionDetails === post.id && post.reactions.length > 0 && (
              <>
                <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setShowReactionDetails(null)} />
                <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <h3 className="font-semibold text-sm">Reactions ({post.reactions.length})</h3>
                    <button onClick={() => setShowReactionDetails(null)} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {post.reactions.map((r: any) => {
                      const emoji = REACTIONS.find((rx) => rx.type === r.reaction_type)?.emoji || "\u{1F44D}";
                      const isFam = members.some((m) => m.user_id === r.user_id);
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setShowReactionDetails(null); setActivePostId(null); navigate(`/profile/${r.user_id}`); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                        >
                          <span className="text-xl">{emoji}</span>
                          <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {r.user?.avatar_url ? (
                              <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium text-gold-500">{r.user?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{r.user?.display_name || "Unknown"}</span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {r.user_id === user?.id ? "You" : isFam ? "Fam" : "Not in your family"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Delete confirmation modal */}
      {deletingPost && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setDeletingPost(null)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold text-lg">Delete post?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              This will permanently delete the post, its media, reactions, and comments. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-5 justify-center">
              <button
                onClick={() => setDeletingPost(null)}
                className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePost(deletingPost)}
                className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete comment confirmation modal */}
      {deletingComment && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setDeletingComment(null)} />
          <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-6 w-full max-w-xs text-center">
            <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold">Delete comment?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              This will permanently delete the comment and any replies. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-5 justify-center">
              <button
                onClick={() => setDeletingComment(null)}
                className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDeleteComment(deletingComment.commentId, deletingComment.postId); setDeletingComment(null); }}
                className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share copied toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-green-400" />
          Link copied to clipboard
        </div>
      )}
      {/* Mobile filter bottom sheet */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden" onClick={() => setFilterOpen(false)} />
          <div className="fixed z-[70] bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] rounded-t-2xl lg:hidden" style={{ maxHeight: "70vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gold-500" />
                <span className="font-semibold text-sm">Filter by Member</span>
              </div>
              <div className="flex items-center gap-3">
                {filterByMembers.size > 0 && (
                  <button onClick={() => setFilterByMembers(new Set())} className="text-xs text-gold-500 cursor-pointer">Clear</button>
                )}
                <button onClick={() => setFilterOpen(false)} className="p-1 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Drag handle */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--muted-foreground)]/30" />
            <div className="overflow-y-auto p-3 space-y-1" style={{ maxHeight: "calc(70vh - 56px)" }}>
              {members.map((member) => {
                const p = member.profile;
                const isSelected = filterByMembers.has(member.user_id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMemberFilter(member.user_id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer text-left ${
                      isSelected ? "bg-gold-500/15 border border-gold-500/30" : "hover:bg-[var(--accent)] border border-transparent"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 ${isSelected ? "ring-2 ring-gold-500" : "bg-gold-500/20"}`}>
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gold-500">{p?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <span className={`text-sm truncate ${isSelected ? "font-medium text-gold-500" : ""}`}>
                      {p?.display_name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      </div>
      </div>
    </div>
  );
}
