import { useState } from "react";
import { X, Heart, DollarSign, ExternalLink, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { CryptoDonationModal } from "./crypto-donation-modal";
import { PAYPAL_EMAIL, CASHAPP_TAG } from "@/config/wallets";

const AMOUNTS = [5, 10, 25, 50, 100];

interface DonateModalProps {
  open: boolean;
  onClose: () => void;
}

export function DonateModal({ open, onClose }: DonateModalProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<"paypal" | "cashapp" | "crypto" | null>(null);
  const [showCrypto, setShowCrypto] = useState(false);

  if (!open) return null;

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

  function handleDonate() {
    if (method === "paypal") {
      window.open(getPayPalUrl(), "_blank");
    } else if (method === "cashapp") {
      window.open(getCashAppUrl(), "_blank");
    } else if (method === "crypto") {
      setShowCrypto(true);
    }
  }

  function reset() {
    setAmount(null);
    setCustomAmount("");
    setMethod(null);
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => { onClose(); reset(); }} />
      <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={() => { onClose(); reset(); }}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-full bg-gold-500/15 flex items-center justify-center mx-auto mb-3">
            <Heart className="w-7 h-7 text-gold-500" />
          </div>
          <h2 className="text-lg font-bold">Support On My Fam</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Help us keep the family connected. Every contribution makes a difference.
          </p>
        </div>

        {/* Amount selection */}
        <div className="px-6 pb-4">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">Select an amount</label>
          <div className="grid grid-cols-5 gap-2 mb-3">
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

        {/* Payment method */}
        <div className="px-6 pb-4">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setMethod("paypal")}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors cursor-pointer",
                method === "paypal"
                  ? "border-[#0070ba] bg-[#0070ba]/10"
                  : "border-[var(--border)] hover:border-[#0070ba]/50"
              )}
            >
              <span className="text-lg font-bold" style={{ color: "#0070ba" }}>P</span>
              <span className="text-[10px] font-medium">PayPal</span>
            </button>
            <button
              onClick={() => setMethod("cashapp")}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors cursor-pointer",
                method === "cashapp"
                  ? "border-[#00d632] bg-[#00d632]/10"
                  : "border-[var(--border)] hover:border-[#00d632]/50"
              )}
            >
              <span className="text-lg font-bold" style={{ color: "#00d632" }}>$</span>
              <span className="text-[10px] font-medium">Cash App</span>
            </button>
            <button
              onClick={() => setMethod("crypto")}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors cursor-pointer",
                method === "crypto"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-[var(--border)] hover:border-purple-500/50"
              )}
            >
              <Diamond className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] font-medium">Crypto</span>
            </button>
          </div>
        </div>

        {/* Donate button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDonate}
            disabled={!method}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer hover:brightness-105 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
              color: "#2e303f",
            }}
          >
            <ExternalLink className="w-4 h-4" />
            {selectedAmount ? `Donate $${selectedAmount}` : "Donate"}
          </button>
          <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-2">
            {method === "crypto" ? "You'll see wallet addresses to send crypto to." : `You'll be redirected to ${method === "cashapp" ? "Cash App" : method === "paypal" ? "PayPal" : "your chosen payment method"} to complete your donation.`}
          </p>
        </div>
      </div>

      <CryptoDonationModal
        isOpen={showCrypto}
        onClose={() => setShowCrypto(false)}
        selectedAmount={selectedAmount}
      />
    </>
  );
}
