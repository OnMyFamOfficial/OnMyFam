import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Users,
  Calendar,
  Camera,
  MessageSquare,
  MessageCircle,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crown,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "@/components/shared/theme-provider";
import { useChat } from "@/components/chat/chat-provider";
import { useFamily } from "@/lib/hooks/use-family";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/feed", label: "Feed", icon: Home },
  { path: "/family", label: "Family", icon: Users },
  { path: "/events", label: "Events", icon: Calendar },
  { path: "/photos", label: "Photos", icon: Camera },
  { path: "/discussions", label: "Discussions", icon: MessageSquare },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isGodMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { totalUnread } = useChat();
  const { families, currentFamily, setCurrentFamily } = useFamily();
  const [showFamilySwitcher, setShowFamilySwitcher] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omf-sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("omf-sidebar-collapsed", collapsed.toString());
  }, [collapsed]);

  function handleNav(path: string) {
    navigate(path);
    onClose();
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Collapse/expand button — fixed, outside sidebar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "hidden lg:flex fixed top-[29px] z-[60] w-6 h-6 bg-[var(--card)] border border-[var(--border)] rounded-full items-center justify-center hover:bg-[var(--accent)] transition-all duration-300 cursor-pointer",
          collapsed ? "left-[52px]" : "left-[180px]"
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-[var(--sidebar-background)] border-r border-[var(--sidebar-border)] transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-xl shadow-black/10 dark:shadow-black/30",
          collapsed ? "w-16" : "w-48",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--sidebar-background)] flex items-center justify-between h-16 px-4">
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center w-full" : "space-x-3"
            )}
          >
            <div className="w-8 h-8 rounded-md bg-gold-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-serif font-bold text-sm">F</span>
            </div>
            {!collapsed && (
              <h2 className="text-lg font-bold text-[var(--sidebar-foreground)] whitespace-nowrap">
                On My Fam
              </h2>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className={cn("px-2 pb-2", collapsed && "hidden")}>
          <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search family..."
              className="bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none w-full"
            />
          </div>
        </div>

        {/* Family switcher */}
        {families.length > 1 && (
          <div className="px-2 pb-2 relative">
            <button
              onClick={() => setShowFamilySwitcher(!showFamilySwitcher)}
              className={cn(
                "w-full flex items-center py-1.5 rounded-lg transition-colors text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5",
                collapsed ? "justify-center px-2" : "gap-2 px-3"
              )}
              title={collapsed ? currentFamily?.name || "Switch family" : undefined}
            >
              <div className="w-5 h-5 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-gold-500">
                  {currentFamily?.name?.charAt(0).toUpperCase() || "F"}
                </span>
              </div>
              {!collapsed && (
                <>
                  <span className="text-xs truncate flex-1 text-[var(--sidebar-muted)]">
                    {currentFamily?.name || "Select family"}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 text-[var(--sidebar-muted)] transition-transform", showFamilySwitcher && "rotate-180")} />
                </>
              )}
            </button>
            {showFamilySwitcher && (
              <div className={cn(
                "absolute z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 overflow-hidden",
                collapsed ? "left-full ml-2 top-0 w-48" : "left-2 right-2 top-full mt-1"
              )}>
                {families.map((fam) => (
                  <button
                    key={fam.id}
                    onClick={() => {
                      setCurrentFamily(fam);
                      setShowFamilySwitcher(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer",
                      fam.id === currentFamily?.id
                        ? "bg-gold-500/10 text-gold-500 font-medium"
                        : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                    )}
                  >
                    <div className="w-5 h-5 rounded-md bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-gold-500">
                        {fam.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{fam.name}</span>
                    {fam.id === currentFamily?.id && <span className="text-[10px] text-gold-500 ml-auto">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="p-2 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => handleNav(item.path)}
                    className={cn(
                      "w-full flex items-center py-2 rounded-lg text-left transition-colors group relative whitespace-nowrap cursor-pointer",
                      collapsed
                        ? "justify-center px-2"
                        : "space-x-3 px-3",
                      isActive
                        ? "text-white font-medium shadow-lg"
                        : "text-[var(--sidebar-muted)] hover:text-[var(--sidebar-foreground)] hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    style={
                      isActive
                        ? {
                            background: theme === "dark"
                              ? "linear-gradient(135deg, hsl(38, 65%, 55%), hsl(38, 65%, 40%))"
                              : "#000000",
                          }
                        : undefined
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="relative flex-shrink-0">
                      <item.icon className="w-5 h-5" />
                      {item.path === "/messages" && totalUnread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--card)] text-[var(--foreground)] text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-[var(--border)]">
                        {item.label}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="sticky bottom-0 bg-[var(--sidebar-background)] p-2 flex flex-col space-y-1">
          {/* God Mode */}
          {isGodMode && (
            <button
              onClick={() => handleNav("/admin")}
              className={cn(
                "w-full flex items-center py-2 rounded-lg text-left transition-colors group relative whitespace-nowrap cursor-pointer",
                collapsed ? "justify-center px-2" : "space-x-3 px-3",
                location.pathname === "/admin"
                  ? "text-white font-medium shadow-lg"
                  : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
              )}
              style={
                location.pathname === "/admin"
                  ? { background: theme === "dark" ? "linear-gradient(135deg, hsl(0, 70%, 45%), hsl(25, 90%, 50%))" : "#000000" }
                  : undefined
              }
              title={collapsed ? "God Mode" : undefined}
            >
              <Crown className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>God Mode</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--card)] text-red-400 text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-[var(--border)]">
                  God Mode
                </div>
              )}
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center py-2 rounded-lg text-left transition-colors text-[var(--sidebar-muted)] hover:text-[var(--sidebar-foreground)] hover:bg-black/5 dark:hover:bg-white/5 group relative whitespace-nowrap cursor-pointer",
              collapsed ? "justify-center px-2" : "space-x-3 px-3"
            )}
            title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
          >
            <span className="text-lg flex-shrink-0 leading-none">{theme === "dark" ? "\u{1F31E}" : "\u{1F31C}"}</span>
            {!collapsed && (
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center py-2 rounded-lg text-left transition-colors text-[var(--sidebar-muted)] hover:text-red-400 hover:bg-red-500/10 group relative whitespace-nowrap cursor-pointer",
              collapsed ? "justify-center px-2" : "space-x-3 px-3"
            )}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
