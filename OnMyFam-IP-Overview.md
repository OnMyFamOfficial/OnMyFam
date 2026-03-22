# On My Fam (OnMyFam) - Intellectual Property & Copyright Overview

**Prepared for:** Copyright/IP Advisor Review
**Date:** March 21, 2026
**Domain:** onmyfam.com
**Developer:** Jason (Oeconomia2025)

---

## 1. What Is On My Fam?

On My Fam is a private family social networking platform. The tagline is "Where Family Stays Connected." It allows families to create private groups where members can share posts, photos, events, discussions, and communicate via real-time messaging and video calls. The platform is designed as a closed, invite-only alternative to public social media for family use.

The app is a Progressive Web App (PWA) accessible via web browser and installable on mobile devices. It is hosted at **onmyfam.com**.

---

## 2. Original Creative Works

### 2.1 Software (Custom Source Code)

The entire application is custom-built, consisting of approximately 59 TypeScript/React source files totaling 8,500+ lines of original code. The following are wholly original, custom-developed components:

**Core Application Architecture:**
- Authentication system (email/password, Google OAuth integration)
- Family management system with roles (admin, moderator, member)
- Invite system with token-based, expiring, usage-limited invitations
- Notification engine with real-time push events
- "God Mode" administrative privilege system

**Social Features (Original Implementation):**
- Feed system with posts, reactions, comments, threaded replies, media attachments, pinning
- Foldable long-form post content with expand/collapse
- URL detection with automatic link preview cards (Open Graph/meta tag extraction)
- YouTube video embed detection with oEmbed API integration
- Photo album system with upload, captions, privacy controls, download permissions
- Discussion forum with threaded replies
- Event system with calendar date picker, RSVP tracking, event-specific chat, hosted-by assignment, date range visualization

**Real-Time Communication (Original Implementation):**
- Direct and group messaging with typing indicators
- Message reactions, reply threading, pinning, editing, deletion
- GIF and sticker integration (via Giphy API proxy)
- File and media sharing in chat
- Video/audio calling infrastructure with call state management

**UI Components (Original Design & Code):**
- Custom calendar date picker with range highlighting
- Link preview card component with loading skeleton
- Collapsible sidebar navigation with tooltip system
- Mobile-responsive layout with bottom navigation
- Custom dark/light theme system with CSS custom properties
- Custom loading spinner with branded animation

**Serverless Backend (Original):**
- Giphy API proxy with server-side caching
- Link preview scraper with YouTube/Vimeo special handling
- Invite creation and claiming endpoints
- Notification management API
- Authentication middleware

### 2.2 Branding & Design

**App Name:** "On My Fam" (also styled as "OnMyFam")
**Tagline:** "Where Family Stays Connected"
**Logo:** Golden circular emblem with serif letter "F"
**PWA Identity:** Name "On My Fam", short name "OnMyFam", custom icons (192x192 and 512x512 SVG)

**Color Palette (Original):**
- Primary accent: Gold (hsl 38, 65%, 55%) with 9-shade palette (gold-50 through gold-900)
- Dark mode background: #0b1016
- Card surfaces: #000000
- Custom border and muted foreground colors

**Typography:** Inter (sans-serif) for body text, Playfair Display (serif) for display/accent text

### 2.3 Database Schema

21 custom-designed database tables with:
- Row-level security policies for access control
- Custom PostgreSQL functions and triggers
- Hierarchical family structure support
- Real-time subscription architecture

---

## 3. Third-Party Services & Dependencies

### 3.1 Backend Services (SaaS)

| Service | Purpose | Relationship |
|---------|---------|-------------|
| Supabase | Database, authentication, real-time subscriptions, file storage | Backend-as-a-Service provider |
| Netlify | Web hosting, serverless functions, CDN | Hosting provider |
| Giphy | GIF and sticker search within chat | API consumer (free tier) |
| Google | OAuth sign-in provider | Authentication provider |
| OpenStreetMap / Nominatim | Map tiles and geocoding | Open data provider |

### 3.2 Open Source Libraries

All frontend libraries are used under permissive open-source licenses:

| Library | License | Purpose |
|---------|---------|---------|
| React 19 | MIT | UI framework |
| TypeScript 5.9 | Apache 2.0 | Type system |
| Vite 7.3 | MIT | Build tool |
| Tailwind CSS 4.2 | MIT | CSS framework |
| React Router 7 | MIT | Client-side routing |
| Supabase JS SDK | Apache 2.0 | Database client |
| Lucide React | ISC | Icon library |
| Leaflet | BSD-2-Clause | Interactive maps |
| date-fns | MIT | Date utilities |
| clsx / tailwind-merge | MIT | CSS utilities |
| class-variance-authority | MIT | Component variants |
| vite-plugin-pwa | MIT | PWA support |

No copyleft (GPL) licenses are in use. All dependencies use permissive licenses (MIT, Apache 2.0, ISC, BSD-2-Clause) that allow commercial use.

---

## 4. Domain & Distribution

- **Domain:** onmyfam.com (registered and active)
- **Distribution:** Web-based PWA (no app store listings currently)
- **GitHub Repository:** github.com/Oeconomia2025/onmyfam (public)
- **No LICENSE file currently exists in the repository**

---

## 5. User-Generated Content

The platform stores user-generated content including:
- Text posts and comments
- Uploaded photos and videos (stored in Supabase Storage)
- Chat messages and media
- Profile information (names, bios, avatars)
- Event details and RSVPs

**No Terms of Service or Privacy Policy currently exist on the platform.** These should be created to clarify:
- Ownership of user-uploaded content
- Data retention and deletion policies
- Platform's right to display/store content
- Privacy protections for family data

---

## 6. Security & Data Protection

The platform implements:
- JWT-based authentication with session management
- Row-level security on all database tables (users can only access their family's data)
- Content Security Policy (CSP) headers
- Input sanitization (HTML stripping, XSS prevention)
- File upload validation (MIME type whitelist, size limits)
- HTTPS-only deployment
- API key protection (Giphy key proxied server-side)

---

## 7. Questions for Advisor

1. **Copyright registration:** Should the source code, UI design, and/or database schema be registered with the U.S. Copyright Office?
2. **Trademark:** Should "On My Fam" / "OnMyFam" and the logo be registered as trademarks?
3. **License selection:** The repository is currently public with no license. What license should be applied (proprietary, MIT, or other)?
4. **Terms of Service:** What should be included regarding user-generated content rights?
5. **Privacy Policy:** What is required given the platform stores personal/family data, photos, and location information?
6. **Open source compliance:** Are there any actions needed to comply with the Apache 2.0 or BSD-2-Clause licenses of dependencies?
7. **API usage:** Are there IP considerations with the Giphy API, YouTube oEmbed, or OpenStreetMap data usage?
8. **Domain protection:** Should related domains (onmyfam.net, onmyfam.org, etc.) be secured?

---

## 8. Summary

On My Fam is a fully custom-built family social platform. The original works include approximately 8,500+ lines of application code, a 21-table database schema, 5 serverless API functions, a custom UI design system, and brand identity (name, logo, tagline, color palette). All third-party dependencies use permissive open-source licenses. The platform currently lacks a software license, Terms of Service, and Privacy Policy.
