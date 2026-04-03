import { Link } from "react-router-dom";
import { Shield, Heart, Camera, Calendar, MessageSquare, Users } from "lucide-react";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants";

const features = [
  {
    icon: Shield,
    title: "Private & Secure",
    description:
      "Your family's moments stay within your circle. No ads, no algorithms, no strangers.",
  },
  {
    icon: Heart,
    title: "Family Timeline",
    description:
      "Share updates, photos, and milestones with the people who matter most.",
  },
  {
    icon: Calendar,
    title: "Events & Reunions",
    description:
      "Plan family gatherings, track RSVPs, and chat about upcoming events.",
  },
  {
    icon: Camera,
    title: "Photo Albums",
    description:
      "Create shared albums, tag family members, and preserve memories together.",
  },
  {
    icon: MessageSquare,
    title: "Family Discussions",
    description:
      "Start conversations, share recipes, plan surprises, and stay connected.",
  },
  {
    icon: Users,
    title: "Multi-Family Support",
    description:
      "Connect with multiple family circles. Your extended family, all in one place.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
            <img src="/omf-logo.png" alt="OMF" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold font-serif text-[var(--foreground)]">
            {APP_NAME}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:text-gold-500 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 text-sm font-medium rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 lg:py-32 max-w-4xl mx-auto text-center">
        <h1 className="text-4xl lg:text-6xl font-bold text-[var(--foreground)] leading-tight">
          {APP_TAGLINE}
        </h1>
        <p className="mt-6 text-lg lg:text-xl text-[var(--muted-foreground)] max-w-2xl mx-auto">
          {APP_DESCRIPTION}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="px-8 py-3 text-base font-medium rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors shadow-lg shadow-gold-500/20"
          >
            Start Your Family Space
          </Link>
          <Link
            to="/login"
            className="px-8 py-3 text-base font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            I Have an Invite
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-[var(--card)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--foreground)]">
            Everything Your Family Needs
          </h2>
          <p className="mt-4 text-center text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Built for families, by families. A private space where your loved
            ones can connect, share, and celebrate together.
          </p>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-gold-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-md bg-gold-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-gold-500" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-[var(--foreground)]">
          Ready to Bring Your Family Together?
        </h2>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Create your private family space in less than a minute. Free forever.
        </p>
        <Link
          to="/signup"
          className="mt-8 inline-block px-8 py-3 text-base font-medium rounded-md bg-gold-500 text-white hover:bg-gold-600 transition-colors shadow-lg shadow-gold-500/20"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-white">
              <img src="/omf-logo.png" alt="OMF" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-medium text-[var(--muted-foreground)]">
              {APP_NAME} &copy; {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Private. Secure. Family First.
          </p>
        </div>
      </footer>
    </div>
  );
}
