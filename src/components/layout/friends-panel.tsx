import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Circle, UserPlus, Check, X, ExternalLink, Send, Cake, Heart, CalendarCheck } from "lucide-react";
import { useFamily } from "@/lib/hooks/use-family";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { useChat } from "@/components/chat/chat-provider";
import type { Profile } from "@/lib/types";

interface MemberWithPresence {
  id: string;
  profile: Profile;
  online: boolean;
  isMe: boolean;
  lastSeen: string | null;
}

interface PendingMember {
  id: string;
  name: string;
  type: "incoming" | "outgoing";
}

export function FriendsPanel({ showUpcoming = false }: { showUpcoming?: boolean }) {
  const { user } = useAuth();
  const { currentFamily, members } = useFamily();
  const { openDirectMessage } = useChat();
  const [expanded, setExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omf-friends-expanded");
      return saved !== "false";
    }
    return true;
  });
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "accept" | "decline" } | null>(null);

  // Profile modal state
  const [profileModal, setProfileModal] = useState<PendingMember | null>(null);

  useEffect(() => {
    localStorage.setItem("omf-friends-expanded", expanded.toString());
  }, [expanded]);

  // Track presence via Supabase Realtime
  useEffect(() => {
    if (!currentFamily || !user) return;

    const channel = supabase.channel(`family-presence-${currentFamily.id}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentFamily, user]);

  const mockMembers: MemberWithPresence[] = [
    { id: "mock-1", profile: { id: "mock-1", display_name: "Mommy", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: true, isMe: false, lastSeen: null },
    { id: "mock-2", profile: { id: "mock-2", display_name: "Brian", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: true, isMe: false, lastSeen: null },
    { id: "mock-3", profile: { id: "mock-3", display_name: "Fifi", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: false, isMe: false, lastSeen: null },
    { id: "mock-4", profile: { id: "mock-4", display_name: "Jocelyn", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: false, isMe: false, lastSeen: null },
    { id: "mock-5", profile: { id: "mock-5", display_name: "Paradise", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: true, isMe: false, lastSeen: null },
    { id: "mock-8", profile: { id: "mock-8", display_name: "LaDonna", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: true, isMe: false, lastSeen: null },
    { id: "mock-6", profile: { id: "mock-6", display_name: "Melony", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: false, isMe: false, lastSeen: null },
    { id: "mock-7", profile: { id: "mock-7", display_name: "Katie", avatar_url: null, bio: null, location: null, phone: null, created_at: "", updated_at: "" } as Profile, online: false, isMe: false, lastSeen: null },
  ];

  const realMembers: MemberWithPresence[] = members.map((m) => ({
    id: m.user_id,
    profile: m.profile,
    online: onlineIds.has(m.user_id) || m.user_id === user?.id,
    isMe: m.user_id === user?.id,
    lastSeen: null,
  }));

  const familyMembers = [...realMembers, ...mockMembers]
    .sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return (a.profile.display_name || "").localeCompare(b.profile.display_name || "");
    });

  const onlineCount = familyMembers.filter((m) => m.online).length;

  const [pendingList, setPendingList] = useState<PendingMember[]>([
    { id: "pending-1", name: "Uncle Ray", type: "incoming" },
    { id: "pending-2", name: "Cousin Tasha", type: "incoming" },
    { id: "pending-3", name: "Auntie Pam", type: "outgoing" },
  ]);

  // Show panel even without a family since we have mock data for demo

  const [pendingExpanded, setPendingExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omf-pending-expanded");
      return saved !== "false";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("omf-pending-expanded", pendingExpanded.toString());
  }, [pendingExpanded]);

  function handleConfirm() {
    if (!confirmAction) return;
    setPendingList((prev) => prev.filter((p) => p.id !== confirmAction.id));
    setConfirmAction(null);
  }

  return (
    <>
      {/* Confirm Accept/Decline modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmAction(null)} />
          <div className={`relative bg-[var(--card)] rounded-xl border shadow-2xl p-6 max-w-xs w-full text-center ${
            confirmAction.action === "accept" ? "border-green-500/40" : "border-red-500/40"
          }`}>
            <h3 className="font-semibold text-lg">
              {confirmAction.action === "accept" ? "Accept Link Request?" : "Decline Link Request?"}
            </h3>
            <div className="flex gap-4 mt-5 justify-center">
              <button
                onClick={() => { setConfirmAction({ ...confirmAction, action: "accept" }); handleConfirm(); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  confirmAction.action === "accept"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-green-500/15 text-green-500 hover:bg-green-500/25"
                }`}
                style={{ border: "2px solid #22c55e" }}
                title="Accept"
              >
                <Check className="w-6 h-6" />
              </button>
              <button
                onClick={() => { setConfirmAction({ ...confirmAction, action: "decline" }); handleConfirm(); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  confirmAction.action === "decline"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-red-500/15 text-red-500 hover:bg-red-500/25"
                }`}
                style={{ border: "2px solid #ef4444" }}
                title="Decline"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile preview modal */}
      {profileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setProfileModal(null)} />
          <div className="relative bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Cover area */}
            <div className="h-24 bg-gradient-to-r from-gold-700 via-gold-500 to-gold-400" />

            {/* Avatar + name */}
            <div className="px-5 pb-5">
              <div className="-mt-10 mb-3">
                <div className="w-20 h-20 rounded-md bg-[var(--card)] border-4 border-[var(--card)] flex items-center justify-center overflow-hidden shadow-lg">
                  <div className="w-full h-full bg-gold-500/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gold-500">
                      {profileModal.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-lg">{profileModal.name}</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                {profileModal.type === "incoming" ? "Wants to link with you" : "Link request sent"}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-4">
                {profileModal.type === "incoming" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setProfileModal(null); setConfirmAction({ id: profileModal.id, action: "accept" }); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Accept Link
                    </button>
                    <button
                      onClick={() => { setProfileModal(null); setConfirmAction({ id: profileModal.id, action: "decline" }); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setPendingList((prev) => prev.filter((p) => p.id !== profileModal.id)); setProfileModal(null); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Rescind Request
                  </button>
                )}
                <button
                  onClick={() => setProfileModal(null)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Profile
                </button>
                <button
                  onClick={() => {
                    if (profileModal) {
                      openDirectMessage(profileModal.id);
                      setProfileModal(null);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </div>

              {/* Close */}
              <button
                onClick={() => setProfileModal(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Events — fixed to top-right, aligned with page content, feed only */}
      {showUpcoming && <div className="fixed right-6 z-20 hidden lg:block" style={{ width: 300, top: 88 }}>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <span className="font-semibold text-sm">Upcoming</span>
          </div>
          <div className="max-h-[220px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="py-1">
              {[
                { id: "ev-1", icon: Cake, color: "text-pink-400", label: "Mommy's Birthday", date: "Mar 12", detail: "Turning 72" },
                { id: "ev-2", icon: Heart, color: "text-red-400", label: "Brian & Melony", date: "Mar 18", detail: "Anniversary" },
                { id: "ev-3", icon: CalendarCheck, color: "text-gold-500", label: "Easter Cookout", date: "Apr 20", detail: "You're going" },
                { id: "ev-4", icon: Cake, color: "text-pink-400", label: "Katie's Birthday", date: "Apr 28", detail: "Turning 8" },
                { id: "ev-5", icon: CalendarCheck, color: "text-gold-500", label: "Summer Reunion", date: "Jun 14", detail: "You're going" },
                { id: "ev-6", icon: Heart, color: "text-red-400", label: "Jason & LaDonna", date: "Jul 4", detail: "Anniversary" },
              ].map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <div className={`flex-shrink-0 ${event.color}`}>
                    <event.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{event.label}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{event.detail}</p>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">{event.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>}

      {/* Bottom panels */}
      <div className="fixed bottom-6 right-6 z-30 hidden lg:flex flex-col gap-2" style={{ width: 300 }}>

        {/* Awaiting Link — separate panel */}
        {pendingList.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={() => setPendingExpanded(!pendingExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gold-500/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  pendingList.some((p) => p.type === "incoming") ? "bg-green-500" : "bg-gray-400"
                }`} />
                <span className="font-semibold text-sm">Awaiting Link</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {pendingList.length}
                </span>
              </div>
              {pendingExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
              )}
            </button>

            {pendingExpanded && (
              <div className="border-t border-[var(--border)] max-h-48 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="py-1">
                  {pendingList.map((pending) => (
                    <div
                      key={pending.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--accent)] transition-colors cursor-pointer"
                      onClick={() => setProfileModal(pending)}
                    >
                      <div className="w-8 h-8 rounded-md bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-4 h-4 text-gold-500/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{pending.name}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {pending.type === "incoming" ? "Wants to link" : "Request sent"}
                        </p>
                      </div>
                      {pending.type === "incoming" ? (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: pending.id, action: "accept" }); }}
                            className="p-1 rounded-full bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors cursor-pointer"
                            title="Accept"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: pending.id, action: "decline" }); }}
                            className="p-1 rounded-full bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors cursor-pointer"
                            title="Decline"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gold-500 flex-shrink-0">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Family Online — separate panel */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gold-500/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                onlineCount > 0 ? "bg-green-500" : "bg-gray-400"
              }`} />
              <span className="font-semibold text-sm">Family</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {onlineCount > 0 ? `${onlineCount} online` : "all offline"}
              </span>
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
            )}
          </button>

          {expanded && (
            <div className="border-t border-[var(--border)] max-h-80 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="py-1">
                {familyMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--accent)] transition-colors cursor-pointer"
                    onClick={() => {
                      if (!member.isMe) {
                        openDirectMessage(member.id);
                      }
                    }}
                    title={member.isMe ? undefined : `Message ${member.profile.display_name}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-md bg-gold-500/20 flex items-center justify-center overflow-hidden">
                        {member.profile.avatar_url ? (
                          <img
                            src={member.profile.avatar_url}
                            alt={member.profile.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-gold-500">
                            {member.profile.display_name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <Circle
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                          member.online
                            ? "text-green-500 fill-green-500"
                            : "text-gray-400 fill-gray-400"
                        }`}
                        strokeWidth={3}
                        style={{ stroke: "var(--card)" }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {member.profile.display_name}{member.isMe ? " (You)" : ""}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {member.online ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
