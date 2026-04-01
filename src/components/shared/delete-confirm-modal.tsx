import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  description: string;
  confirmLabel?: string;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, title, itemName, description, confirmLabel = "Delete Permanently" }: DeleteConfirmModalProps) {
  const [typed, setTyped] = useState("");

  if (!isOpen) return null;

  const matches = typed.trim().toLowerCase() === itemName.trim().toLowerCase();

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60" onClick={onClose} />
      <div className="fixed z-[90] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="font-bold text-red-400">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
          <div>
            <p className="text-sm mb-2">
              Type <span className="font-bold text-[var(--foreground)]">{itemName}</span> to confirm:
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={itemName}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { onConfirm(); setTyped(""); }}
              disabled={!matches}
              className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {confirmLabel}
            </button>
            <button
              onClick={() => { onClose(); setTyped(""); }}
              className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
