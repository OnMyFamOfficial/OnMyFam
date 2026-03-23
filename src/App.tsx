import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { FamilyProvider } from "@/lib/hooks/use-family";
import { ChatProvider } from "@/components/chat/chat-provider";
import { VideoCallProvider } from "@/components/video/video-call-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { IncomingCallToast } from "@/components/video/incoming-call-toast";
import { VideoCallModal } from "@/components/video/video-call-modal";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { OmfLoader } from "@/components/shared/omf-loader";

const LandingPage = lazy(() => import("@/pages/landing"));
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));
const FeedPage = lazy(() => import("@/pages/feed"));
const FamilyPage = lazy(() => import("@/pages/family"));
const EventsPage = lazy(() => import("@/pages/events"));
const EventDetailPage = lazy(() => import("@/pages/event-detail"));
const EventCreatePage = lazy(() => import("@/pages/event-create"));
const PhotosPage = lazy(() => import("@/pages/photos"));
const AlbumDetailPage = lazy(() => import("@/pages/album-detail"));
const DiscussionsPage = lazy(() => import("@/pages/discussions"));
const DiscussionDetailPage = lazy(() => import("@/pages/discussion-detail"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const InviteClaimPage = lazy(() => import("@/pages/invite-claim"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const AdminPage = lazy(() => import("@/pages/admin"));
const DonatePage = lazy(() => import("@/pages/donate"));
const DonateThankyouPage = lazy(() => import("@/pages/donate-thankyou"));
const DonatePayPage = lazy(() => import("@/pages/donate-pay"));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FamilyProvider>
          <NotificationProvider>
          <ChatProvider>
          <VideoCallProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[var(--background)]"><OmfLoader size="lg" text="Loading..." /></div>}>
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
                <Route path="/donate" element={<DonatePage />} />
                <Route path="/donate/pay" element={<DonatePayPage />} />
                <Route path="/donate/thankyou" element={<DonateThankyouPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:conversationId" element={<MessagesPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
          <IncomingCallToast />
          <VideoCallModal />
          </VideoCallProvider>
          </ChatProvider>
          </NotificationProvider>
        </FamilyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
