import { useState } from "react";
import { Users, Crown, Shield, Copy, Check, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export default function FamilyPage() {
  const { user } = useAuth();
  const { currentFamily, members, myMembership, refreshFamilies } = useFamily();
  const [creating, setCreating] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    established_year: "",
  });
  const [saving, setSaving] = useState(false);

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

  const isAdmin = myMembership?.role === "admin" || myMembership?.role === "moderator";

  // No family yet — show create
  if (!currentFamily) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Family</h1>
          <p className="text-[var(--muted-foreground)]">
            Create or join a family circle
          </p>
        </div>

        {!creating ? (
          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-12 text-center">
            <div className="text-5xl mb-4">&#x1F46A;</div>
            <h2 className="text-xl font-semibold">No family set up yet</h2>
            <p className="text-[var(--muted-foreground)] mt-2">
              Create your family circle or join one with an invite link.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-6 px-6 py-2.5 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium"
            >
              Create Your Family
            </button>
          </div>
        ) : (
          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create Your Family</h2>
            <div>
              <label className="block text-sm font-medium mb-1">
                Family Name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="The Williams Family"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                placeholder="A little about your family..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Established Year
              </label>
              <input
                value={form.established_year}
                onChange={(e) =>
                  setForm({ ...form, established_year: e.target.value })
                }
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
        )}
      </div>
    );
  }

  // Has family — show family page
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

      {/* Invite section */}
      {isAdmin && (
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
      )}

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
