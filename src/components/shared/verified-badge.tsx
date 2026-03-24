import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function VerifiedBadge({ size = "sm", className }: VerifiedBadgeProps) {
  const sizes = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn(sizes[size], "flex-shrink-0", className)}
      aria-label="Verified Family"
    >
      {/* Shield shape */}
      <path
        d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z"
        fill="url(#gold-gradient)"
      />
      {/* Checkmark */}
      <path
        d="M9.5 12.5l2 2 3.5-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="gold-gradient" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5c842" />
          <stop offset="100%" stopColor="#d4a020" />
        </linearGradient>
      </defs>
    </svg>
  );
}
