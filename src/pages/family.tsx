import { useState } from "react";
import { Users, Crown, Shield, Copy, Check, Plus, Search, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface SearchResult {
  id: string;
  name: string;
  description: string | null;
  privacy_level: string;
  member_count: number;
  established_year: number | null;
}

export default function FamilyPage() {
  const { user } = useAuth();
  const { currentFamily, members, refreshFamilies } = useFamily();
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    established_year: "",
  });
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  async function handleCreateFamily() {
    if (!user || !form.name.trim()) return;
    setSaving(true);

    const { data: family, error } = await supabase
      .from("families")
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        established_year: form.established_year
          ? parseInt(form.established_year)
          : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !family) {
      console.error("Create family error:", error);
      setSaving(false);
      return;
    }

    await supabase.from("family_members").insert({
      family_id: family.id,
      user_id: user.id,
      role: "admin",
      relation_label: "Creator",
    });

    await refreshFamilies();
    setCreating(false);
    setSaving(false);
    setForm({ name: "", description: "", established_year: "" });
  }

  async function handleCreateInvite() {
    if (!currentFamily || !user) return;

    const { data, error } = await supabase
      .from("invites")
      .insert({
        family_id: currentFamily.id,
        created_by: user.id,
        max_uses: 10,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setInviteToken(data.token);
    }
  }

  function copyInviteLink() {
    if (!inviteToken) return;
    const link = `${window.location.origin}/invite/${inviteToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase.rpc("search_families", { p_query: searchQuery.trim() });
    setSearchResults((data || []) as SearchResult[]);
    setSearchLoading(false);
  }

  async function handleJoinFamily(familyId: string) {
    if (!user) return;
    setJoining(familyId);

    // Check if already a member
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", familyId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setJoinSuccess(familyId);
      setJoining(null);
      await refreshFamilies();
      return;
    }

    const { error } = await supabase.from("family_members").insert({
      family_id: familyId,
      user_id: user.id,
      role: "member",
    });

    if (error) {
      console.error("Join family error:", error);
    } else {
      setJoinSuccess(familyId);
      await refreshFamilies();
    }
    setJoining(null);
  }

  // No family yet
  if (!currentFamily) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Family</h1>
          <p className="text-[var(--muted-foreground)]">
            Create or join a family circle
          </p>
        </div>

        {!creating && !searching ? (
          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
            <div className="text-5xl mb-4">&#x1F46A;</div>
            <h2 className="text-xl font-semibold">No family set up yet</h2>
            <p className="text-[var(--muted-foreground)] mt-2">
              Create your family circle or find one to join.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => setCreating(true)}
                className="px-6 py-2.5 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Family
              </button>
              <button
                onClick={() => setSearching(true)}
                className="px-6 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Find a Family
              </button>
            </div>
          </div>
        ) : creating ? (
          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Your Family</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Family Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="The Williams Family"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                placeholder="A little about your family..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Established Year</label>
              <input
                value={form.established_year}
                onChange={(e) => setForm({ ...form, established_year: e.target.value })}
                type="number"
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="1990"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateFamily}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Family"}
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Search for a family */
          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4">
            <h2 className="text-lg font-semibold">Find a Family</h2>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[var(--background)] border border-[var(--input)] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="Search by family name..."
                  className="bg-transparent text-sm outline-none w-full"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((fam) => (
                  <div key={fam.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-gold-500/30 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-gold-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{fam.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">
                        {fam.member_count} member{fam.member_count !== 1 ? "s" : ""}
                        {fam.established_year ? ` | Est. ${fam.established_year}` : ""}
                        {fam.privacy_level === "invite_only" ? " | Invite only" : ""}
                      </p>
                      {fam.description && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{fam.description}</p>
                      )}
                    </div>
                    {joinSuccess === fam.id ? (
                      <span className="text-xs text-green-400 font-medium flex items-center gap-1 flex-shrink-0">
                        <Check className="w-4 h-4" /> Joined!
                      </span>
                    ) : fam.privacy_level === "public" ? (
                      <button
                        onClick={() => handleJoinFamily(fam.id)}
                        disabled={joining === fam.id}
                        className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {joining === fam.id ? "Joining..." : "Join"}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">Need invite</span>
                    )}
                  </div>
                ))}
              </div>
            ) : searchQuery && !searchLoading ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                No families found matching "{searchQuery}"
              </p>
            ) : null}

            <button
              onClick={() => { setSearching(false); setSearchResults([]); setSearchQuery(""); }}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    );
  }

  // Has family
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Family header */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-gold-700 via-gold-500 to-gold-400" />
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">{currentFamily.name}</h1>
          {currentFamily.description && (
            <p className="mt-1 text-[var(--muted-foreground)]">
              {currentFamily.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {currentFamily.member_count} member{currentFamily.member_count !== 1 ? "s" : ""}
            </span>
            {currentFamily.established_year && (
              <span>Est. {currentFamily.established_year}</span>
            )}
          </div>
        </div>
      </div>

      {/* Invite section - visible to all members */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Invite Family Members</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Generate a link to share with family
            </p>
          </div>
          {!inviteToken ? (
            <button
              onClick={handleCreateInvite}
              className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Link
            </button>
          ) : (
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy Invite Link
                </>
              )}
            </button>
          )}
        </div>
        {inviteToken && (
          <div className="mt-3 p-2 bg-[var(--background)] rounded-lg text-xs font-mono text-[var(--muted-foreground)] break-all">
            {window.location.origin}/invite/{inviteToken}
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-semibold mb-4">
          Members ({members.length})
        </h3>
        <div className="space-y-3">
          {members.map((member) => {
            const p: Profile = member.profile;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center overflow-hidden">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gold-500">
                      {p.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.display_name}</p>
                  {member.relation_label && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {member.relation_label}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  {member.role === "admin" && (
                    <Crown className="w-3.5 h-3.5 text-gold-500" />
                  )}
                  {member.role === "moderator" && (
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="capitalize">{member.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
