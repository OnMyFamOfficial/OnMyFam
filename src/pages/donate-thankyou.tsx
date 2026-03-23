import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, Check, MessageSquare, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-provider";

export default function DonateThankyouPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const sessionId = searchParams.get("session_id");
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [donation, setDonation] = useState<{ id: string; amount: number; donor_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Poll for the donation to appear (webhook might take a moment)
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("donations")
        .select("id, amount, donor_name")
        .eq("stripe_session_id", sessionId)
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
  }, [sessionId]);

  async function handleSaveComment() {
    if (!donation || !comment.trim()) return;
    setSaving(true);

    await supabase
      .from("donations")
      .update({
        comment: comment.trim(),
        donor_name: profile?.display_name || donation.donor_name,
        user_id: user?.id || null,
        is_anonymous: false,
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
            <p className="text-[var(--muted-foreground)]">Processing your donation...</p>
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

        {/* Comment section */}
        {donation && !saved && (
          <div className="px-8 pb-8 space-y-4">
            <div className="border-t border-[var(--border)] pt-6">
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
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveComment}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer hover:brightness-105 hover:shadow-lg disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                    color: "#2e303f",
                  }}
                >
                  <Heart className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Message"}
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
            <div className="border-t border-[var(--border)] pt-6 text-center">
              <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                Message saved! Thank you for your support.
              </p>
            </div>
          </div>
        )}

        {/* Back to donate */}
        <div className="px-8 pb-8 text-center">
          <button
            onClick={() => navigate("/donate")}
            className="flex items-center gap-2 mx-auto text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to campaign
          </button>
        </div>
      </div>
    </div>
  );
}
