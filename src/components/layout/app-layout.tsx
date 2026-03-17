import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { FriendsPanel } from "./friends-panel";
import { ChatPanel } from "@/components/chat/chat-panel";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isFeed = location.pathname === "/feed";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        <MobileNav />
      </div>

      <FriendsPanel showUpcoming={isFeed} />
      <ChatPanel />
    </div>
  );
}
