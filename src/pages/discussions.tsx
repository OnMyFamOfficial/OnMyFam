import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Clock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import type { Discussion, Profile } from "@/lib/types";

type FullDiscussion = Discussion & { author: Profile };

export default function DiscussionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const [discussions, setDiscussions] = useState<FullDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "",
  });

  useEffect(() => {
    if (currentFamily) loadDiscussions();
  }, [currentFamily]);

  async function loadDiscussions() {
    if (!currentFamily) return;
    setLoading(true);

    const { data } = await supabase
      .from("discussions")
      .select("*")
      .eq("family_id", currentFamily.id)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (!data || data.length === 0) {
      setDiscussions([]);
      setLoading(false);
      return;
    }

    // Fetch author profiles
    const authorIds = [...new Set(data.map((d) => d.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", authorIds);

    const profileMap = new Map<string, Profile>();
    for (const p of (profiles || []) as Profile[]) {
      profileMap.set(p.id, p);
    }

    setDiscussions(
      data.map((d) => ({
        ...d,
        author: profileMap.get(d.author_id),
      })) as FullDiscussion[]
    );
    setLoading(false);
  }

  async function handleCreate() {
    if (!user || !currentFamily || !form.title.trim() || !form.content.trim())
      return;
    setSaving(true);

    const { data, error } = await supabase
      .from("discussions")
      .insert({
        family_id: currentFamily.id,
        author_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      navigate(`/discussions/${data.id}`);
    }
    setSaving(false);
  }

  if (!currentFamily) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h1 className="text-2xl font-bold">Discussions</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Create or join a family first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discussions</h1>
          <p className="text-[var(--muted-foreground)]">
            Family conversations and topics
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Thread
        </button>
      </div>

      {creating && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Start a Discussion</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="What do you want to talk about?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Category (optional)
            </label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              placeholder="recipes, planning, memories..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Content *
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
              placeholder="Share your thoughts..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={
                saving || !form.title.trim() || !form.content.trim()
              }
              className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Posting..." : "Post Discussion"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setForm({ title: "", content: "", category: "" });
              }}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Loading discussions...
        </div>
      ) : discussions.length === 0 ? (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
          <div className="text-5xl mb-4">&#x1F4AC;</div>
          <h2 className="text-xl font-semibold">No discussions yet</h2>
          <p className="text-[var(--muted-foreground)] mt-2">
            Start a conversation with your family!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {discussions.map((disc) => (
            <div
              key={disc.id}
              onClick={() => navigate(`/discussions/${disc.id}`)}
              className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4 cursor-pointer hover:border-gold-500/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {disc.author?.avatar_url ? (
                    <img
                      src={disc.author.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gold-500">
                      {disc.author?.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {disc.is_pinned && (
                      <span className="text-[10px] font-medium uppercase text-gold-500 px-1.5 py-0.5 bg-gold-500/10 rounded">
                        Pinned
                      </span>
                    )}
                    {disc.category && (
                      <span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] px-1.5 py-0.5 bg-[var(--accent)] rounded">
                        {disc.category}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold mt-1 truncate">{disc.title}</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                    {disc.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted-foreground)]">
                    <span>{disc.author?.display_name}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {disc.reply_count} replies
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(disc.updated_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
