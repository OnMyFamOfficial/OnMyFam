import { Bell, Menu, Search, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface HeaderProps {
  onMenuClick: () => void;
  onRightMenuClick?: () => void;
}

export function Header({ onMenuClick, onRightMenuClick }: HeaderProps) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--header-background)] border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-6">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 bg-[var(--background)] border border-[var(--input)] rounded-lg px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search family..."
            className="bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none w-full"
          />
        </div>
      </div>

      {/* Right: notifications + avatar + right sidebar toggle */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-[var(--accent)] transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full" />
        </button>

        <div className="w-8 h-8 rounded-md bg-gold-500/20 border border-gold-500/30 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-gold-500">
              {profile?.display_name?.charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>

        {/* Right sidebar hamburger - mobile only */}
        {onRightMenuClick && (
          <button
            onClick={onRightMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            <Users className="w-5 h-5 text-gold-500" />
          </button>
        )}
      </div>
    </header>
  );
}
