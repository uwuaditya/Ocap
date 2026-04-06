# OCAP — Construction Gig Marketplace

## Overview

OCAP is a web-based construction gig marketplace that connects **workers** (laborers looking for jobs) with **hirers** (contractors posting job sites). Built as a responsive PWA that works on both desktop and mobile browsers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 with custom design tokens |
| Auth | Clerk (`@clerk/clerk-react` v5) — Google OAuth |
| Database | Supabase (PostgreSQL + PostGIS) |
| Build | Vite v6 |
| Monorepo | npm workspaces |

---

## Project Structure

```
ocapf/
├── package.json                 # Root workspace config
├── schema.sql                   # Database schema + seed data
├── apps/
│   └── web/                     # Main web application
│       ├── .env                 # Environment variables
│       ├── index.html           # HTML entry point (PWA meta tags)
│       ├── package.json         # Web app dependencies
│       ├── tailwind.config.ts   # Tailwind config (imports design tokens)
│       ├── vite.config.ts       # Vite bundler config
│       ├── public/
│       │   ├── manifest.json    # PWA manifest
│       │   └── sw.js            # Service worker (disabled)
│       └── src/
│           ├── main.tsx         # App entry — ClerkProvider + BrowserRouter
│           ├── App.tsx          # Route definitions
│           ├── index.css        # Global styles + Tailwind directives
│           ├── auth/
│           │   └── ProtectedRoute.tsx
│           ├── components/
│           │   ├── MobileShell.tsx
│           │   └── screens/
│           │       ├── LoginScreen.tsx
│           │       ├── SignUpScreen.tsx
│           │       ├── AuthRedirectScreen.tsx
│           │       ├── OnboardingScreen.tsx
│           │       ├── OnboardingWorkerProfileScreen.tsx
│           │       ├── OnboardingHirerProfileScreen.tsx
│           │       ├── FeedScreen.tsx
│           │       ├── MapScreen.tsx
│           │       ├── JobDetailScreen.tsx
│           │       ├── MyJobsScreen.tsx
│           │       ├── ProfileScreen.tsx
│           │       ├── HirerDashboardScreen.tsx
│           │       └── PostJobScreen.tsx
│           ├── lib/
│           │   ├── supabase.ts      # Supabase client init
│           │   ├── jobs.ts          # Job fetching functions
│           │   ├── jobDisplay.ts    # Display formatting helpers
│           │   └── geo.ts          # Haversine distance + geography parsing
│           ├── types/
│           │   ├── job.ts          # Job / application types
│           │   └── user.ts         # User + worker profile types
│           └── worker/
│               ├── WorkerLayout.tsx      # Layout with sidebar/bottom nav
│               ├── WorkerBottomNav.tsx   # Mobile bottom nav + desktop sidebar
│               └── WorkerJobsContext.tsx # Shared job data context
└── packages/
    └── ui/
        └── src/
            ├── tokens.ts    # Design tokens (colors, typography, spacing)
            ├── theme.ts     # Theme exports
            └── index.ts     # Package entry
```

---

## Environment Variables

File: `apps/web/.env`

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_test_` or `pk_live_`) |

---

## Authentication Flow

Authentication uses **Clerk** (e.g. Google OAuth) via the prebuilt `<SignIn>` and `<SignUp>` components. **Supabase `users`** is the source of truth for role and profile: rows use the Clerk user id (`user_…`) as primary key (see `schema.sql`).

```
/login or /sign-up  ──→  Clerk completes OAuth
                                    │
                              /auth-redirect
                                    │
                    Supabase `users` row for this Clerk id?
                                    │
              ┌─────────────────────┴─────────────────────┐
              NO                                        YES
              │                                           │
        /onboarding                              role from DB
     Step 1: Hirer vs Worker                              │
              │                                    /worker/feed
              │  (Clerk metadata role hint)            or /hirer
              ▼
     /onboarding/worker  or  /onboarding/hirer
     Step 2: Profile form → INSERT `users` (+ `worker_profiles` for workers)
              │
              └──→ Dashboard
```

**Protected routes:** If signed in but there is **no** `users` row (or empty `role`), `ProtectedRoute` sends the user to `/onboarding` (Uber-style: account exists in Clerk, app profile not finished yet).

### Key Files

- **`LoginScreen.tsx`** — `<SignIn>` with `signUpUrl="/sign-up"` and `fallbackRedirectUrl="/auth-redirect"`
- **`SignUpScreen.tsx`** — `<SignUp>` with `signInUrl="/login"` and the same post-auth redirect
- **`AuthRedirectScreen.tsx`** — Looks up Supabase `users` by Clerk id; navigates to `/onboarding`, `/worker/feed`, or `/hirer`
- **`OnboardingScreen.tsx`** — Step 1: role cards; updates Clerk `unsafeMetadata.role` and navigates to `/onboarding/worker` or `/onboarding/hirer`
- **`OnboardingWorkerProfileScreen.tsx`** / **`OnboardingHirerProfileScreen.tsx`** — Step 2: collect fields, then insert into `users` (and `worker_profiles` for workers), then go to the app home
- **`ProtectedRoute.tsx`** — Requires Clerk sign-in; requires a `users` row with `role` unless the path is under `/onboarding`

---

## Route Map

| Path | Component | Auth Required | Description |
|------|-----------|:---:|-------------|
| `/` | `<Navigate to="/login">` | No | Redirects to login |
| `/login/*` | `LoginScreen` | No | Clerk Google OAuth sign-in |
| `/sso-callback` | `AuthenticateWithRedirectCallback` | No | Clerk OAuth callback handler |
| `/auth-redirect` | `AuthRedirectScreen` | No | Post-auth role-based routing |
| `/onboarding` | `OnboardingScreen` | Yes | Role selection (worker/hirer) |
| `/worker` | `WorkerLayout` → redirects to `/worker/feed` | Yes | Worker section root |
| `/worker/feed` | `FeedScreen` | Yes | Available gigs feed |
| `/worker/map` | `MapScreen` | Yes | Map view of nearby jobs |
| `/worker/my-jobs` | `MyJobsScreen` | Yes | Applied jobs (placeholder) |
| `/worker/profile` | `ProfileScreen` | Yes | Worker profile + sign out |
| `/worker/job/:jobId` | `JobDetailScreen` | Yes | Single job detail view |
| `/hirer` | `HirerDashboardScreen` | Yes | Hirer dashboard + sign out |
| `/hirer/post` | `PostJobScreen` | Yes | Post a new job site form |
| `*` | `<Navigate to="/login">` | No | Catch-all redirect |

---

## Database Schema

PostgreSQL with PostGIS extension, hosted on Supabase.

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Auto-generated or Clerk user ID |
| `role` | text | `'worker'` or `'hirer'` |
| `name` | text | Display name |
| `phone` | text (unique) | Phone number |
| `avatar_url` | text | Profile image URL |
| `created_at` | timestamptz | Auto-set |

#### `worker_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK, FK → users) | References users table |
| `skills` | text[] | Array of skills |
| `hourly_rate` | numeric | Worker's rate |
| `experience_years` | int | Years of experience |
| `is_available` | boolean | Default true |
| `rating` | numeric | Default 0 |

#### `job_postings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Auto-generated |
| `hirer_id` | uuid (FK → users) | Who posted it |
| `title` | text | Job title |
| `description` | text | Details, duration |
| `location` | geography(Point, 4326) | PostGIS point |
| `address` | text | Human-readable address |
| `hourly_rate` | numeric | Rate per hour (if not fixed) |
| `is_fixed_rate` | boolean | Whether fixed rate applies |
| `fixed_rate` | numeric | Total fixed payment |
| `personnel_count` | int | Workers needed |
| `daily_hours` | numeric | Hours per day |
| `start_date` | date | When job starts |
| `shift_start` | time | Shift start time |
| `is_urgent` | boolean | Urgent flag |
| `status` | text | `'active'`, `'filled'`, or `'closed'` |
| `created_at` | timestamptz | Auto-set |

#### `applications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Auto-generated |
| `worker_id` | uuid (FK → users) | Applicant |
| `job_id` | uuid (FK → job_postings) | Target job |
| `status` | text | `'pending'`, `'accepted'`, or `'rejected'` |
| `created_at` | timestamptz | Auto-set |

### Row Level Security (RLS)

- `job_postings`: anonymous read for rows where `status = 'active'`
- `users`: anonymous read for rows where `role = 'hirer'` (employer names in job cards)

### Seed Data

3 hirers and 3 active job postings near Rohini, Delhi are seeded for development.

---

## Responsive Layout

The app uses Tailwind `md:` breakpoints (768px) for desktop adaptation.

### Mobile (< 768px)
- Full-width, full-height screens
- Fixed bottom tab bar navigation (Feed, Map, My Jobs, Profile)
- Touch targets minimum 44px height
- Hidden scrollbars on touch devices

### Desktop (≥ 768px)
- Full-width, no max-width constraint
- Left sidebar navigation (72px wide, black background, lime active state) replaces bottom tab bar
- Feed screen: 2-column grid of job cards
- Map screen: map takes ~70% width, job detail panel on right side (30%, min 340px)
- Login screen: centered card (max 420px)
- Onboarding: side-by-side role cards (max 600px)
- Post Job: centered form (max 600px)
- Hirer Dashboard: centered content (max 480px)

### Navigation

**Worker flow (sidebar on desktop / bottom bar on mobile):**
- Feed — grid icon
- Map — map icon
- My Jobs — wrench icon
- Profile — person icon

All nav items use the same lime (`#E2FF00`) active state with black text; inactive items are muted.

---

## Design System

Design tokens live in `packages/ui/src/tokens.ts` and are consumed by Tailwind via `tailwindThemeExtend`.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Lime (Feed) | `#E2FF00` | Buttons, active nav, rate badges |
| Lime (Map) | `#E2FF00` | Map pins, rate box, CTA buttons |
| Lime (Post) | `#E0FF00` | Post form buttons, wage display |
| Black | `#000000` | Text, borders, dark backgrounds |
| White | `#FFFFFF` | Cards, page backgrounds |
| Meta text | `#666666` | Secondary text, timestamps |
| Urgent card | `#1A1A1A` | Dark card for urgent jobs |

### Typography (Inter font)

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `ocap-title` | 32px | 900 | Page titles |
| `ocap-card-title` | 18px | 800 | Card headings |
| `ocap-btn` | 14px | 800 | Button text |
| `ocap-label` | 11px | 500 | Form labels |
| `ocap-meta` | 11px | 700 | Metadata text |
| `ocap-nav` | 10px | 800 | Navigation labels |
| `ocap-map-title` | 20px | 900 | Map panel title |
| `ocap-wage` | 40px | 900 | Wage display |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `ocap-x` | 20px | Horizontal page padding |
| `ocap-y` | 16px | Vertical section gap |
| `ocap-card` | 16px | Card internal padding |
| `ocap-section` | 24px | Section spacing |

---

## Screen Descriptions

### Login (`/login`)
Black background, OCAP title in lime, "Construction Gig Marketplace" subtitle, Clerk `<SignIn>` component handling Google OAuth.

### Onboarding (`/onboarding`)
Two role selection cards on black background:
- "I'm looking for work" (worker) — bar chart icon
- "I'm hiring" (hirer) — briefcase icon

On desktop, cards display side-by-side.

### Feed (`/worker/feed`)
- Header: OCAP logo, location pill ("Rohini, DL"), profile avatar
- "Available Gigs" title
- Filter chips: ALL, NEARBY, TODAY, ₹/HR
- Job cards list (2-column grid on desktop):
  - **Standard card**: white background, title, rate badge, distance, schedule, employer info, "Request job" CTA
  - **Urgent card**: dark background, "Urgent" badge, lime accents, fixed rate display

### Map (`/worker/map`)
- Header: OCAP logo, Map/List toggle, profile avatar
- Search bar with filter icon
- Dot-grid map placeholder with positioned job pins (hardhat icons)
- Selected job detail panel (bottom overlay on mobile, right sidebar on desktop):
  - Urgent badge, title, employer, rate box
  - Distance/Duration stats grid
  - "Request job" + Share buttons

### Job Detail (`/worker/job/:id`)
Full job card with back button, employer info, description. Fetches single job from Supabase by ID.

### My Jobs (`/worker/my-jobs`)
Placeholder screen — "No active applications yet."

### Profile (`/worker/profile`)
Placeholder with signed-in email display and sign-out button.

### Hirer Dashboard (`/hirer`)
- "Post new job site" CTA button
- "Switch to worker app" link
- Signed-in email display
- Sign out button

### Post Job (`/hirer/post`)
Multi-step form (Phase 01, Step 1 of 3):
- Required skillset dropdown
- Personnel count input
- Daily duration (hrs) input
- Proposed wage display (₹450/hr)
- Commencement date picker
- Shift start time picker
- Site geo-location map with pin
- Operational briefing textarea
- Fixed bottom bar: "Post job site" + Save draft

---

## Data Flow

### Job Fetching

```
FeedScreen
  └── useEffect → supabase.from('job_postings').select('*').eq('status','active')
      └── Sets local state, renders GigCardStandard / GigCardUrgent

MapScreen / JobDetailScreen
  └── WorkerJobsContext (shared context)
      └── fetchActiveJobs() from lib/jobs.ts
          └── supabase.from('job_postings')
                .select('*, hirer:users!hirer_id(name, avatar_url)')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
```

### Distance Calculation

Jobs have PostGIS `geography(Point, 4326)` locations. The client parses these (WKT or GeoJSON format) and calculates Haversine distance from a reference point (Rohini, Delhi: 28.7075°N, 77.1025°E).

---

## PWA Configuration

### `public/manifest.json`
- Name: OCAP
- Display: standalone
- Background: `#000000`
- Theme: `#CCFF00`
- Orientation: portrait

### Service Worker
Currently disabled. `sw.js` only clears old caches. `index.html` has an inline script that unregisters any previously registered service workers.

### Meta Tags (index.html)
- `<meta name="theme-color" content="#CCFF00">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173

# Production build
npm run build
```

### Prerequisites
1. Node.js 18+
2. Supabase project with PostGIS enabled — run `schema.sql` in the SQL editor
3. Clerk account with Google OAuth enabled
4. `.env` file in `apps/web/` with all three keys set

---

## Current Status

### Working
- Clerk Google OAuth login flow
- Role-based onboarding (worker/hirer)
- Protected routes with auth guards
- Live job feed from Supabase
- Map view with positioned pins and job detail panel
- Job detail page with dynamic fetching
- Responsive desktop layout (sidebar nav, 2-col grid, side panels)
- Sign out from Profile and Hirer Dashboard

### Placeholder / Coming Soon
- My Jobs screen (no application logic yet)
- Profile screen (no editable fields yet)
- Post Job form (UI only, no submit handler)
- Filter chips on feed (UI only, "ALL" always selected)
- Map is a dot-grid placeholder (no real map tiles)
- Search bar on map (no functionality)
- Application/hiring workflow
- Push notifications
- Real geolocation (uses hardcoded Rohini reference point)
