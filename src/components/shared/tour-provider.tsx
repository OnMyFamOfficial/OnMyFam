import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { X, ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";

export interface TourStep {
  target?: string; // CSS selector for element to highlight
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export interface TourDef {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
}

// ── Tour Definitions ──
export const TOURS: TourDef[] = [
  {
    id: "welcome",
    name: "Welcome to OnMyFam",
    description: "Get started with the basics of OnMyFam",
    steps: [
      { title: "Welcome to OnMyFam!", content: "OnMyFam is your private family hub for staying connected, planning events, sharing memories, and keeping everyone in the loop. Let's walk you through the basics!" },
      { target: "[data-tour='sidebar']", title: "Navigation", content: "Use the sidebar to navigate between pages. You'll find your Feed, Family, Events, Photos, Messages, and more here.", position: "right" },
      { target: "[data-tour='profile-link']", title: "Your Profile", content: "Click here to set up your profile. Add your name, photo, location, and bio so your family knows who you are.", position: "right" },
      { target: "[data-tour='settings-link']", title: "Settings", content: "You can find all your settings here, including the ability to replay any of these guided tours whenever you need a refresher!", position: "right" },
      { title: "You're all set!", content: "That's the basics! Explore the app, set up your profile, and start connecting with your family. You can always replay this tour from Settings." },
    ],
  },
  {
    id: "profile",
    name: "Profile Setup",
    description: "Learn how to set up and customize your profile",
    steps: [
      { title: "Your Profile", content: "Your profile is how your family sees you. Let's set it up!" },
      { title: "Cover & Avatar", content: "Click 'Edit Profile' to upload a cover photo and profile picture. Your avatar appears across the app next to your posts and messages." },
      { title: "Name & Display Preference", content: "You can set your first name, last name, and display name separately. Choose how you want your name shown: display name, first & last, or first name only." },
      { title: "Location & Contact", content: "Add your street address, city, and state so family can see where you are on the Family Map. Add your phone and email so they can reach you." },
      { title: "Privacy Settings", content: "Control who sees your profile details. Choose Public (anyone), Family (verified members only), or Private (only you and family admins)." },
      { title: "Menu Button", content: "Click the Menu button to switch between About, Photos, Posts, and More tabs on your profile." },
    ],
  },
  {
    id: "family",
    name: "Family Management",
    description: "Learn how to create and manage your family group",
    steps: [
      { title: "Your Family", content: "The Family page is where you manage your family group, members, and connections." },
      { title: "Creating a Family", content: "If you haven't joined a family yet, you can create one or join an existing one with an invite code." },
      { title: "Menu & Sections", content: "Click the Menu button to access Invitations (invite new members), Family Settings, Connections (family relationships), and more." },
      { title: "Family Map", content: "When you click on a family member, you can see their location on the map. Toggle 'Family Map' to see everyone at once!" },
      { title: "Relationships", content: "In the Connections section, you can define how you're related to each family member (mother, brother, cousin, etc.)." },
    ],
  },
  {
    id: "events",
    name: "Events & Planning",
    description: "Learn how to create and manage family events",
    steps: [
      { title: "Family Events", content: "Plan family gatherings, reunions, birthdays, and more. Everyone in the family can see upcoming events and RSVP." },
      { title: "Creating an Event", content: "Click 'Create Event' to set up a new event. Add a title, description, date, location, and cover photo." },
      { title: "Event Details Tabs", content: "When creating an event, use the tabs (Main, Lodging, Transportation, More) to add detailed info like hotel details, nearby airports, what to bring, and more." },
      { title: "Nearby Airports", content: "The airport picker automatically suggests airports near your event location, sorted by distance!" },
      { title: "Guest Count", content: "Event creators can enable 'Allow guests' so attendees can indicate how many extra people they're bringing." },
      { title: "RSVP & Attending", content: "Click Going, Maybe, or Can't Make It to RSVP. If guests are enabled, you can add how many people you're bringing." },
      { title: "Menu View", content: "Click the Menu button to switch between Details, Travel (lodging & transportation info), Attending, Chat, and More." },
      { title: "Attendee Report", content: "Event creators and family admins can export an attendee report (CSV) with everyone's contact info. Control who has access in the event settings." },
    ],
  },
];

// ── Context ──
interface TourContextType {
  startTour: (tourId: string) => void;
  triggerPageTour: (tourId: string) => void;
  completedTours: string[];
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
}

const TourContext = createContext<TourContextType>({
  startTour: () => {},
  triggerPageTour: () => {},
  completedTours: [],
  resetTour: () => {},
  resetAllTours: () => {},
});

export const useTour = () => useContext(TourContext);

// ── Provider ──
export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourDef | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("omf-completed-tours") || "[]");
    } catch { return []; }
  });

  const startTour = useCallback((tourId: string) => {
    const tour = TOURS.find((t) => t.id === tourId);
    if (tour) {
      setActiveTour(tour);
      setStepIndex(0);
    }
  }, []);

  const resetTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = prev.filter((id) => id !== tourId);
      localStorage.setItem("omf-completed-tours", JSON.stringify(next));
      return next;
    });
  }, []);

  const resetAllTours = useCallback(() => {
    setCompletedTours([]);
    localStorage.setItem("omf-completed-tours", "[]");
  }, []);

  function completeTour() {
    if (activeTour) {
      setCompletedTours((prev) => {
        const next = [...new Set([...prev, activeTour.id])];
        localStorage.setItem("omf-completed-tours", JSON.stringify(next));
        return next;
      });
    }
    setActiveTour(null);
    setStepIndex(0);
  }

  function next() {
    if (!activeTour) return;
    if (stepIndex < activeTour.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      completeTour();
    }
  }

  function prev() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  // Auto-start welcome tour for first-time users (only on initial load)
  useEffect(() => {
    if (!completedTours.includes("welcome") && !activeTour) {
      const timer = setTimeout(() => startTour("welcome"), 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start page-specific tours when visiting for the first time
  const triggerPageTour = useCallback((tourId: string) => {
    if (!completedTours.includes(tourId) && !activeTour) {
      const timer = setTimeout(() => startTour(tourId), 800);
      return () => clearTimeout(timer);
    }
  }, [completedTours, activeTour, startTour]);

  const step = activeTour ? activeTour.steps[stepIndex] : null;

  return (
    <TourContext.Provider value={{ startTour, triggerPageTour, completedTours, resetTour, resetAllTours }}>
      {children}

      {/* Tour Overlay */}
      {activeTour && step && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[200] bg-black/60" onClick={() => completeTour()} />

          {/* Step Card */}
          <div className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--accent)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    {stepIndex + 1} / {activeTour.steps.length}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">|</span>
                  <span className="text-xs text-gold-500 font-medium">{activeTour.name}</span>
                </div>
                <button onClick={() => completeTour()} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{step.content}</p>
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-2">
                <div className="w-full h-1 bg-[var(--accent)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-500 rounded-full transition-all duration-300"
                    style={{ width: `${((stepIndex + 1) / activeTour.steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
                <button
                  onClick={() => completeTour()}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  Skip tour
                </button>
                <div className="flex items-center gap-2">
                  {stepIndex > 0 && (
                    <button
                      onClick={prev}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--accent)] cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back
                    </button>
                  )}
                  <button
                    onClick={next}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-gold-500 text-white text-sm font-medium hover:bg-gold-600 cursor-pointer"
                  >
                    {stepIndex < activeTour.steps.length - 1 ? (
                      <>Next <ChevronRight className="w-3.5 h-3.5" /></>
                    ) : (
                      "Done"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </TourContext.Provider>
  );
}

// ── Tour List Component (for Settings page) ──
export function TourList() {
  const { startTour, completedTours, resetAllTours } = useTour();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Guided Tours</h3>
        {completedTours.length > 0 && (
          <button
            onClick={resetAllTours}
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset all
          </button>
        )}
      </div>
      {TOURS.map((tour) => {
        const done = completedTours.includes(tour.id);
        return (
          <div key={tour.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--accent)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tour.name}</span>
                {done && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">Completed</span>}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{tour.description}</p>
            </div>
            <button
              onClick={() => startTour(tour.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
            >
              {done ? "Replay" : "Start"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
