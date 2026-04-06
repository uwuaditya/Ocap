---
name: ocap
description: "Use this skill for ALL development work on the OCAP construction gig marketplace. Triggers: any mention of OCAP, job postings, worker/hirer flow, construction marketplace, or any file in the ocapf/ project. Contains the full product context, architecture, error patterns, and prompting rules for Cursor."
---

# OCAP — Cursor Development Skill

## Project Identity
OCAP (On-Call Access Platform) is a construction gig marketplace connecting
workers (labourers) with hirers (contractors). It is a responsive PWA — one
web app that works on desktop and mobile browsers identically.

---

## Stack (Never Change These)
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 + custom design tokens |
| Auth | Clerk (@clerk/clerk-react v5) — Google OAuth only |
| Database | Supabase (PostgreSQL + PostGIS) |
| Monorepo | npm workspaces |

---

## Critical Rules — Read Before Every Session

1. **Supabase user IDs are TEXT, not UUID.**
   All id columns in users, worker_profiles, job_postings (hirer_id),
   and applications (worker_id) are type TEXT storing Clerk IDs (user_xxx).
   NEVER cast to uuid. NEVER use crypto.randomUUID() for user ids.

2. **Always use Clerk's user.id directly.**
   const { user } = useUser()
   hirer_id: user.id  ← plain string, no conversion

3. **Never change colors, fonts, spacing, or layout.**
   Only add functionality. The design is locked.

4. **Console.log ALL Supabase responses.**
   Always include: console.log('[ComponentName]', { data, error })

5. **One feature per Cursor session.**
   Don't let a single chat grow too long or quality degrades.

6. **Always @reference files before editing them.**
   Use @PostJobScreen.tsx, @schema.sql etc. so Cursor reads before writing.

7. **Service worker is disabled.**
   public/sw.js only clears old caches. Do not re-enable it.

---

## Design Tokens (Never Override)
| Token | Value | Usage |
|-------|-------|-------|
| Lime | #E2FF00 | Buttons, active nav, badges, CTAs |
| Black | #000000 | Backgrounds, text |
| White | #FFFFFF | Cards, page backgrounds |
| Dark card | #1A1A1A | Urgent job cards |
| Meta text | #666666 | Secondary text |
| Error | #FF4444 | Validation errors |
| Font | Inter | All typography |
| Title | 32px / weight 900 | Page titles |
| Card title | 18px / weight 800 | Card headings |
| Button | 14px / weight 800 | Button text |
| Label | 11px / weight 500 | Form labels |

---

## User Flow

### Worker Flow
1. /login → Google OAuth (Clerk SignIn component)
2. /auth-redirect → checks role in Clerk metadata
3. New user → /onboarding → selects "I'm looking for work"
   → inserts into Supabase users table { id: user.id, role: 'worker' }
   → redirects to /worker/feed
4. Returning worker → /worker/feed directly

### Worker Screens
- /worker/feed — Available gigs, filter chips (ALL/NEARBY/TODAY/₹HR)
- /worker/map — Map with job pins, job detail panel
- /worker/job/:id — Single job detail
- /worker/my-jobs — Applied jobs (applications table)
- /worker/profile — Profile + sign out

### Hirer Flow
1. /login → Google OAuth
2. /auth-redirect → checks role
3. New user → /onboarding → selects "I'm hiring"
   → inserts into Supabase users table { id: user.id, role: 'hirer' }
   → redirects to /hirer
4. Returning hirer → /hirer directly

### Hirer Screens
- /hirer — Dashboard: stats + list of posted jobs + applicants
- /hirer/post — Post new job site form (multi-step)

### Profile Setup Gate (To Be Built)
After role selection, BOTH worker and hirer must complete a profile
before accessing their dashboard:

Worker profile required fields:
- Full name
- Phone number
- Skills (multi-select: Mason, Electrician, Plumber, Carpenter,
  Steel Fixer, Heavy Lifting, General Labour, Welder, Painter)
- Years of experience
- Expected hourly rate (₹/hr)
- Availability toggle

Hirer profile required fields:
- Full name
- Company/contractor name
- Phone number
- GST number (optional)
- City/area of operations

Profile setup flow:
/onboarding (role select)
  → /worker/profile-setup OR /hirer/profile-setup
  → on completion: set profileComplete: true in Clerk unsafeMetadata
  → redirect to dashboard

ProtectedRoute must check BOTH:
  1. isSignedIn (Clerk)
  2. user.unsafeMetadata.profileComplete === true
If profileComplete is false → redirect to profile setup, not login.

---

## Database Schema

### users
- id: TEXT (PK) ← Clerk user.id format: user_xxx
- role: text CHECK ('worker' | 'hirer')
- name: text
- phone: text UNIQUE
- avatar_url: text
- created_at: timestamptz

### worker_profiles
- id: TEXT (PK, FK → users.id)
- skills: text[]
- hourly_rate: numeric
- experience_years: int
- is_available: boolean DEFAULT true
- rating: numeric DEFAULT 0

### job_postings
- id: uuid (PK) DEFAULT gen_random_uuid() ← auto-generated, NOT Clerk id
- hirer_id: TEXT (FK → users.id) ← Clerk id
- title: text NOT NULL
- description: text
- location: geography(Point, 4326)
- address: text
- hourly_rate: numeric
- is_fixed_rate: boolean
- fixed_rate: numeric
- personnel_count: int
- daily_hours: numeric
- start_date: date
- shift_start: time
- is_urgent: boolean
- status: text CHECK ('active' | 'filled' | 'closed')
- created_at: timestamptz

### applications
- id: uuid (PK) DEFAULT gen_random_uuid()
- worker_id: TEXT (FK → users.id) ← Clerk id
- job_id: uuid (FK → job_postings.id)
- status: text CHECK ('pending' | 'accepted' | 'rejected')
- created_at: timestamptz

---

## PostGIS Location Format
Always insert location as WKT string:
  location: `POINT(${longitude} ${latitude})`
Note: longitude comes FIRST in PostGIS POINT format.

Parse location from Supabase response (comes back as GeoJSON):
  // In lib/geo.ts
  export function parseLocation(loc: any): { lat: number; lng: number } | null {
    if (!loc) return null
    if (loc.type === 'Point') return { lng: loc.coordinates[0], lat: loc.coordinates[1] }
    if (typeof loc === 'string') {
      const match = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/)
      if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
    }
    return null
  }

Distance query (PostGIS, within 50km of reference point):
  SELECT *, ST_Distance(location, ST_Point(77.1025, 28.7075)::geography) as dist_meters
  FROM job_postings
  WHERE status = 'active'
  AND ST_DWithin(location, ST_Point(77.1025, 28.7075)::geography, 50000)
  ORDER BY dist_meters ASC

---

## Reference Point
Rohini, Delhi: lat 28.7075, lng 77.1025
Used as default location until real geolocation is implemented.

---

## Supabase Queries — Common Patterns

### Fetch active jobs with hirer info
  supabase.from('job_postings')
    .select('*, hirer:users!hirer_id(name, avatar_url)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

### Fetch hirer's own jobs
  supabase.from('job_postings')
    .select('*')
    .eq('hirer_id', user.id)
    .order('created_at', { ascending: false })

### Fetch applications for a job with worker info
  supabase.from('applications')
    .select('*, worker:users!worker_id(name, phone, avatar_url)')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

### Worker applies for job
  supabase.from('applications')
    .insert({ worker_id: user.id, job_id: jobId, status: 'pending' })

### Check if worker already applied
  supabase.from('applications')
    .select('id')
    .eq('worker_id', user.id)
    .eq('job_id', jobId)
    .single()

### Worker's applied jobs
  supabase.from('applications')
    .select('*, job:job_postings(*)')
    .eq('worker_id', user.id)
    .order('created_at', { ascending: false })

---

## Error Patterns & Fixes

### "invalid input syntax for type uuid"
CAUSE: Trying to insert Clerk user id (user_xxx) into a uuid column.
FIX: All user-related id columns are TEXT. Check schema. Never cast user.id.

### "relation does not exist"
CAUSE: Tables not created in Supabase.
FIX: Run schema.sql in Supabase SQL Editor.

### "Failed to fetch" on Clerk
CAUSE: Service worker intercepting requests.
FIX: Service worker is disabled. Unregister in index.html.

### "is invalid" on Google OAuth
CAUSE: Redirect URLs not set in Clerk dashboard or Google not enabled.
FIX: Clerk Dashboard → Configure → Paths → set after sign-in/up to /auth-redirect.
     Clerk Dashboard → Configure → Social Connections → enable Google.

### Foreign key constraint error on ALTER TABLE
CAUSE: Trying to change column type with FK constraints active.
FIX: Drop FK constraints first, alter types, then re-add FKs.
See: schema.sql comments for the correct ALTER sequence.

### Empty data from Supabase (no error)
CAUSE: Row Level Security (RLS) blocking anonymous reads.
FIX (dev): Disable RLS or add permissive policies.
FIX (prod): Add proper RLS policies — see schema.sql.

---

## Component Architecture

### Route Protection
ProtectedRoute checks:
1. useAuth().isSignedIn — redirect to /login if false
2. user.unsafeMetadata.profileComplete — redirect to profile setup if false
Shows lime spinner while Clerk loads.

### Worker Layout
WorkerLayout.tsx wraps all /worker/* routes.
Desktop: left sidebar nav (72px wide, black, lime active state).
Mobile: bottom tab bar (Feed / Map / My Jobs / Profile).
Breakpoint: md: (768px).

### Job Cards
GigCardStandard — white bg, for normal jobs.
GigCardUrgent — #1A1A1A bg, lime accents, for urgent jobs.
Both accept: job, distance (optional), onRequestJob callback.

### WorkerJobsContext
Shared context for MapScreen and JobDetailScreen.
Fetches once, shared across both screens.
Do not refetch in individual screens if context is available.

---

## What's Working (Do Not Break)
- Google OAuth login flow (Clerk)
- Role-based onboarding
- Protected routes with auth guards
- Live job feed from Supabase
- Map view with pins and job detail panel
- Job detail page with dynamic fetch
- Responsive desktop layout (sidebar + 2-col grid)
- Sign out from Profile and Hirer Dashboard

## What's Pending (Build in This Order)
1. Profile setup screens (worker + hirer) — with profile gate in ProtectedRoute
2. Worker: Apply for job → Request Job button → insert into applications
3. Worker: My Jobs screen — list applications with status badges
4. Hirer: Post Job submit handler — insert into job_postings
5. Hirer: Dashboard with stats + job list + applicants panel
6. Feed: Functional filter chips (ALL / NEARBY / TODAY / ₹/HR)
7. Map: Real map tiles (Google Maps or Leaflet)
8. Worker: Profile edit screen
9. Notifications (Supabase Realtime)
10. Deploy to Vercel

---

## Uber/Promptly-Style UX Patterns to Follow

### Request Flow (like Uber ride request)
Worker taps REQUEST JOB →
  1. Check if already applied (show "Already Applied" if so)
  2. Show confirmation bottom sheet:
     - Job title, company, rate, start date
     - "CONFIRM REQUEST" (lime) + "CANCEL" (dark)
  3. On confirm: insert into applications table
  4. Show success state on button: "REQUEST SENT ✓"
  5. Button stays disabled (can't apply twice)

### Status Updates (like food delivery tracking)
Applications have clear status progression:
PENDING → ACCEPTED → (job starts) → COMPLETED
         → REJECTED

Show status with colour-coded badges:
- PENDING: yellow/amber bg, dark text
- ACCEPTED: lime bg, black text
- REJECTED: dark bg, red text
- COMPLETED: gray bg, white text

### Error Handling (like Promptly)
Every async operation must have 3 states:
1. Loading: spinner in button, disabled state
2. Success: brief toast notification (2 seconds), then state update
3. Error: inline red error message + re-enable button
   Never show raw Supabase error to user.
   User-facing error: "Something went wrong. Please try again."
   Developer error: console.log(error) always

### Empty States
Every list screen needs a designed empty state:
- Icon (SVG, simple)
- Headline: "No [items] yet"
- Subtext: contextual explanation
- CTA button if relevant (e.g. "Post your first job")

---

## Session Starter (Paste at Start of Every Cursor Session)

```
We are building OCAP, a construction gig marketplace.
Stack: React 18 + Vite + TypeScript + Clerk (Google OAuth) + 
Supabase (Postgres + PostGIS) + Tailwind CSS.

CRITICAL: Supabase user id columns are type TEXT storing 
Clerk IDs (format: user_xxx). Never cast to uuid.

Reference the OCAP skill file and these files before editing:
@schema.sql @supabase.ts @App.tsx

Today's task: [DESCRIBE TASK HERE]
```
