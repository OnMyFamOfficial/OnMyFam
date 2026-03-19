import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("omf-install-dismissed") === "true";
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("omf-install-dismissed", "true");
  }

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-[55] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-md bg-gold-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm">F</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install On My Fam</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Add to your home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="p-2 rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors cursor-pointer flex-shrink-0"
      >
        <Download className="w-4 h-4" />
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors cursor-pointer flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
