import { useState } from "react";
import { Heart, DollarSign, ExternalLink, Diamond, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CryptoDonationModal } from "@/components/shared/crypto-donation-modal";
import { PAYPAL_EMAIL, CASHAPP_TAG } from "@/config/wallets";

const AMOUNTS = [5, 10, 25, 50, 100];

// Placeholder donor activity
const RECENT_DONORS = [
  { name: "Anonymous", amount: 25, timeAgo: "2 hours ago" },
  { name: "LaDonna L.", amount: 50, timeAgo: "5 hours ago" },
  { name: "Amy M.", amount: 10, timeAgo: "1 day ago" },
  { name: "Anonymous", amount: 100, timeAgo: "2 days ago" },
  { name: "Mayne", amount: 25, timeAgo: "3 days ago" },
  { name: "JDon", amount: 15, timeAgo: "4 days ago" },
  { name: "Anonymous", amount: 50, timeAgo: "5 days ago" },
  { name: "Tokina B.", amount: 10, timeAgo: "1 week ago" },
];

// Hardcoded campaign progress
const RAISED = 2450;
const GOAL = 10000;
const DONOR_COUNT = 47;
const PROGRESS = Math.min((RAISED / GOAL) * 100, 100);

export default function DonatePage() {
  const [amount, setAmount] = useState<number | null>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [showCrypto, setShowCrypto] = useState(false);

  const selectedAmount = amount || (customAmount ? parseFloat(customAmount) : 0);

  function getPayPalUrl() {
    const params = new URLSearchParams({
      business: PAYPAL_EMAIL,
      item_name: "On My Fam Donation",
      currency_code: "USD",
      cmd: "_donations",
    });
    if (selectedAmount) params.set("amount", String(selectedAmount));
    return `https://www.paypal.com/cgi-bin/webscr?${params}`;
  }

  function getCashAppUrl() {
    const base = `https://cash.app/${CASHAPP_TAG}`;
    return selectedAmount ? `${base}/${selectedAmount}` : base;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden">
        <div
          className="h-56 sm:h-72"
          style={{ background: "linear-gradient(135deg, #1a1040, #2d1060, #401a80, #1a3060, #102040)" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                <Heart className="w-10 h-10 text-pink-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Support On My Fam</h1>
              <p className="text-sm sm:text-base text-white/70 mt-2 max-w-lg mx-auto">
                Help us build and maintain a safe, private space where families stay connected
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar overlay */}
        <div className="bg-[var(--card)] border-t border-[var(--border)] px-6 py-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-gold-500">${RAISED.toLocaleString()}</span>
              <span className="text-sm text-[var(--muted-foreground)] ml-1">raised of ${GOAL.toLocaleString()}</span>
            </div>
            <span className="text-sm text-[var(--muted-foreground)]">{DONOR_COUNT} donors</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--accent)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${PROGRESS}%`,
                background: "linear-gradient(90deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0)",
              }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1.5">{PROGRESS.toFixed(0)}% of goal reached</p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Campaign story + donor activity */}
        <div className="flex-1 space-y-6">
          {/* Campaign story */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-bold mb-4">Our Story</h2>
            <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
              <p>
                On My Fam was created with one simple mission: give families a private, safe place to stay connected.
                No algorithms, no ads, no data mining. Just your family, sharing moments that matter.
              </p>
              <p>
                Every dollar donated goes directly toward keeping the platform running, adding new features, and making
                sure On My Fam remains free for families who need it most. From real-time messaging to photo albums,
                events, and video calls, we're building the family hub that social media should have been.
              </p>
              <p>
                Whether you can give $5 or $500, your support makes a real difference. Thank you for being part of the
                On My Fam family.
              </p>
            </div>
          </div>

          {/* Donor activity feed */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gold-500" />
              <h2 className="text-lg font-bold">Recent Supporters</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {RECENT_DONORS.map((donor, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-full bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-gold-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{donor.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                      <Clock className="w-3 h-3" />
                      {donor.timeAgo}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gold-500">${donor.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Donation widget (sticky) */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 lg:sticky lg:top-4 space-y-5">
            <h3 className="font-bold text-center">Make a Donation</h3>

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

            {/* Payment method buttons */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Choose payment method</label>

              {/* PayPal */}
              <button
                onClick={() => window.open(getPayPalUrl(), "_blank")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#0070ba] bg-[#0070ba]/10 text-sm font-semibold transition-colors cursor-pointer hover:bg-[#0070ba]/20"
                style={{ color: "#0070ba" }}
              >
                <span className="text-lg font-bold">P</span>
                <span>Donate with PayPal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Cash App */}
              <button
                onClick={() => window.open(getCashAppUrl(), "_blank")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#00d632] bg-[#00d632]/10 text-sm font-semibold transition-colors cursor-pointer hover:bg-[#00d632]/20"
                style={{ color: "#00d632" }}
              >
                <span className="text-lg font-bold">$</span>
                <span>Donate with Cash App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Crypto */}
              <button
                onClick={() => setShowCrypto(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-500 bg-purple-500/10 text-purple-400 text-sm font-semibold transition-colors cursor-pointer hover:bg-purple-500/20"
              >
                <Diamond className="w-4 h-4" />
                <span>Donate with Crypto</span>
              </button>
            </div>

            {/* Big donate button */}
            <button
              onClick={() => window.open(getPayPalUrl(), "_blank")}
              disabled={!selectedAmount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer hover:brightness-105 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                color: "#2e303f",
              }}
            >
              <Heart className="w-4 h-4" />
              {selectedAmount ? `Donate $${selectedAmount}` : "Donate"}
            </button>

            <p className="text-[10px] text-[var(--muted-foreground)] text-center">
              100% of donations go toward keeping On My Fam running
            </p>
          </div>
        </div>
      </div>

      <CryptoDonationModal
        isOpen={showCrypto}
        onClose={() => setShowCrypto(false)}
        selectedAmount={selectedAmount}
      />
    </div>
  );
}
