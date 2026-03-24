import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Crown, Shield, Copy, Check, Plus, Search, UserPlus, Settings, Globe, Lock, Mail, GitBranch, Link2, Unlink, ChevronRight, ChevronDown, X, MapPin, Phone, Calendar, Heart, Send, Trash2, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);
  }, [map]);
  return null;
}
import type { Profile } from "@/lib/types";

const goldIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const RELATION_OPTIONS = [
  "Mother", "Father", "Sister", "Brother", "Daughter", "Son",
  "Grandmother", "Grandfather", "Granddaughter", "Grandson",
  "Aunt", "Uncle", "Niece", "Nephew", "Cousin",
  "Wife", "Husband", "Partner", "Fiancée", "Fiancé",
  "Mother-in-law", "Father-in-law", "Sister-in-law", "Brother-in-law",
  "Daughter-in-law", "Son-in-law", "Stepmom", "Stepdad",
  "Stepdaughter", "Stepson", "Godmother", "Godfather",
];

interface SearchResult {
  id: string;
  name: string;
  description: string | null;
  privacy_level: string;
  member_count: number;
  established_year: number | null;
}

function VerificationSection({ unverified, userId, refreshFamilies }: { unverified: any[]; userId?: string; refreshFamilies: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="bg-[var(--card)] rounded-lg border border-gold-500/30 p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 cursor-pointer text-left"
      >
        <ShieldAlert className="w-4 h-4 text-gold-500" />
        <h3 className="font-semibold text-sm flex-1">Awaiting Verification ({unverified.length})</h3>
        {collapsed ? <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />}
      </button>
      {!collapsed && (
        <>
          <p className="text-xs text-[var(--muted-foreground)] mb-3 mt-2">
            These members need to be verified as family. Click to verify.
          </p>
          <div className="space-y-2">
            {unverified.map((m: any) => {
              const p = m.profile;
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--background)]">
                  <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-gold-500">{p?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p?.display_name || "Unknown"}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from("family_members").update({ is_verified: true, verified_by: userId, verified_at: new Date().toISOString() }).eq("id", m.id);
                      refreshFamilies();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verify
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function FamilyPage() {
  const navigate = useNavigate();
  const { user, isGodMode } = useAuth();
  const { currentFamily, members, myMembership, refreshFamilies, refreshMembers } = useFamily();
  const [creating, setCreating] = useState(false);

  // Refresh data when page loads
  useEffect(() => {
    refreshFamilies();
    refreshMembers();
  }, []);
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

  // Claimable accounts
  const [claimableAccounts, setClaimableAccounts] = useState<any[]>([]);
  const [newClaimName, setNewClaimName] = useState("");
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  // Load claimable accounts
  useEffect(() => {
    if (!currentFamily) return;
    supabase.from("claimable_accounts").select("*").eq("family_id", currentFamily.id).is("claimed_by", null)
      .then(({ data }) => setClaimableAccounts(data || []));
  }, [currentFamily]);

  async function createClaimableAccount() {
    if (!user || !currentFamily || !newClaimName.trim()) return;
    setCreatingClaim(true);
    const { data } = await supabase.from("claimable_accounts").insert({
      family_id: currentFamily.id,
      display_name: newClaimName.trim(),
      created_by: user.id,
    }).select().single();
    if (data) setClaimableAccounts((prev) => [...prev, data]);
    setNewClaimName("");
    setCreatingClaim(false);
  }

  async function claimAccount() {
    if (!user || !claimCode.trim()) return;
    setClaiming(true);
    setClaimResult(null);
    const { data: account } = await supabase.from("claimable_accounts")
      .select("*").eq("claim_code", claimCode.trim()).is("claimed_by", null).single();
    if (!account) {
      setClaimResult("Invalid or already claimed code");
      setClaiming(false);
      return;
    }
    // Claim it
    await supabase.from("claimable_accounts").update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq("id", account.id);
    // Add user to family
    await supabase.from("family_members").insert({ family_id: account.family_id, user_id: user.id, role: "member" });
    setClaimResult(`You've joined the family as ${account.display_name}!`);
    setClaimCode("");
    setClaiming(false);
    refreshFamilies();
    refreshMembers();
  }

  async function changeRole(memberId: string, newRole: string) {
    // Optimistic update
    setSelectedMember((prev: any) => prev ? { ...prev, role: newRole } : prev);
    await supabase.from("family_members").update({ role: newRole }).eq("id", memberId);
    refreshMembers();
  }

  async function deleteClaimableAccount(id: string) {
    await supabase.from("claimable_accounts").delete().eq("id", id);
    setClaimableAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  // Member modal state
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberProfile, setMemberProfile] = useState<Profile | null>(null);
  const [memberCoords, setMemberCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [relationPicker, setRelationPicker] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState("");
  const [selectedReverseRelation, setSelectedReverseRelation] = useState("");
  const [relationStep, setRelationStep] = useState<1 | 2>(1);
  const [relationSending, setRelationSending] = useState(false);
  const [relationSent, setRelationSent] = useState(false);
  const [approvedRelations, setApprovedRelations] = useState<Map<string, string>>(new Map()); // userId -> label (what they are to me)
  const [pendingRelations, setPendingRelations] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

  // Load approved relations for the current user
  useEffect(() => {
    if (!user || !currentFamily) return;
    async function loadRelations() {
      // Get relations where I'm the sender (relation_label = what they are to me)
      const { data: sent } = await supabase
        .from("relation_requests")
        .select("*")
        .eq("family_id", currentFamily!.id)
        .eq("from_user_id", user!.id)
        .eq("status", "approved");
      // Get relations where I'm the recipient (reverse_label = what they are to me)
      const { data: received } = await supabase
        .from("relation_requests")
        .select("*")
        .eq("family_id", currentFamily!.id)
        .eq("to_user_id", user!.id)
        .eq("status", "approved");

      const map = new Map<string, string>();
      for (const r of sent || []) {
        map.set(r.to_user_id, r.relation_label);
      }
      for (const r of received || []) {
        if (r.reverse_label) map.set(r.from_user_id, r.reverse_label);
      }
      setApprovedRelations(map);
    }
    loadRelations();
  }, [user, currentFamily]);

  // Load incoming relation requests on page load
  useEffect(() => {
    if (!user || !currentFamily) return;
    async function loadIncoming() {
      const { data } = await supabase
        .from("relation_requests")
        .select("*")
        .eq("family_id", currentFamily!.id)
        .eq("to_user_id", user!.id)
        .eq("status", "pending");
      if (!data || data.length === 0) { setIncomingRequests([]); return; }
      // Get sender profiles
      const senderIds = data.map((r) => r.from_user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", senderIds);
      const pm = new Map<string, any>();
      for (const p of profiles || []) pm.set(p.id, p);
      setIncomingRequests(data.map((r) => ({ ...r, sender: pm.get(r.from_user_id) })));
    }
    loadIncoming();
  }, [user, currentFamily]);

  async function approveRequest(requestId: string) {
    await supabase.rpc("approve_relation_request", { request_id: requestId });
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    refreshMembers();
  }

  async function declineRequest(requestId: string) {
    await supabase.from("relation_requests").update({ status: "rejected" }).eq("id", requestId);
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  // Load member profile when modal opens
  useEffect(() => {
    if (!selectedMember) {
      setMemberProfile(null);
      setMemberCoords(null);
      setRelationPicker(false);
      setSelectedRelation("");
      setSelectedReverseRelation("");
      setRelationStep(1);
      setRelationSent(false);
      return;
    }
    setMemberProfile(selectedMember.profile);
    // Geocode their location
    if (selectedMember.profile?.location) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(selectedMember.profile.location)}&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          if (data.length > 0) setMemberCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        })
        .catch(() => {});
    }
    // Check for pending relation requests
    if (user && currentFamily) {
      supabase
        .from("relation_requests")
        .select("*")
        .eq("family_id", currentFamily.id)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "pending")
        .then(({ data }) => setPendingRelations(data || []));
    }
  }, [selectedMember]);

  async function sendRelationRequest(toUserId: string, label: string, reverseLabel: string) {
    if (!user || !currentFamily) return;
    setRelationSending(true);
    await supabase.from("relation_requests").insert({
      family_id: currentFamily.id,
      from_user_id: user.id,
      to_user_id: toUserId,
      relation_label: label,
      reverse_label: reverseLabel,
    });
    // Send notification to the recipient
    const senderName = members.find((m) => m.user_id === user.id)?.profile?.display_name || "Someone";
    await supabase.from("notifications").insert({
      user_id: toUserId,
      type: "relation_request",
      title: `${senderName} sent you a relationship request`,
      body: `${senderName} says you are their ${label}${reverseLabel ? ` and they are your ${reverseLabel}` : ""}`,
      data: { family_id: currentFamily.id, from_user_id: user.id },
    });
    setRelationSending(false);
    setRelationSent(true);
    setRelationPicker(false);
    setRelationStep(1);
  }

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
      alert("Failed to create family: " + (error?.message || "Unknown error"));
      setSaving(false);
      return;
    }

    console.log("Family created:", family.id);

    const { error: memberError } = await supabase.from("family_members").insert({
      family_id: family.id,
      user_id: user.id,
      role: "admin",
      relation_label: "Creator",
    });

    if (memberError) {
      console.error("Add member error:", memberError);
      alert("Family created but failed to add you as member: " + memberError.message);
    }

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

  const isAdmin = myMembership?.role === "admin" || myMembership?.role === "moderator";
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Hierarchy state
  const [childFamilies, setChildFamilies] = useState<{ id: string; name: string; member_count: number }[]>([]);
  const [parentFamily, setParentFamily] = useState<{ id: string; name: string } | null>(null);
  const [showLinkParent, setShowLinkParent] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentSearchResults, setParentSearchResults] = useState<SearchResult[]>([]);
  const [parentSearching, setParentSearching] = useState(false);
  const [showJoinAnother, setShowJoinAnother] = useState(false);

  // Load hierarchy data
  useEffect(() => {
    if (!currentFamily) return;

    async function loadHierarchy() {
      // Load child families
      const { data: children } = await supabase.rpc("get_child_families", { p_family_id: currentFamily!.id });
      if (children) setChildFamilies(children as typeof childFamilies);

      // Load parent family
      if (currentFamily!.parent_family_id) {
        const { data: parent } = await supabase
          .from("families")
          .select("id, name")
          .eq("id", currentFamily!.parent_family_id)
          .single();
        if (parent) setParentFamily(parent);
      } else {
        setParentFamily(null);
      }
    }

    loadHierarchy();
  }, [currentFamily]);

  async function handleSearchParent() {
    if (!parentSearchQuery.trim()) return;
    setParentSearching(true);
    const { data } = await supabase.rpc("search_families", { p_query: parentSearchQuery.trim() });
    setParentSearchResults(((data || []) as SearchResult[]).filter((f) => f.id !== currentFamily?.id));
    setParentSearching(false);
  }

  async function handleLinkParent(parentId: string) {
    if (!currentFamily) return;
    await supabase.rpc("link_family_to_parent", { p_child_id: currentFamily.id, p_parent_id: parentId });
    await refreshFamilies();
    setShowLinkParent(false);
    setParentSearchQuery("");
    setParentSearchResults([]);
  }

  async function handleUnlinkParent() {
    if (!currentFamily) return;
    await supabase.rpc("unlink_family_from_parent", { p_child_id: currentFamily.id });
    setParentFamily(null);
    await refreshFamilies();
  }

  async function handlePrivacyChange(level: string) {
    if (!currentFamily) return;
    setSavingPrivacy(true);
    await supabase
      .from("families")
      .update({ privacy_level: level })
      .eq("id", currentFamily.id);
    await refreshFamilies();
    setSavingPrivacy(false);
  }

  // No family yet
  if (!currentFamily) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">

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
                className="px-6 py-2.5 rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm font-medium flex items-center gap-2"
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
                className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
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
                className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((fam) => (
                  <div key={fam.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-gold-500/30 transition-colors">
                    <div className="w-10 h-10 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
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
                        className="px-3 py-1.5 rounded-md bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-1"
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
    <div className="flex flex-col lg:flex-row gap-6 -m-4 lg:-m-6">
      {/* Left: Members sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 flex-shrink-0 border-r border-[var(--border)] lg:h-[calc(100vh-4rem)]">
        <div className="px-4 pt-2 pb-2 space-y-2 border-b border-[var(--border)] flex-shrink-0">
          <h3 className="font-semibold">
            Members ({members.length})
          </h3>
          <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search members..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="divide-y divide-[var(--border)]">
          {members.filter((m) => !memberSearch || m.profile?.display_name?.toLowerCase().includes(memberSearch.toLowerCase())).map((member) => {
            const p: Profile = member.profile;
            return (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className="flex items-center gap-2.5 px-1.5 py-2.5 hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">
                      {p.display_name?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {p.display_name}
                    {member.is_verified && <VerifiedBadge size="xs" />}
                  </p>
                  {member.user_id !== user?.id && approvedRelations.get(member.user_id) && (
                    <p className="text-[10px] text-gold-500">{approvedRelations.get(member.user_id)}</p>
                  )}
                </div>
                {member.role === "admin" && <Crown className="w-3 h-3 text-gold-500 flex-shrink-0" />}
                {member.role === "moderator" && <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
        </div>{/* end scrollable member list */}
      </div>

      {/* Right: Everything else */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 space-y-6 lg:overflow-y-auto lg:h-[calc(100vh-4rem)]  [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

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

      {/* Incoming relation requests */}
      {incomingRequests.length > 0 && (
        <div className="bg-[var(--card)] rounded-lg border border-gold-500/30 p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-gold-500" />
            Pending Relation Requests ({incomingRequests.length})
          </h3>
          <div className="space-y-2">
            {incomingRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--accent)]">
                <div className="w-9 h-9 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {req.sender?.avatar_url ? (
                    <img src={req.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-gold-500">{req.sender?.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{req.sender?.display_name}</span>
                    {" "}says you are their{" "}
                    <span className="text-gold-500 font-medium">{req.relation_label}</span>
                    {req.reverse_label && <> and they are your <span className="text-gold-500 font-medium">{req.reverse_label}</span></>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveRequest(req.id)}
                    className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => declineRequest(req.id)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Members list (hidden on desktop since sidebar handles it) */}
      <div className="lg:hidden bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-semibold mb-3">Members ({members.length})</h3>
        <div className="space-y-2">
          {members.map((member) => {
            const p: Profile = member.profile;
            return (
              <div key={member.id} onClick={() => setSelectedMember(member)} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" /> : <span className="text-xs font-medium text-gold-500">{p.display_name?.charAt(0).toUpperCase() || "?"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.display_name}</p>
                  {member.user_id !== user?.id && approvedRelations.get(member.user_id) && <p className="text-[10px] text-gold-500">{approvedRelations.get(member.user_id)}</p>}
                </div>
                {member.role === "admin" && <Crown className="w-3 h-3 text-gold-500 flex-shrink-0" />}
                {member.role === "moderator" && <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />}
              </div>
            );
          })}
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
              className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Link
            </button>
          ) : (
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors flex items-center gap-2"
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

      {/* Claim an Account */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <h3 className="font-semibold mb-2">Claim an Account</h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">Have a claim code from a family admin? Enter it to join.</p>
        <div className="flex gap-2">
          <input
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            placeholder="Enter claim code..."
            className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />
          <button
            onClick={claimAccount}
            disabled={claiming || !claimCode.trim()}
            className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {claiming ? "Claiming..." : "Claim"}
          </button>
        </div>
        {claimResult && (
          <p className={`text-xs mt-2 ${claimResult.includes("joined") ? "text-green-400" : "text-red-400"}`}>{claimResult}</p>
        )}
      </div>

      {/* Create Accounts for Family - admin only */}
      {isAdmin && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-semibold mb-1">Create Member Accounts</h3>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">Create placeholder accounts for family members. They can claim them with a code.</p>
          <div className="flex gap-2 mb-3">
            <input
              value={newClaimName}
              onChange={(e) => setNewClaimName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createClaimableAccount(); }}
              placeholder="Member name (e.g. Aunt Rose)"
              className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
            <button
              onClick={createClaimableAccount}
              disabled={creatingClaim || !newClaimName.trim()}
              className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
          {claimableAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted-foreground)]">Unclaimed accounts:</p>
              {claimableAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--accent)]">
                  <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-gold-500">{account.display_name?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{account.display_name}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] font-mono">Code: <span className="text-gold-500 select-all">{account.claim_code}</span></p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(account.claim_code); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                    title="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteClaimableAccount(account.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Awaiting Verification */}
      {(() => {
        const myMember = members.find((m) => m.user_id === user?.id);
        const canVerify = currentFamily.verification_mode === "admin_only"
          ? myMember?.role === "admin"
          : myMember?.is_verified;
        const unverified = members.filter((m) => !m.is_verified && m.user_id !== user?.id);
        if (!canVerify || unverified.length === 0) return null;
        return (
          <VerificationSection unverified={unverified} userId={user?.id} refreshFamilies={refreshFamilies} />
        );
      })()}

      {/* Family Settings - admin or god mode */}
      {(isAdmin || currentFamily.created_by === user?.id) && (
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
            <h3 className="font-semibold">Family Settings</h3>
          </div>

          {/* Family Name - admin only */}
          {myMembership?.role === "admin" && <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Family Name</label>
            <div className="flex gap-2">
              <input
                defaultValue={currentFamily.name}
                id="family-name-input"
                className="flex-1 rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
              />
              <button
                onClick={async () => {
                  const input = document.getElementById("family-name-input") as HTMLInputElement;
                  const newName = input?.value.trim();
                  if (!newName || newName === currentFamily.name) return;
                  await supabase.from("families").update({ name: newName }).eq("id", currentFamily.id);
                  refreshFamilies();
                }}
                className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>}

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium mb-2">Who can find and join this family?</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {[
                { value: "public", label: "Public", desc: "Anyone can find and join", icon: Globe, color: "text-green-400" },
                { value: "invite_only", label: "Invite Only", desc: "Searchable, but need an invite to join", icon: Mail, color: "text-gold-500" },
                { value: "private", label: "Private", desc: "Hidden from search, invite link only", icon: Lock, color: "text-red-400" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePrivacyChange(opt.value)}
                  disabled={savingPrivacy}
                  className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                    currentFamily.privacy_level === opt.value
                      ? "border-gold-500 bg-gold-500/30"
                      : "border-[var(--border)] hover:border-[var(--muted-foreground)]"
                  }`}
                >
                  <opt.icon className={`w-5 h-5 flex-shrink-0 ${opt.color}`} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Verification mode */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Who can verify new members?</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {[
                { value: "verified_can_verify", label: "Verified Members", desc: "Any verified member can verify others", icon: ShieldCheck, color: "text-green-400" },
                { value: "admin_only", label: "Admins Only", desc: "Only admins can verify new members", icon: Crown, color: "text-gold-500" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={async () => {
                    await supabase.from("families").update({ verification_mode: opt.value }).eq("id", currentFamily.id);
                    refreshFamilies();
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer flex-1 text-left ${
                    currentFamily.verification_mode === opt.value
                      ? "border-gold-500 bg-gold-500/10"
                      : "border-[var(--border)] hover:border-gold-500/50"
                  }`}
                >
                  <opt.icon className={`w-5 h-5 flex-shrink-0 ${opt.color}`} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Family Hierarchy */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-[var(--muted-foreground)]" />
          <h3 className="font-semibold">Family Tree</h3>
        </div>

        {/* Parent family */}
        <div className="mb-3">
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Part of</label>
          {parentFamily ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--accent)]">
              <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-gold-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{parentFamily.name}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">Parent family</p>
              </div>
              {(isAdmin || currentFamily.created_by === user?.id) && (
                <button
                  onClick={handleUnlinkParent}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
                  title="Unlink from parent"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div>
              {!showLinkParent ? (
                <button
                  onClick={() => setShowLinkParent(true)}
                  className="text-sm text-gold-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Link under a parent family
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-[var(--background)] border border-[var(--input)] rounded-lg px-3 py-1.5">
                      <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      <input
                        type="text"
                        value={parentSearchQuery}
                        onChange={(e) => setParentSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSearchParent(); }}
                        placeholder="Search for parent family..."
                        className="bg-transparent text-sm outline-none w-full"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleSearchParent}
                      disabled={parentSearching}
                      className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {parentSearching ? "..." : "Search"}
                    </button>
                  </div>
                  {parentSearchResults.map((fam) => (
                    <button
                      key={fam.id}
                      onClick={() => handleLinkParent(fam.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer text-left"
                    >
                      <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-gold-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fam.name}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">{fam.member_count} members</p>
                      </div>
                      <Link2 className="w-4 h-4 text-gold-500" />
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowLinkParent(false); setParentSearchResults([]); }}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Child families */}
        {childFamilies.length > 0 && (
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Families under {currentFamily.name}</label>
            <div className="space-y-1">
              {childFamilies.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent)] transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  <div className="w-7 h-7 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-gold-500">{child.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{child.name}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{child.member_count} members</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Join Another Family */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Join Another Family</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Connect with more of your family circles
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoinAnother(true); setSearching(true); }}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" />
              Find
            </button>
            <button
              onClick={() => { setShowJoinAnother(true); setCreating(true); }}
              className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </button>
          </div>
        </div>

        {showJoinAnother && searching && (
          <div className="mt-4 space-y-3">
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
                className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {searchLoading ? "..." : "Search"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((fam) => (
                  <div key={fam.id} className="flex items-center gap-3 p-2 rounded-lg border border-[var(--border)] hover:border-gold-500/30 transition-colors">
                    <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-gold-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fam.name}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{fam.member_count} members</p>
                    </div>
                    {joinSuccess === fam.id ? (
                      <span className="text-xs text-green-400 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Joined!</span>
                    ) : fam.privacy_level === "public" ? (
                      <button
                        onClick={() => handleJoinFamily(fam.id)}
                        disabled={joining === fam.id}
                        className="px-3 py-1 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" />
                        {joining === fam.id ? "..." : "Join"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-[var(--muted-foreground)]">Need invite</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {searchQuery && !searchLoading && searchResults.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-2">No families found</p>
            )}
            <button
              onClick={() => { setShowJoinAnother(false); setSearching(false); setSearchResults([]); setSearchQuery(""); }}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {showJoinAnother && creating && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Family Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="Family name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="Short description"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateFamily}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => { setShowJoinAnother(false); setCreating(false); setForm({ name: "", description: "", established_year: "" }); }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Family - admin/creator or God Mode */}
      {(isAdmin || currentFamily.created_by === user?.id || isGodMode) && (
        <div className="bg-red-500/5 rounded-lg border border-red-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-red-400">Danger Zone</h3>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Permanently delete this family and all its data including posts, events, albums, conversations, and members. This cannot be undone.
          </p>
          <button
            onClick={async () => {
              if (!confirm(`Delete "${currentFamily.name}" and ALL its data? This cannot be undone.`)) return;
              await supabase.rpc("admin_delete_family", { p_family_id: currentFamily.id });
              refreshFamilies();
              navigate("/feed");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Family
          </button>
        </div>
      )}

      </div>{/* end right content */}

      {/* ===== Member Profile Modal ===== */}
      {selectedMember && memberProfile && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => setSelectedMember(null)} />
          <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center overflow-hidden">
                  {memberProfile.avatar_url ? (
                    <img src={memberProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gold-500">{memberProfile.display_name?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-1.5">
                    {memberProfile.display_name}
                    {selectedMember.is_verified && <VerifiedBadge size="sm" />}
                  </h3>
                  {approvedRelations.get(selectedMember.user_id) && (
                    <p className="text-xs text-gold-500">{approvedRelations.get(selectedMember.user_id)}</p>
                  )}
                  {selectedMember.role !== "member" && (
                    <p className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                      {selectedMember.role === "admin" ? <Crown className="w-3 h-3 text-gold-500" /> : <Shield className="w-3 h-3 text-blue-400" />}
                      {selectedMember.role}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedMember(null); navigate(`/profile/${selectedMember.user_id}`); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  Full Profile
                </button>
                <button onClick={() => setSelectedMember(null)} className="p-1.5 rounded-lg hover:bg-[var(--accent)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Verification action */}
            {selectedMember.user_id !== user?.id && (() => {
              const myMember = members.find((m) => m.user_id === user?.id);
              const canVerify = currentFamily.verification_mode === "admin_only"
                ? myMember?.role === "admin"
                : myMember?.is_verified;
              if (!canVerify) return null;
              return (
                <div className="px-4 py-2 border-b border-[var(--border)]">
                  {selectedMember.is_verified ? (
                    <button
                      onClick={async () => {
                        await supabase.from("family_members").update({ is_verified: false, verified_by: null, verified_at: null }).eq("id", selectedMember.id);
                        refreshFamilies();
                        setSelectedMember(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Remove Verification
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await supabase.from("family_members").update({ is_verified: true, verified_by: user?.id, verified_at: new Date().toISOString() }).eq("id", selectedMember.id);
                        refreshFamilies();
                        setSelectedMember(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verify as Family
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* About section */}
              <div className="p-4 space-y-3">
                {memberProfile.bio && (
                  <p className="text-sm text-[var(--muted-foreground)] italic">{memberProfile.bio}</p>
                )}
                {memberProfile.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gold-500 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">Location</p>
                      <p className="text-sm font-medium">{memberProfile.location}</p>
                    </div>
                  </div>
                )}
                {memberProfile.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gold-500 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">Phone</p>
                      <p className="text-sm font-medium">{memberProfile.phone}</p>
                    </div>
                  </div>
                )}
                {memberProfile.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gold-500 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">Birthday</p>
                      <p className="text-sm font-medium">{new Date(memberProfile.date_of_birth).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gold-500 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Joined</p>
                    <p className="text-sm font-medium">{new Date(memberProfile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              </div>

              {/* Map */}
              {memberCoords && (
                <div className="mx-4 mb-4 rounded-lg overflow-hidden border border-[var(--border)]">
                  <div style={{ height: 200 }}>
                    <MapContainer
                      center={[memberCoords.lat, memberCoords.lon]}
                      zoom={12}
                      style={{ height: "100%", width: "100%" }}
                      scrollWheelZoom={false}
                      key={`${memberCoords.lat},${memberCoords.lon}`}
                    >
                      <MapResizer />
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[memberCoords.lat, memberCoords.lon]} icon={goldIcon}>
                        <Tooltip direction="top" offset={[0, -35]} permanent className="leaflet-name-tooltip">
                          {memberProfile.display_name}
                        </Tooltip>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              )}

              {/* Role management - admin only */}
              {isAdmin && selectedMember.user_id !== user?.id && (
                <div className="mx-4 mb-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--accent)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold">Role</span>
                  </div>
                  <div className="flex gap-2">
                    {["member", "moderator", "admin"].map((role) => (
                      <button
                        key={role}
                        onClick={() => changeRole(selectedMember.id, role)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedMember.role === role
                            ? role === "admin" ? "bg-gold-500 text-white" : role === "moderator" ? "bg-blue-500 text-white" : "bg-[var(--card)] border border-[var(--border)]"
                            : "bg-[var(--card)] border border-[var(--border)] hover:border-gold-500/50"
                        }`}
                      >
                        {role === "admin" && <Crown className="w-3 h-3 inline mr-1" />}
                        {role === "moderator" && <Shield className="w-3 h-3 inline mr-1" />}
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Relation section */}
              {selectedMember.user_id !== user?.id && (
                <div className="mx-4 mb-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--accent)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-gold-500" />
                    <span className="text-sm font-semibold">Relationship</span>
                  </div>

                  {approvedRelations.get(selectedMember.user_id) ? (
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {memberProfile.display_name} is your <span className="text-gold-500 font-medium">{approvedRelations.get(selectedMember.user_id)}</span>
                      </p>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove relationship with ${memberProfile.display_name}?`)) return;
                          // Delete both directions
                          await supabase.from("relation_requests").delete()
                            .eq("family_id", currentFamily!.id)
                            .eq("from_user_id", user!.id)
                            .eq("to_user_id", selectedMember.user_id);
                          await supabase.from("relation_requests").delete()
                            .eq("family_id", currentFamily!.id)
                            .eq("from_user_id", selectedMember.user_id)
                            .eq("to_user_id", user!.id);
                          // Also clear the old family_members relation_label
                          await supabase.from("family_members").update({ relation_label: null })
                            .eq("family_id", currentFamily!.id)
                            .eq("user_id", user!.id);
                          await supabase.from("family_members").update({ relation_label: null })
                            .eq("family_id", currentFamily!.id)
                            .eq("user_id", selectedMember.user_id);
                          setApprovedRelations((prev) => { const next = new Map(prev); next.delete(selectedMember.user_id); return next; });
                        }}
                        className="text-xs text-red-400 hover:text-red-300 mt-2 cursor-pointer"
                      >
                        Remove relationship
                      </button>
                    </div>
                  ) : relationSent ? (
                    <p className="text-sm text-green-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Relation request sent! Waiting for {memberProfile.display_name} to approve.
                    </p>
                  ) : (() => {
                    const existingRequest = pendingRelations.find(
                      (r) => r.from_user_id === user?.id && r.to_user_id === selectedMember.user_id
                    );
                    if (existingRequest) {
                      return (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          You already sent a request: <span className="text-gold-500 font-medium">{existingRequest.relation_label}</span> (pending approval)
                        </p>
                      );
                    }
                    const incomingRequest = pendingRelations.find(
                      (r) => r.from_user_id === selectedMember.user_id && r.to_user_id === user?.id
                    );
                    if (incomingRequest) {
                      return (
                        <div>
                          <p className="text-sm text-[var(--muted-foreground)] mb-2">
                            {memberProfile.display_name} wants to label you as their <span className="text-gold-500 font-medium">{incomingRequest.relation_label}</span>
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                await supabase.rpc("approve_relation_request", { request_id: incomingRequest.id });
                                refreshMembers();
                                setSelectedMember(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                await supabase.from("relation_requests").update({ status: "rejected" }).eq("id", incomingRequest.id);
                                setPendingRelations((prev) => prev.filter((r) => r.id !== incomingRequest.id));
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return relationPicker ? (
                      <div>
                        {relationStep === 1 ? (
                          <>
                            <p className="text-xs text-[var(--muted-foreground)] mb-2">
                              <span className="font-medium text-[var(--foreground)]">{memberProfile.display_name}</span> is my...
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {RELATION_OPTIONS.map((rel) => (
                                <button
                                  key={rel}
                                  onClick={() => { setSelectedRelation(rel); setRelationStep(2); }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                    selectedRelation === rel
                                      ? "bg-gold-500 text-white"
                                      : "bg-[var(--card)] border border-[var(--border)] hover:border-gold-500/50"
                                  }`}
                                >
                                  {rel}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-[var(--muted-foreground)] mb-1">
                              {memberProfile.display_name} is your <span className="text-gold-500 font-medium">{selectedRelation}</span>
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] mb-2">
                              And I am {memberProfile.display_name}'s...
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {RELATION_OPTIONS.map((rel) => (
                                <button
                                  key={rel}
                                  onClick={() => setSelectedReverseRelation(rel)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                    selectedReverseRelation === rel
                                      ? "bg-gold-500 text-white"
                                      : "bg-[var(--card)] border border-[var(--border)] hover:border-gold-500/50"
                                  }`}
                                >
                                  {rel}
                                </button>
                              ))}
                            </div>
                            {selectedReverseRelation && (
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => sendRelationRequest(selectedMember.user_id, selectedRelation, selectedReverseRelation)}
                                  disabled={relationSending}
                                  className="px-4 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-medium hover:bg-gold-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Send className="w-3 h-3" />
                                  {relationSending ? "Sending..." : "Send request"}
                                </button>
                                <button
                                  onClick={() => { setRelationStep(1); setSelectedReverseRelation(""); }}
                                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                                >
                                  Back
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => { setRelationPicker(false); setSelectedRelation(""); setSelectedReverseRelation(""); setRelationStep(1); }}
                          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer mt-2 block"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRelationPicker(true)}
                        className="text-sm text-gold-500 hover:text-gold-400 font-medium cursor-pointer"
                      >
                        + Set relationship to {memberProfile.display_name}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
