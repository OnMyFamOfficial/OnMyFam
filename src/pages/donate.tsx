import { useState } from "react";
import { Heart, Share2, Users, Clock, TrendingUp, X, MessageSquare } from "lucide-react";
import { DonateModal } from "@/components/shared/donate-modal";

// Placeholder donor activity
const ALL_DONORS = [
  { name: "Anonymous", amount: 25, timeAgo: "2 hours ago", comment: "Love this platform!" },
  { name: "LaDonna L.", amount: 50, timeAgo: "5 hours ago", comment: "Keep up the great work!" },
  { name: "Amy M.", amount: 10, timeAgo: "1 day ago", comment: null },
  { name: "Anonymous", amount: 100, timeAgo: "2 days ago", comment: "Family first, always." },
  { name: "Mayne", amount: 25, timeAgo: "3 days ago", comment: null },
  { name: "JDon", amount: 15, timeAgo: "4 days ago", comment: "This is what we need." },
  { name: "Anonymous", amount: 50, timeAgo: "5 days ago", comment: null },
  { name: "Tokina B.", amount: 10, timeAgo: "1 week ago", comment: "God bless!" },
  { name: "Carlos C.", amount: 20, timeAgo: "1 week ago", comment: null },
  { name: "Brianna B.", amount: 30, timeAgo: "2 weeks ago", comment: "Amazing idea for families." },
  { name: "Anonymous", amount: 5, timeAgo: "2 weeks ago", comment: null },
  { name: "Wesley W.", amount: 75, timeAgo: "3 weeks ago", comment: "My family loves this app!" },
];

// Hardcoded campaign progress
const RAISED = 2450;
const GOAL = 10000;
const DONOR_COUNT = 47;
const PROGRESS = Math.min((RAISED / GOAL) * 100, 100);

export default function DonatePage() {
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showAllSupporters, setShowAllSupporters] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  function handleShare() {
    navigator.clipboard.writeText("https://onmyfam.com/donate");
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Progress bar - top of page */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] px-6 py-4">
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

      {/* Two column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Campaign story */}
        <div className="flex-1 space-y-6">
          {/* Campaign story with hero image */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            {/* Hero image inside card */}
            <div
              className="relative h-56 sm:h-72"
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
            {/* Story text */}
            <div className="p-6">
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
          </div>
        </div>

        {/* Right: Action card + recent supporters */}
        <div className="lg:w-80 flex-shrink-0 space-y-4">
          {/* Action card */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 lg:sticky lg:top-4 space-y-4">
            {/* Donate button */}
            <button
              onClick={() => setShowDonateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer hover:brightness-105 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
                color: "#2e303f",
              }}
            >
              <Heart className="w-4 h-4" />
              Donate Now
            </button>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Share Campaign
            </button>

            {/* Donor count */}
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--muted-foreground)]">
              <Users className="w-4 h-4 text-gold-500" />
              <span><span className="font-semibold text-[var(--foreground)]">{DONOR_COUNT}</span> people have donated</span>
            </div>

            {/* See all supporters button */}
            <button
              onClick={() => setShowAllSupporters(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-gold-500 hover:bg-gold-500/10 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              See All Supporters
            </button>
          </div>

          {/* Recent 5 supporters */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-sm font-semibold mb-3">Recent Supporters</h3>
            <div className="divide-y divide-[var(--border)]">
              {ALL_DONORS.slice(0, 5).map((donor, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-gold-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{donor.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                      <Clock className="w-2.5 h-2.5" />
                      {donor.timeAgo}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gold-500">${donor.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Donate modal */}
      <DonateModal open={showDonateModal} onClose={() => setShowDonateModal(false)} />

      {/* All supporters modal */}
      {showAllSupporters && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setShowAllSupporters(false)} />
          <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: "80vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold-500" />
                <h2 className="font-bold">All Supporters ({ALL_DONORS.length})</h2>
              </div>
              <button
                onClick={() => setShowAllSupporters(false)}
                className="p-1 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="divide-y divide-[var(--border)]">
                {ALL_DONORS.map((donor, i) => (
                  <div key={i} className="px-6 py-3">
                    <div className="flex items-center gap-3">
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
                    {donor.comment && (
                      <div className="mt-2 ml-12 flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[var(--muted-foreground)] italic">"{donor.comment}"</p>
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
          <Share2 className="w-4 h-4 text-green-400" />
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
