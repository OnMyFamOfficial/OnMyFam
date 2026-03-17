import { useTheme } from "@/components/shared/theme-provider";
import { useAuth } from "@/components/auth/auth-provider";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[var(--muted-foreground)]">
          Manage your account and preferences
        </p>
      </div>

      {/* Appearance */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Switch between light and dark mode
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Display Name
            </p>
            <p className="font-medium">{profile?.display_name || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">Privacy</p>
            <p className="font-medium capitalize">
              {profile?.privacy_level || "family"}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Notifications</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Notification preferences coming soon
        </p>
      </div>
    </div>
  );
}
