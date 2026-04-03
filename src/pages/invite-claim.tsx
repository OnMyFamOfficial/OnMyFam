import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { OmfLoader } from "@/components/shared/omf-loader";
import { FamilyIcon } from "@/components/shared/family-icon";
import { APP_NAME } from "@/lib/constants";

export default function InviteClaimPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<
    "loading" | "valid" | "invalid" | "expired" | "claiming" | "success" | "already_member"
  >("loading");
  const [familyName, setFamilyName] = useState("");

  useEffect(() => {
    if (token) checkInvite();
  }, [token]);

  async function checkInvite() {
    if (!token) return;

    const { data: invite } = await supabase
      .from("invites")
      .select("*, family:families(name)")
      .eq("token", token)
      .single();

    if (!invite) {
      setStatus("invalid");
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      setStatus("expired");
      return;
    }

    if (invite.used_count >= invite.max_uses) {
      setStatus("expired");
      return;
    }

    setFamilyName((invite as any).family?.name || "a family");
    setStatus("valid");

    // Save invite token so it survives sign-up/sign-in flow
    localStorage.setItem("omf-pending-invite", token!);
  }

  async function handleClaim() {
    if (!user || !token) return;
    setStatus("claiming");

    const { data: invite } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .single();

    if (!invite) {
      setStatus("invalid");
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", invite.family_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      localStorage.removeItem("omf-pending-invite");
      setStatus("already_member");
      return;
    }

    // Join the family
    const { error } = await supabase.from("family_members").insert({
      family_id: invite.family_id,
      user_id: user.id,
      role: "member",
    });

    if (error) {
      setStatus("invalid");
      return;
    }

    // Increment used_count
    await supabase
      .from("invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    // Notify existing family members
    const { data: existingMembers } = await supabase
      .from("family_members")
      .select("user_id")
      .eq("family_id", invite.family_id)
      .neq("user_id", user.id);
    const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    const myName = myProfile?.display_name || "Someone";
    if (existingMembers && existingMembers.length > 0) {
      await supabase.from("notifications").insert(
        existingMembers.map((m: any) => ({
          user_id: m.user_id,
          family_id: invite.family_id,
          type: "member_joined",
          title: `${myName} joined the family!`,
          body: "A new member has joined your family group.",
          link: "/family",
          actor_id: user.id,
        }))
      );
    }

    localStorage.removeItem("omf-pending-invite");
    setStatus("success");
    setTimeout(() => navigate("/feed"), 2000);
  }

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <OmfLoader size="lg" text="Checking invite..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="flex justify-center mb-2">
          <img src="/omf-logo.png" alt="OMF" className="w-16 h-16 rounded-lg bg-white" />
        </div>
        <h1 className="text-3xl font-bold text-gold-500">{APP_NAME}</h1>

        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-8">
          {status === "invalid" && (
            <>
              <div className="text-4xl mb-4">&#x274C;</div>
              <h2 className="text-xl font-semibold">Invalid Invite</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                This invite link is not valid.
              </p>
            </>
          )}

          {status === "expired" && (
            <>
              <div className="text-4xl mb-4">&#x23F0;</div>
              <h2 className="text-xl font-semibold">Invite Expired</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                This invite has expired or been fully used.
              </p>
            </>
          )}

          {status === "valid" && !user && (
            <>
              <div className="flex justify-center mb-4 text-[var(--muted-foreground)]">
                <FamilyIcon className="w-14 h-14" />
              </div>
              <h2 className="text-xl font-semibold">
                You're invited to join {familyName}!
              </h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Sign in or create an account to join.
              </p>
              <div className="mt-6 space-y-3">
                <Link
                  to="/login"
                  className="block w-full px-4 py-2.5 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="block w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </>
          )}

          {status === "valid" && user && (
            <>
              <div className="flex justify-center mb-4 text-[var(--muted-foreground)]">
                <FamilyIcon className="w-14 h-14" />
              </div>
              <h2 className="text-xl font-semibold">
                Join {familyName}?
              </h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                You've been invited to join this family circle.
              </p>
              <button
                onClick={handleClaim}
                className="mt-6 w-full px-4 py-2.5 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors"
              >
                Join Family
              </button>
            </>
          )}

          {status === "claiming" && (
            <OmfLoader size="md" text="Joining family..." />
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">&#x1F389;</div>
              <h2 className="text-xl font-semibold">Welcome to the family!</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Redirecting to your feed...
              </p>
            </>
          )}

          {status === "already_member" && (
            <>
              <div className="text-4xl mb-4">&#x2705;</div>
              <h2 className="text-xl font-semibold">Already a member!</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                You're already part of this family.
              </p>
              <Link
                to="/feed"
                className="mt-6 inline-block px-4 py-2.5 rounded-md bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 transition-colors"
              >
                Go to Feed
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
