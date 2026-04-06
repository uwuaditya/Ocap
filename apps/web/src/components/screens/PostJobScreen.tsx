// NOTE: Run these in Supabase SQL Editor if queries return empty:
// ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "hirers read own jobs" ON job_postings
//   FOR SELECT USING (hirer_id = auth.uid()::text);
// CREATE POLICY "hirers read own applications" ON applications
//   FOR SELECT USING (
//     job_id IN (
//       SELECT id FROM job_postings WHERE hirer_id = auth.uid()::text
//     )
//   );
//
// For now use the anon key which bypasses RLS in development.
// The queries will work with anon key as long as RLS is not enabled on these tables yet.

import { useCallback, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../lib/supabase"
import { PostJobMapPicker } from "../PostJobMapPicker"

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
      fill="currentColor"
    />
  </svg>
)

const GroupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
      fill="currentColor"
    />
  </svg>
)

const TimerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8-7h-1.18C16.4 4.85 14.32 4 12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8c0-1.57-.46-3.03-1.24-4.26L20 8h-1zm-9 0c0 3.31 2.69 6 6 6s6-2.69 6-6-2.69-6-6-6-6 2.69-6 6z"
      fill="currentColor"
    />
  </svg>
)

const CalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"
      fill="currentColor"
    />
  </svg>
)

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
      fill="currentColor"
    />
  </svg>
)

const SaveIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z"
      fill="currentColor"
    />
  </svg>
)

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

function FieldRow({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </div>
      {children}
      {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
    </div>
  )
}

function InputBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-ocap-post bg-ocap-post-input px-3 py-3 text-ocap-black">
      {children}
    </div>
  )
}

type FieldErrors = {
  category?: string
  personnelCount?: string
  location?: string
}

/** Trades / roles for the job-site dropdown (stored as part of `title`). */
const JOB_TRADES = [
  "Mason",
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "Welder",
  "HVAC technician",
  "Heavy equipment operator",
  "General labor",
  "Supervisor / foreman",
  "Other",
] as const

const initialForm = {
  category: "",
  title: "",
  personnelCount: "1",
  dailyHours: "8",
  hourlyRate: "450",
  fixedRate: "",
  isFixedRate: false,
  startDate: "",
  shiftStart: "",
  lat: "",
  lng: "",
  address: "",
  operationalBriefing: "",
  isUrgent: false,
}

export function PostJobScreen() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [formState, setFormState] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setFormState((s) => ({ ...s, [key]: value }))
  }

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!formState.category.trim()) {
      next.category = "Select a job category"
    }
    const pc = Number(formState.personnelCount)
    if (!formState.personnelCount.trim() || Number.isNaN(pc) || pc < 1) {
      next.personnelCount = "Enter a positive number of workers"
    }
    const lat = parseFloat(formState.lat)
    const lng = parseFloat(formState.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      next.location = "Place a pin on the map or enter valid coordinates"
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const onMapPick = useCallback((lat: number, lng: number) => {
    setFormState((s) => ({
      ...s,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }))
    setFieldErrors((e) => ({ ...e, location: undefined }))
  }, [])

  async function handleSubmit() {
    setSubmitError(null)
    if (!validate()) return
    if (!user) {
      setSubmitError("You must be signed in")
      return
    }

    const lat = parseFloat(formState.lat)
    const lng = parseFloat(formState.lng)
    const pc = Number(formState.personnelCount)
    const daily = formState.dailyHours.trim()
      ? Number(formState.dailyHours)
      : null

    if (formState.isFixedRate) {
      const fr = Number(formState.fixedRate)
      if (formState.fixedRate.trim() === "" || Number.isNaN(fr) || fr < 0) {
        setSubmitError("Enter a valid fixed rate")
        return
      }
    } else {
      const hr = Number(formState.hourlyRate)
      if (formState.hourlyRate.trim() === "" || Number.isNaN(hr) || hr < 0) {
        setSubmitError("Enter a valid hourly rate")
        return
      }
    }

    const titleBase = formState.category.trim()
    const titleExtra = formState.title.trim()
    const composedTitle = titleExtra
      ? `${titleBase} — ${titleExtra}`
      : titleBase

    const insertRow = {
      hirer_id: user.id,
      title: composedTitle,
      description: formState.operationalBriefing.trim() || null,
      location:
        formState.lat && formState.lng
          ? `POINT(${lng} ${lat})`
          : null,
      address: formState.address.trim() || null,
      hourly_rate: formState.isFixedRate ? null : Number(formState.hourlyRate),
      is_fixed_rate: formState.isFixedRate || false,
      fixed_rate: formState.isFixedRate ? Number(formState.fixedRate) : null,
      personnel_count: pc,
      daily_hours: daily,
      start_date: formState.startDate || null,
      shift_start: formState.shiftStart || null,
      is_urgent: formState.isUrgent || false,
      status: "active" as const,
    }

    setSubmitting(true)

    const { data, error } = await supabase
      .from("job_postings")
      .insert(insertRow)
      .select()

    console.log("[PostJob] Supabase insert response:", { data, error, payload: insertRow })

    if (error) {
      console.log("[PostJob] Full insert error object:", error)
      setSubmitError(error.message)
      setSubmitting(false)
      return
    }

    setShowSuccessToast(true)
    setSubmitting(false)
    window.setTimeout(() => {
      navigate("/hirer", { replace: true })
    }, 1500)
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-ocap-post-page pb-36 md:items-center [color-scheme:light]"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {showSuccessToast ? (
        <div
          className="fixed inset-x-0 top-0 z-[100] bg-ocap-lime-post py-3 text-center text-ocap-btn uppercase text-ocap-black shadow-md"
          role="status"
        >
          Job site posted successfully!
        </div>
      ) : null}

      <div className="w-full md:max-w-[600px]">
        <header className="flex items-center justify-between px-ocap-x pt-4">
          <button
            type="button"
            className="text-ocap-black"
            aria-label="Close"
            onClick={() => navigate("/hirer")}
          >
            <CloseIcon />
          </button>
          <span className="text-[18px] font-black uppercase tracking-tight text-ocap-black">
            OCAP
          </span>
          <div
            className="h-10 w-10 shrink-0 rounded-ocap-post bg-zinc-300"
            aria-label="Profile"
          />
        </header>

        <div className="mt-4 px-ocap-x">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            <span>Phase 01</span>
            <span>Step 1 of 3</span>
          </div>
          <div className="mt-2 h-2 w-full bg-ocap-post-track">
            <div className="h-full w-1/3 bg-ocap-lime-post" />
          </div>
        </div>

        <div className="mt-ocap-section px-ocap-x">
          <h1 className="text-ocap-title font-black uppercase text-ocap-black">
            Post new job site
          </h1>
          <p className="text-ocap-label mt-2 max-w-[340px] uppercase text-neutral-600">
            Industrial deployment &amp; manpower request
          </p>
        </div>

        <div className="mt-ocap-section flex flex-col gap-ocap-section px-ocap-x">
          <FieldRow label="Job category" error={fieldErrors.category}>
            <InputBox>
              <select
                value={formState.category}
                onChange={(e) => update("category", e.target.value)}
                className="ocap-native-select flex-1 cursor-pointer bg-transparent text-ocap-post-input font-extrabold uppercase outline-none"
              >
                <option value="">Select trade / role</option>
                {JOB_TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </InputBox>
          </FieldRow>

          <FieldRow label="Job title / site details (optional)">
            <InputBox>
              <input
                type="text"
                value={formState.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Rohini Site, Block C"
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-extrabold uppercase outline-none placeholder:font-semibold placeholder:normal-case placeholder:text-neutral-500"
              />
            </InputBox>
          </FieldRow>

          <FieldRow label="Site address (optional)">
            <InputBox>
              <input
                type="text"
                value={formState.address}
                onChange={(e) => update("address", e.target.value)}
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-semibold outline-none placeholder:text-neutral-500"
                placeholder="Street, area, city"
              />
            </InputBox>
          </FieldRow>

          <FieldRow label="Personnel count" error={fieldErrors.personnelCount}>
            <InputBox>
              <GroupIcon />
              <input
                type="number"
                min={1}
                value={formState.personnelCount}
                onChange={(e) => update("personnelCount", e.target.value)}
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-extrabold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </InputBox>
          </FieldRow>

          <FieldRow label="Daily duration (hrs)">
            <InputBox>
              <TimerIcon />
              <input
                type="number"
                min={1}
                max={24}
                value={formState.dailyHours}
                onChange={(e) => update("dailyHours", e.target.value)}
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-extrabold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </InputBox>
          </FieldRow>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={formState.isFixedRate}
              onChange={(e) => update("isFixedRate", e.target.checked)}
              className="h-5 w-5 accent-ocap-lime-post"
            />
            <span className="text-[14px] font-semibold text-ocap-black">
              Fixed rate (total job) instead of hourly
            </span>
          </label>

          {formState.isFixedRate ? (
            <div className="rounded-ocap-post bg-ocap-post-wage px-ocap-card py-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ocap-white">
                Fixed rate (total)
              </div>
              <div className="mt-2 flex items-center justify-center gap-1">
                <span className="text-ocap-wage text-ocap-lime-post">₹</span>
                <input
                  type="number"
                  min={0}
                  value={formState.fixedRate}
                  onChange={(e) => update("fixedRate", e.target.value)}
                  className="w-32 bg-transparent text-center text-ocap-wage text-ocap-lime-post outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-ocap-post bg-ocap-post-wage px-ocap-card py-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ocap-white">
                Proposed wage per hour
              </div>
              <div className="mt-2 flex items-center justify-center gap-1">
                <span className="text-ocap-wage text-ocap-lime-post">₹</span>
                <input
                  type="number"
                  min={0}
                  value={formState.hourlyRate}
                  onChange={(e) => update("hourlyRate", e.target.value)}
                  className="w-28 bg-transparent text-center text-ocap-wage text-ocap-lime-post outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="text-ocap-sub mt-3 uppercase text-ocap-white">
                Standard site rates apply
              </div>
            </div>
          )}

          <FieldRow label="Commencement date">
            <InputBox>
              <CalIcon />
              <input
                type="date"
                value={formState.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-semibold outline-none"
              />
            </InputBox>
          </FieldRow>

          <FieldRow label="Shift start time">
            <InputBox>
              <ClockIcon />
              <input
                type="time"
                value={formState.shiftStart}
                onChange={(e) => update("shiftStart", e.target.value)}
                className="ocap-post-native-input flex-1 bg-transparent text-ocap-post-input font-semibold outline-none"
              />
            </InputBox>
          </FieldRow>

          <FieldRow label="Site geo-location" error={fieldErrors.location}>
            <div className="space-y-2">
              <PostJobMapPicker
                latStr={formState.lat}
                lngStr={formState.lng}
                onPick={onMapPick}
              />
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5 rounded-ocap-post border border-black/10 bg-white px-2 py-2">
                  <span className="text-[10px] font-bold uppercase text-neutral-600">
                    Lat
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={formState.lat}
                    onChange={(e) => update("lat", e.target.value)}
                    className="ocap-post-native-input w-full bg-transparent text-[13px] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex flex-1 items-center gap-1.5 rounded-ocap-post border border-black/10 bg-white px-2 py-2">
                  <span className="text-[10px] font-bold uppercase text-neutral-600">
                    Lng
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={formState.lng}
                    onChange={(e) => update("lng", e.target.value)}
                    className="ocap-post-native-input w-full bg-transparent text-[13px] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </FieldRow>

          <FieldRow label="Mark as urgent">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={formState.isUrgent}
                onChange={(e) => update("isUrgent", e.target.checked)}
                className="h-5 w-5 accent-ocap-lime-post"
              />
              <span className="text-[14px] font-semibold text-ocap-black">
                This is an urgent requirement
              </span>
            </label>
          </FieldRow>

          <FieldRow label="Operational briefing (optional)">
            <textarea
              value={formState.operationalBriefing}
              onChange={(e) => update("operationalBriefing", e.target.value)}
              placeholder="Mention safety gear required, specific tools, or site access codes…"
              rows={4}
              className="ocap-post-native-input w-full resize-none rounded-ocap-post bg-ocap-post-input px-3 py-3 text-[14px] leading-relaxed outline-none placeholder:text-neutral-500"
            />
          </FieldRow>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex flex-col items-center bg-ocap-post-page px-ocap-x py-4">
        <div className="w-full md:max-w-[600px]">
          {submitError ? (
            <p className="mb-3 text-center text-[13px] font-semibold text-red-600">
              {submitError}
            </p>
          ) : null}
          <div className="flex w-full gap-2">
            <button
              type="button"
              disabled={submitting || showSuccessToast}
              onClick={() => void handleSubmit()}
              className="flex flex-1 items-center justify-center gap-2 bg-ocap-lime-post py-4 text-ocap-btn uppercase text-ocap-black shadow-ocap-post-btn disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "POSTING..." : "Post job site"}
            </button>
            <button
              type="button"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-ocap-post bg-ocap-post-save text-ocap-black"
            >
              <SaveIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
