import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import type { Discussion, DiscussionReply, Profile } from "@/lib/types";

type FullDiscussion = Discussion & { author: Profile };
type FullReply = DiscussionReply & { author: Profile };

export default function DiscussionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<FullDiscussion | null>(null);
  const [replies, setReplies] = useState<FullReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id) loadDiscussion();
  }, [id]);

  async function loadDiscussion() {
    if (!id) return;
    setLoading(true);

    const [discRes, repliesRes] = await Promise.all([
      supabase
        .from("discussions")
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("discussion_replies")
        .select("*")
        .eq("discussion_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (!discRes.data) {
      setLoading(false);
      return;
    }

    // Fetch author profiles separately
    const authorIds = new Set<string>();
    authorIds.add(discRes.data.author_id);
    for (const r of repliesRes.data || []) {
      authorIds.add((r as DiscussionReply).author_id);
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", [...authorIds]);

    const profileMap = new Map<string, Profile>();
    for (const p of (profiles || []) as Profile[]) {
      profileMap.set(p.id, p);
    }

    setDiscussion({
      ...discRes.data,
      author: profileMap.get(discRes.data.author_id),
    } as FullDiscussion);
    setReplies(
      ((repliesRes.data || []) as DiscussionReply[]).map((r) => ({
        ...r,
        author: profileMap.get(r.author_id),
      })) as FullReply[]
    );
    setLoading(false);
  }

  async function handleReply() {
    if (!user || !id || !replyText.trim()) return;
    setSending(true);

    await supabase.from("discussion_replies").insert({
      discussion_id: id,
      author_id: user.id,
      content: replyText.trim(),
    });

    setReplyText("");
    setSending(false);
    await loadDiscussion();
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Loading discussion...
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        Discussion not found
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Original post */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <div className="flex items-center gap-2 mb-2">
          {discussion.category && (
            <span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] px-1.5 py-0.5 bg-[var(--accent)] rounded">
              {discussion.category}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{discussion.title}</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden">
            {discussion.author?.avatar_url ? (
              <img
                src={discussion.author.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-gold-500">
                {discussion.author?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {discussion.author?.display_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {formatDistanceToNow(new Date(discussion.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 text-sm whitespace-pre-wrap">
          {discussion.content}
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h3 className="font-semibold">
          Replies ({replies.length})
        </h3>

        {replies.map((reply) => (
          <div
            key={reply.id}
            className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden">
                {reply.author?.avatar_url ? (
                  <img
                    src={reply.author.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-gold-500">
                    {reply.author?.display_name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {reply.author?.display_name}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatDistanceToNow(new Date(reply.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-3 text-sm whitespace-pre-wrap pl-11">
              {reply.content}
            </div>
          </div>
        ))}
      </div>

      {/* Reply composer */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={3}
          placeholder="Write a reply..."
          className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleReply}
            disabled={sending || !replyText.trim()}
            className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
