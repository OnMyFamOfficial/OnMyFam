import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { FamilyProvider } from "@/lib/hooks/use-family";
import { ChatProvider } from "@/components/chat/chat-provider";
import { VideoCallProvider } from "@/components/video/video-call-provider";
import { IncomingCallToast } from "@/components/video/incoming-call-toast";
import { VideoCallModal } from "@/components/video/video-call-modal";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import AuthCallbackPage from "@/pages/auth-callback";
import FeedPage from "@/pages/feed";
import FamilyPage from "@/pages/family";
import EventsPage from "@/pages/events";
import EventDetailPage from "@/pages/event-detail";
import EventCreatePage from "@/pages/event-create";
import PhotosPage from "@/pages/photos";
import AlbumDetailPage from "@/pages/album-detail";
import DiscussionsPage from "@/pages/discussions";
import DiscussionDetailPage from "@/pages/discussion-detail";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import InviteClaimPage from "@/pages/invite-claim";
import MessagesPage from "@/pages/messages";
import AdminPage from "@/pages/admin";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FamilyProvider>
          <ChatProvider>
          <VideoCallProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/invite/:token" element={<InviteClaimPage />} />

              {/* Protected routes with app layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/family" element={<FamilyPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/create" element={<EventCreatePage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/photos" element={<PhotosPage />} />
                <Route path="/photos/:albumId" element={<AlbumDetailPage />} />
                <Route path="/discussions" element={<DiscussionsPage />} />
                <Route path="/discussions/:id" element={<DiscussionDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:conversationId" element={<MessagesPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <IncomingCallToast />
          <VideoCallModal />
          </VideoCallProvider>
          </ChatProvider>
        </FamilyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
