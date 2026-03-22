import { useState } from "react";
import { X, Copy, Check, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { WALLET_ADDRESSES } from "@/config/wallets";

type Coin = "eth" | "btc" | "usdc";

const COINS: { id: Coin; label: string; name: string; color: string }[] = [
  { id: "eth", label: "ETH", name: "Ethereum", color: "#627eea" },
  { id: "btc", label: "BTC", name: "Bitcoin", color: "#f7931a" },
  { id: "usdc", label: "USDC", name: "USD Coin", color: "#2775ca" },
];

interface CryptoDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAmount: number;
}

function truncateAddress(addr: string) {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

export function CryptoDonationModal({ isOpen, onClose, selectedAmount }: CryptoDonationModalProps) {
  const [activeCoin, setActiveCoin] = useState<Coin>("eth");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const address = WALLET_ADDRESSES[activeCoin];
  const coinInfo = COINS.find((c) => c.id === activeCoin)!;

  function handleCopy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60" onClick={onClose} />
      <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-full bg-purple-500/15 flex items-center justify-center mx-auto mb-3">
            <Diamond className="w-7 h-7 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold">Donate with Crypto</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Send any amount to one of the addresses below
          </p>
          {selectedAmount > 0 && (
            <p className="text-xs text-gold-500 mt-1">Reference amount: ${selectedAmount}</p>
          )}
        </div>

        {/* Coin selector tabs */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {COINS.map((coin) => (
              <button
                key={coin.id}
                onClick={() => { setActiveCoin(coin.id); setCopied(false); }}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors cursor-pointer",
                  activeCoin === coin.id
                    ? "border-current bg-current/10"
                    : "border-[var(--border)] hover:border-current/50"
                )}
                style={{ color: coin.color }}
              >
                <span className="text-base font-bold">{coin.label}</span>
                <span className="text-[10px] opacity-70">{coin.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Wallet address display */}
        <div className="px-6 pb-4">
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 animate-pulse-subtle">
            <div
              className="absolute inset-0 rounded-xl opacity-20 pointer-events-none"
              style={{ boxShadow: `0 0 20px ${coinInfo.color}40, inset 0 0 20px ${coinInfo.color}10` }}
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">{coinInfo.name} Address</p>
            <p className="font-mono text-sm break-all hidden sm:block">{address}</p>
            <p className="font-mono text-sm sm:hidden">{truncateAddress(address)}</p>
          </div>
        </div>

        {/* QR Code placeholder */}
        <div className="px-6 pb-4">
          <div className="w-32 h-32 mx-auto rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2">
            {/* TODO: Replace with qrcode.react component: <QRCodeSVG value={address} size={96} /> */}
            <Diamond className="w-8 h-8 text-[var(--muted-foreground)]" />
            <span className="text-[10px] text-[var(--muted-foreground)]">QR Code</span>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-2">Scan with your wallet app</p>
        </div>

        {/* Copy button */}
        <div className="px-6 pb-4">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer hover:brightness-105 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
              color: "#2e303f",
            }}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Address
              </>
            )}
          </button>
        </div>

        {/* Disclaimer */}
        <div className="px-6 pb-6">
          <p className="text-[10px] text-[var(--muted-foreground)] text-center leading-relaxed">
            Only send <span className="font-semibold" style={{ color: coinInfo.color }}>{coinInfo.label}</span> to this address. Sending the wrong asset may result in permanent loss.
          </p>
        </div>
      </div>
    </>
  );
}
