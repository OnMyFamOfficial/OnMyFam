import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, Check, MessageSquare, ArrowLeft, User, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export default function DonateThankyouPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const sessionId = searchParams.get("session_id");
  const paymentIntentId = searchParams.get("payment_intent");
  const stripeId = paymentIntentId || sessionId;
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [donation, setDonation] = useState<{ id: string; amount: number; donor_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameChoice, setNameChoice] = useState<"profile" | "custom" | "anonymous">("profile");
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (!stripeId) {
      setLoading(false);
      return;
    }

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("donations")
        .select("id, amount, donor_name")
        .eq("stripe_session_id", stripeId)
        .single();

      if (data) {
        setDonation(data);
        setLoading(false);
        clearInterval(interval);
      } else if (attempts > 10) {
        setLoading(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [stripeId]);

  function getDonorName() {
    if (nameChoice === "anonymous") return "Anonymous";
    if (nameChoice === "custom") return customName.trim() || "Anonymous";
    return profile?.display_name || "Anonymous";
  }

  async function handleSave() {
    if (!donation) return;
    setSaving(true);

    const donorName = getDonorName();

    await supabase
      .from("donations")
      .update({
        comment: comment.trim() || null,
        donor_name: donorName,
        user_id: user?.id || null,
        is_anonymous: nameChoice === "anonymous",
      })
      .eq("id", donation.id);

    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          {loading ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[var(--muted-foreground)]">Confirming your donation, please wait...</p>
            </div>
          ) : donation ? (
            <p className="text-[var(--muted-foreground)]">
              Your donation of <span className="text-gold-500 font-semibold">${donation.amount}</span> has been received.
              You're helping keep families connected.
            </p>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              Your donation is being processed. Thank you for your generosity!
            </p>
          )}
        </div>

        {/* Name + Comment section */}
        {donation && !saved && (
          <div className="px-8 pb-8 space-y-5">
            <div className="border-t border-[var(--border)] pt-6 space-y-5">
              {/* Name choice */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-gold-500" />
                  How should your name appear?
                </h3>
                <div className="space-y-2">
                  {profile?.display_name && (
                    <button
                      type="button"
                      onClick={() => setNameChoice("profile")}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-colors cursor-pointer",
                        nameChoice === "profile"
                          ? "border-gold-500 bg-gold-500/10 text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-gold-500/50"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", nameChoice === "profile" ? "border-gold-500" : "border-[var(--muted-foreground)]")}>
                        {nameChoice === "profile" && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                      </div>
                      Use my profile name: <span className="font-medium text-[var(--foreground)]">{profile.display_name}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNameChoice("custom")}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-colors cursor-pointer",
                      nameChoice === "custom"
                        ? "border-gold-500 bg-gold-500/10 text-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-gold-500/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", nameChoice === "custom" ? "border-gold-500" : "border-[var(--muted-foreground)]")}>
                      {nameChoice === "custom" && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                    </div>
                    Use a different name
                  </button>
                  {nameChoice === "custom" && (
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 ml-7"
                      style={{ width: "calc(100% - 28px)" }}
                      autoFocus
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setNameChoice("anonymous")}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-colors cursor-pointer",
                      nameChoice === "anonymous"
                        ? "border-gold-500 bg-gold-500/10 text-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-gold-500/50"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", nameChoice === "anonymous" ? "border-gold-500" : "border-[var(--muted-foreground)]")}>
                      {nameChoice === "anonymous" && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                    </div>
                    <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                    Donate anonymously
                  </button>
                </div>
              </div>

              {/* Comment */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-gold-500" />
                  <h3 className="font-semibold text-sm">Leave a message (optional)</h3>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share a few words of encouragement..."
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || (nameChoice === "custom" && !customName.trim())}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer hover:brightness-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                    color: "#2e303f",
                  }}
                >
                  <Heart className="w-4 h-4" />
                  {saving ? "Saving..." : "Done"}
                </button>
                <button
                  onClick={() => navigate("/donate")}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved confirmation */}
        {saved && (
          <div className="px-8 pb-8">
            <div className="border-t border-[var(--border)] pt-6 text-center space-y-4">
              <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                {comment.trim() ? "Message saved! " : ""}Thank you for your support.
              </p>
              <button
                onClick={() => navigate("/donate")}
                className="flex items-center gap-2 mx-auto text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to campaign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
