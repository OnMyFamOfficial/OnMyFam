import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface Props {
  text: string;
  size?: "sm" | "md";
}

export function InfoTip({ text, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [open]);

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <span className="inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="text-[var(--muted-foreground)] hover:text-gold-500 transition-colors cursor-pointer ml-1"
        title="More info"
      >
        <Info className={iconSize} />
      </button>
      {open && pos && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-64 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-lg text-xs text-[var(--foreground)] leading-relaxed"
          style={{
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
          }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[var(--border)]" />
        </div>,
        document.body
      )}
    </span>
  );
}
