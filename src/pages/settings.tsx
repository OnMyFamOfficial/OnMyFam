import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { TourList } from "@/components/shared/tour-provider";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (newPassword.length < 6) {
      setPwStatus({ type: "error", message: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: "error", message: "New passwords do not match" });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwStatus({ type: "error", message: error.message });
    } else {
      setPwStatus({ type: "success", message: "Password changed successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

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

      {/* Change Password */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          {pwStatus && (
            <div className={`px-3 py-2 rounded-lg text-sm ${pwStatus.type === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {pwStatus.message}
            </div>
          )}
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="Enter new password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                placeholder="Confirm new password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={pwSaving || !newPassword || !confirmPassword}
            className="px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {pwSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Guided Tours */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Help & Tutorials</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Need a refresher? Replay any guided tour to learn about features.
        </p>
        <TourList />
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
