import { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Home,
  MessageCircle,
  FileText,
  Calendar,
  Camera,
  MessageSquare,
  Eye,
  UserPlus,
  Trash2,
  Crown,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import type { Profile, Family, Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminStats {
  total_users: number;
  total_families: number;
  total_posts: number;
  total_events: number;
  total_conversations: number;
  total_messages: number;
  total_albums: number;
  total_discussions: number;
}

type AdminTab = "overview" | "users" | "families" | "conversations" | "content";

export default function AdminPage() {
  const { isGodMode } = useAuth();

  if (!isGodMode) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500/50" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-[var(--muted-foreground)]">God Mode required.</p>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    const { data } = await supabase.rpc("admin_get_stats");
    if (data) setStats(data as AdminStats);
    setLoading(false);
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Shield }[] = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "users", label: "Users", icon: Users },
    { id: "families", label: "Families", icon: Home },
    { id: "conversations", label: "Conversations", icon: MessageCircle },
    { id: "content", label: "Content", icon: FileText },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* God Mode Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            God Mode
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">ADMIN</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">Full access to all data and controls</p>
        </div>
        <button
          onClick={fetchStats}
          className="ml-auto p-2 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer"
          title="Refresh stats"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)] pb-px overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer",
              activeTab === tab.id
                ? "bg-[var(--accent)] text-[var(--foreground)] border-b-2 border-red-500"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab stats={stats} loading={loading} />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "families" && <FamiliesTab />}
      {activeTab === "conversations" && <ConversationsTab />}
      {activeTab === "content" && <ContentTab />}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({ stats, loading }: { stats: AdminStats | null; loading: boolean }) {
  if (loading || !stats) {
    return <div className="text-center py-8 text-[var(--muted-foreground)]">Loading stats...</div>;
  }

  const cards = [
    { label: "Users", value: stats.total_users, icon: Users, color: "text-blue-400" },
    { label: "Families", value: stats.total_families, icon: Home, color: "text-green-400" },
    { label: "Posts", value: stats.total_posts, icon: FileText, color: "text-purple-400" },
    { label: "Events", value: stats.total_events, icon: Calendar, color: "text-orange-400" },
    { label: "Conversations", value: stats.total_conversations, icon: MessageCircle, color: "text-cyan-400" },
    { label: "Messages", value: stats.total_messages, icon: MessageSquare, color: "text-pink-400" },
    { label: "Albums", value: stats.total_albums, icon: Camera, color: "text-yellow-400" },
    { label: "Discussions", value: stats.total_discussions, icon: MessageSquare, color: "text-indigo-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--muted-foreground)]">{card.label}</span>
            <card.icon className={cn("w-4 h-4", card.color)} />
          </div>
          <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase.rpc("admin_list_profiles");
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  }

  async function toggleGodMode(userId: string, enabled: boolean) {
    await supabase.rpc("admin_set_god_mode", { p_user_id: userId, p_enabled: enabled });
    fetchUsers();
  }

  const filtered = search
    ? users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(search.toLowerCase()) ||
          u.id.includes(search)
      )
    : users;

  return (
    <div>
      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--input)] rounded-lg px-3 py-2 mb-4">
        <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="Search users by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">Loading users...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gold-500">
                    {u.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.display_name}</span>
                  {u.is_god_mode && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      GOD
                    </span>
                  )}
                  {u.id === currentUser?.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-500/15 text-gold-500 font-medium">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] truncate">{u.id}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {u.location || "No location"} | Joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => toggleGodMode(u.id, !u.is_god_mode)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer",
                      u.is_god_mode
                        ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {u.is_god_mode ? "Revoke God" : "Grant God"}
                  </button>
                )}
                <button
                  className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  title="View profile"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Families Tab ───────────────────────────────────────────

function FamiliesTab() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<(Family & { members?: { user_id: string; role: string; profile: Profile }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchFamilies();
  }, []);

  async function fetchFamilies() {
    setLoading(true);
    const { data } = await supabase.rpc("admin_list_families");
    if (data) {
      const fams = data as Family[];
      // Fetch members for each family
      const withMembers = await Promise.all(
        fams.map(async (f) => {
          const { data: members } = await supabase
            .from("family_members")
            .select("user_id, role, profile:profiles(*)")
            .eq("family_id", f.id);
          return { ...f, members: ((members || []) as unknown as { user_id: string; role: string; profile: Profile }[]) };
        })
      );
      setFamilies(withMembers);
    }
    setLoading(false);
  }

  async function joinFamily(familyId: string) {
    await supabase.rpc("admin_join_family", { p_family_id: familyId });
    fetchFamilies();
  }

  async function removeMember(familyId: string, userId: string) {
    await supabase.rpc("admin_remove_member", { p_family_id: familyId, p_user_id: userId });
    fetchFamilies();
  }

  if (loading) {
    return <div className="text-center py-8 text-[var(--muted-foreground)]">Loading families...</div>;
  }

  return (
    <div className="space-y-3">
      {families.map((f) => {
        const expanded = expandedId === f.id;
        const isMember = f.members?.some((m) => m.user_id === user?.id);

        return (
          <div key={f.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Family header */}
            <button
              onClick={() => setExpandedId(expanded ? null : f.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-gold-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{f.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
                    {f.member_count} members
                  </span>
                  {isMember && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                      Joined
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  {f.description || "No description"} | Created {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isMember && (
                  <button
                    onClick={(e) => { e.stopPropagation(); joinFamily(f.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gold-500 text-white font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                    Join
                  </button>
                )}
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>

            {/* Members list */}
            {expanded && (
              <div className="border-t border-[var(--border)] px-4 py-2">
                {f.members && f.members.length > 0 ? (
                  f.members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {m.profile?.avatar_url ? (
                          <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-gold-500">
                            {m.profile?.display_name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <span className="text-sm flex-1 truncate">{m.profile?.display_name || "Unknown"}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        m.role === "admin" ? "bg-gold-500/15 text-gold-500" :
                        m.role === "moderator" ? "bg-blue-500/15 text-blue-400" :
                        "bg-[var(--accent)] text-[var(--muted-foreground)]"
                      )}>
                        {m.role}
                      </span>
                      {m.user_id !== user?.id && (
                        <button
                          onClick={() => removeMember(f.id, m.user_id)}
                          className="p-1 rounded hover:bg-red-500/15 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] py-2">No members</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {families.length === 0 && (
        <div className="text-center py-8 text-[var(--muted-foreground)]">No families found</div>
      )}
    </div>
  );
}

// ─── Conversations Tab ──────────────────────────────────────

function ConversationsTab() {
  const { setActiveConversationId, setChatPanelOpen } = useChat();
  const [conversations, setConversations] = useState<(Conversation & { participants?: { user_id: string; profile: Profile }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    setLoading(true);
    const { data } = await supabase.rpc("admin_list_conversations");
    if (data) {
      const convos = data as Record<string, unknown>[];
      const withParticipants = await Promise.all(
        convos.map(async (c) => {
          const { data: parts } = await supabase
            .from("conversation_participants")
            .select("user_id, profile:profiles(*)")
            .eq("conversation_id", c.id as string);
          return { ...c, participants: (parts || []) as unknown as { user_id: string; profile: Profile }[] };
        })
      );
      setConversations(withParticipants as typeof conversations);
    }
    setLoading(false);
  }

  const filtered = search
    ? conversations.filter((c) => {
        const names = c.participants?.map((p: { profile?: Profile }) => p.profile?.display_name || "").join(" ") || "";
        return (
          (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
          names.toLowerCase().includes(search.toLowerCase())
        );
      })
    : conversations;

  if (loading) {
    return <div className="text-center py-8 text-[var(--muted-foreground)]">Loading conversations...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--input)] rounded-lg px-3 py-2 mb-4">
        <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((c) => {
          const participantNames = c.participants?.map((p: { profile?: Profile }) => p.profile?.display_name || "?").join(", ") || "No participants";
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-gold-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {c.name || participantNames}
                  </span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    c.type === "group" ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                  )}>
                    {c.type === "group" ? "Group" : "DM"}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  {c.last_message_preview || "No messages"} | {c.participants?.length || 0} participants
                </p>
                {c.last_message_at && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Last active: {new Date(c.last_message_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setActiveConversationId(c.id);
                  setChatPanelOpen(true);
                }}
                className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                title="Open conversation"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[var(--muted-foreground)]">No conversations found</div>
        )}
      </div>
    </div>
  );
}

// ─── Content Tab ────────────────────────────────────────────

function ContentTab() {
  const [posts, setPosts] = useState<{ id: string; content: string; author_id: string; family_id: string; created_at: string; author?: Profile }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    // God mode RLS lets us see all posts
    const { data } = await supabase
      .from("posts")
      .select("id, content, author_id, family_id, created_at, author:profiles!posts_author_id_fkey(display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as unknown as typeof posts);
    setLoading(false);
  }

  async function deletePost(postId: string) {
    await supabase.rpc("admin_delete_post", { p_post_id: postId });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (loading) {
    return <div className="text-center py-8 text-[var(--muted-foreground)]">Loading content...</div>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--muted-foreground)] mb-3">Recent Posts (last 50)</h3>
      <div className="space-y-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex items-start gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
          >
            <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {(post.author as any)?.avatar_url ? (
                <img src={(post.author as any).avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-gold-500">
                  {(post.author as any)?.display_name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{(post.author as any)?.display_name || "Unknown"}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                {post.content || "(no text content)"}
              </p>
            </div>
            <button
              onClick={() => deletePost(post.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
              title="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-8 text-[var(--muted-foreground)]">No posts found</div>
        )}
      </div>
    </div>
  );
}
