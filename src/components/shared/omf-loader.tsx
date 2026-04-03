import { cn } from "@/lib/utils";

interface OmfLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function OmfLoader({ size = "md", className, text }: OmfLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 border-r-gold-500/50 animate-spin",
            sizeClasses[size]
          )}
          style={{ animationDuration: "1s" }}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full border border-gold-500/20 animate-pulse",
            sizeClasses[size]
          )}
        />
        <img
          src="/omf-logo.png"
          alt="OMF"
          className={cn(
            "rounded-md bg-white object-cover animate-pulse",
            sizeClasses[size]
          )}
          style={{ animationDuration: "2s" }}
        />
      </div>
      {text && (
        <span className="text-sm text-[var(--muted-foreground)] animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
}
