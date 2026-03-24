import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Share2, Users, Clock, TrendingUp, X, MessageSquare, DollarSign, Check, Diamond } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CryptoDonationModal } from "@/components/shared/crypto-donation-modal";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const AMOUNTS = [5, 10, 25, 50, 100];

interface Donation {
  id: string;
  amount: number;
  donor_name: string;
  comment: string | null;
  is_anonymous: boolean;
  payment_method: string;
  created_at: string;
}

export default function DonatePage() {
  const navigate = useNavigate();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [, setTotalRaised] = useState(0);
  const [donorCount, setDonorCount] = useState(0);
  const [amount, setAmount] = useState<number | null>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [showAllSupporters, setShowAllSupporters] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const selectedAmount = amount || (customAmount ? parseFloat(customAmount) : 0);

  useEffect(() => {
    loadDonations();
  }, []);

  async function loadDonations() {
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (data) {
      setDonations(data as Donation[]);
      setTotalRaised(data.reduce((sum, d) => sum + Number(d.amount), 0));
      setDonorCount(data.length);
    }
  }

  function handleDonate() {
    if (!selectedAmount || selectedAmount < 1) return;
    navigate(`/donate/pay?amount=${selectedAmount}`);
  }

  function handleShare() {
    navigator.clipboard.writeText("https://onmyfam.com/donate");
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  function formatTime(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "";
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Two column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Campaign story */}
        <div className="flex-1 space-y-6">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div
              className="relative h-56 sm:h-72"
              style={{ background: "linear-gradient(135deg, #1a1040, #2d1060, #401a80, #1a3060, #102040)" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                    <Heart className="w-10 h-10 text-pink-400" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white">Support OnMyFam</h1>
                  <p className="text-sm sm:text-base text-white/70 mt-2 max-w-lg mx-auto">
                    Help us build and maintain a safe, private space where families stay connected
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">My Story</h2>
              <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
                <p>
                  OnMyFam was created with one simple mission: give families a private, safe place to stay connected.
                  No algorithms, no ads, no data mining. Just your family, sharing moments that matter.
                </p>
                <p>
                  Every dollar donated goes directly toward keeping the platform running, adding new features, and making
                  sure OnMyFam remains free for families who need it most. From real-time messaging to photo albums,
                  events, and video calls, we're building the family hub that social media should have been.
                </p>
                <p>
                  Whether you can give $5 or $500, your support makes a real difference. Thank you for being part of the
                  family, and that's OnMyFam.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)]">Created by <span className="text-[var(--foreground)] font-medium">Jason Wiggins</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Donation widget + recent supporters */}
        <div className="lg:w-80 flex-shrink-0 space-y-6">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 lg:sticky lg:top-4 space-y-4">
            {/* Amount selection */}
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">Select an amount</label>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAmount(a); setCustomAmount(""); }}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border",
                      amount === a
                        ? "bg-gold-500 text-white border-gold-500"
                        : "border-[var(--border)] hover:border-gold-500/50 text-[var(--foreground)]"
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setAmount(null); }}
                  placeholder="Custom amount"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
            </div>

            {/* Donate button */}
            <button
              onClick={handleDonate}
              disabled={!selectedAmount || selectedAmount < 1}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer hover:brightness-105 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                color: "#2e303f",
              }}
            >
              <Heart className="w-4 h-4" />
              {selectedAmount ? `Donate $${selectedAmount}` : "Donate"}
            </button>
            <p className="text-[10px] text-[var(--muted-foreground)] text-center">
              Accepts cards, Cash App, and more via secure checkout
            </p>

            {/* Crypto option */}
            <button
              onClick={() => setShowCrypto(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/10 transition-colors cursor-pointer"
            >
              <Diamond className="w-3.5 h-3.5" />
              Donate with Crypto
            </button>

            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Share Campaign
              </button>

              <div className="flex items-center justify-center gap-2 py-1 text-sm text-[var(--muted-foreground)]">
                <Users className="w-4 h-4 text-gold-500" />
                <span><span className="font-semibold text-[var(--foreground)]">{donorCount}</span> people have donated</span>
              </div>

              {donations.length > 0 && (
                <button
                  onClick={() => setShowAllSupporters(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-gold-500 hover:bg-gold-500/10 transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  See All Supporters
                </button>
              )}
            </div>
          </div>

          {/* Recent 5 supporters */}
          {donations.length > 0 && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold mb-3">Recent Supporters</h3>
              <div className="divide-y divide-[var(--border)]">
                {donations.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-gold-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{d.is_anonymous ? "Anonymous" : d.donor_name}</p>
                      <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(d.created_at)}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gold-500">${d.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crypto modal */}
      <CryptoDonationModal isOpen={showCrypto} onClose={() => setShowCrypto(false)} selectedAmount={selectedAmount} />

      {/* All supporters modal */}
      {showAllSupporters && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setShowAllSupporters(false)} />
          <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold-500" />
                <h2 className="font-bold">All Supporters ({donations.length})</h2>
              </div>
              <button onClick={() => setShowAllSupporters(false)} className="p-1 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="divide-y divide-[var(--border)]">
                {donations.map((d) => (
                  <div key={d.id} className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-gold-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{d.is_anonymous ? "Anonymous" : d.donor_name}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                          <Clock className="w-3 h-3" />
                          {formatTime(d.created_at)}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gold-500">${d.amount}</span>
                    </div>
                    {d.comment && (
                      <div className="mt-2 ml-12 flex items-start gap-1.5 bg-[var(--accent)]/50 rounded-lg px-3 py-2">
                        <MessageSquare className="w-3 h-3 text-gold-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[var(--muted-foreground)] italic">"{d.comment}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-green-400" />
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
