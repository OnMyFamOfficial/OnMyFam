import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { RightSidebar } from "./right-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { InstallPrompt } from "@/components/shared/install-prompt";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden light-gradient dark:bg-[var(--background)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="h-full flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onRightMenuClick={() => setRightSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Outlet context={{ onMenuClick: () => setSidebarOpen(true) }} />
        </main>

        <MobileNav />
      </div>

      <RightSidebar
        mobileOpen={rightSidebarOpen}
        onMobileClose={() => setRightSidebarOpen(false)}
      />
      <ChatPanel />
      <InstallPrompt />
    </div>
  );
}
