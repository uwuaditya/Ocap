import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Link } from "react-router-dom"
import { useClerk, useUser } from "@clerk/clerk-react"
import { supabase } from "../../lib/supabase"
import { isAtLeastAge } from "../../lib/age"
import type { UserRow, WorkerProfileRow } from "../../types/user"

type FieldErrors = {
  name?: string
  phone?: string
  dob?: string
  injuries?: string
  skills?: string
  hourly_rate?: string
  experience_years?: string
}

function parseSkills(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  )
}

export function ProfileScreen() {
  const { signOut } = useClerk()
  const { user, isLoaded } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRow, setUserRow] = useState<UserRow | null>(null)
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileRow | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [dob, setDob] = useState("")
  const [noPhysicalInjuries, setNoPhysicalInjuries] = useState(false)
  const [skillsText, setSkillsText] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [experienceYears, setExperienceYears] = useState("")
  const [bio, setBio] = useState("")
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const reloadProfile = useCallback(async () => {
    if (!user) return
    const { data: u, error: uErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    console.log("[ProfileScreen] reload users:", { data: u, error: uErr })

    if (uErr || !u) return
    setUserRow(u as UserRow)

    if (u.role === "worker") {
      const { data: p, error: pErr } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      console.log("[ProfileScreen] reload worker_profiles:", {
        data: p,
        error: pErr,
      })

      if (!pErr && p) setWorkerProfile(p as WorkerProfileRow)
      else setWorkerProfile(null)
    }
  }, [user])

  useEffect(() => {
    if (!isLoaded || !user) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void (async () => {
      const { data: u, error: uErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single()

      console.log("[ProfileScreen] Supabase users:", {
        data: u,
        error: uErr,
        userId: user.id,
      })

      if (cancelled) return
      if (uErr || !u) {
        setLoadError(uErr?.message ?? "Could not load profile")
        setLoading(false)
        return
      }

      const ur = u as UserRow
      setUserRow(ur)

      let wp: WorkerProfileRow | null = null
      if (ur.role === "worker") {
        const { data: p, error: pErr } = await supabase
          .from("worker_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

        console.log("[ProfileScreen] Supabase worker_profiles:", {
          data: p,
          error: pErr,
        })

        if (!pErr && p) wp = p as WorkerProfileRow
        setWorkerProfile(wp)

        setName(ur.name ?? "")
        setPhone(ur.phone ?? "")
        setDob(wp?.date_of_birth ?? "")
        setNoPhysicalInjuries(wp?.no_physical_injuries === true)
        setSkillsText(wp?.skills?.length ? wp.skills.join(", ") : "")
        setHourlyRate(
          wp?.hourly_rate != null ? String(wp.hourly_rate) : "",
        )
        setExperienceYears(
          wp?.experience_years != null ? String(wp.experience_years) : "",
        )
        setBio(wp?.bio ?? "")
        setEmergencyName(wp?.emergency_contact_name ?? "")
        setEmergencyPhone(wp?.emergency_contact_phone ?? "")
      }

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, user])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !user) return
    setPhotoError(null)
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be 5MB or smaller.")
      return
    }

    setPhotoBusy(true)
    try {
      await user.setProfileImage({ file })
      await user.reload()
      const url = user.imageUrl
      const { error: upErr } = await supabase
        .from("users")
        .update({ avatar_url: url })
        .eq("id", user.id)

      console.log("[ProfileScreen] avatar sync:", { url, error: upErr })

      if (upErr) {
        setPhotoError(upErr.message)
      } else {
        setUserRow((prev) =>
          prev ? { ...prev, avatar_url: url ?? prev.avatar_url } : prev,
        )
      }
    } catch (err: unknown) {
      setPhotoError((err as Error)?.message ?? "Could not update photo")
    } finally {
      setPhotoBusy(false)
    }
  }

  function validateWorker(): boolean {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Name is required"
    if (!phone.trim()) next.phone = "Phone is required"
    if (!dob.trim()) {
      next.dob = "Date of birth is required"
    } else if (!isAtLeastAge(dob, 18)) {
      next.dob = "You must be at least 18 years old"
    }
    if (!noPhysicalInjuries) {
      next.injuries =
        "You must confirm you have no physical injuries that prevent site work"
    }
    if (hourlyRate.trim()) {
      const n = Number(hourlyRate)
      if (Number.isNaN(n) || n < 0) {
        next.hourly_rate = "Enter a valid hourly rate"
      }
    }
    if (experienceYears.trim()) {
      const y = parseInt(experienceYears, 10)
      if (Number.isNaN(y) || y < 0 || y > 80) {
        next.experience_years = "Enter years 0–80"
      }
    }
    const skillList = parseSkills(skillsText)
    if (skillList.length === 0) {
      next.skills = "Add at least one skill"
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSaveWorker() {
    const u = user
    if (!u || !userRow || userRow.role !== "worker") return
    setSaveError(null)
    setSaveOk(false)
    if (!validateWorker()) return

    setSaveBusy(true)

    const skillList = parseSkills(skillsText)
    const userPatch = {
      name: name.trim(),
      phone: phone.trim(),
      avatar_url: u.imageUrl ?? userRow.avatar_url,
    }

    const { error: uErr } = await supabase
      .from("users")
      .update(userPatch)
      .eq("id", u.id)

    console.log("[ProfileScreen] save users:", { error: uErr, userPatch })

    if (uErr) {
      if (uErr.code === "23505") {
        setSaveError("This phone number is already in use.")
      } else {
        setSaveError(uErr.message)
      }
      setSaveBusy(false)
      return
    }

    const profilePayload = {
      id: u.id,
      skills: skillList,
      hourly_rate: hourlyRate.trim() ? Number(hourlyRate) : null,
      experience_years: experienceYears.trim()
        ? parseInt(experienceYears, 10)
        : null,
      is_available: workerProfile?.is_available ?? true,
      rating: workerProfile?.rating ?? 0,
      date_of_birth: dob,
      no_physical_injuries: true,
      bio: bio.trim() || null,
      emergency_contact_name: emergencyName.trim() || null,
      emergency_contact_phone: emergencyPhone.trim() || null,
    }

    const { error: pErr } = await supabase
      .from("worker_profiles")
      .upsert(profilePayload, { onConflict: "id" })

    console.log("[ProfileScreen] save worker_profiles:", {
      error: pErr,
      profilePayload,
    })

    if (pErr) {
      setSaveError(pErr.message)
      setSaveBusy(false)
      return
    }

    await reloadProfile()
    setSaveOk(true)
    setSaveBusy(false)
    window.setTimeout(() => setSaveOk(false), 4000)
  }

  const avatarSrc = user?.imageUrl ?? userRow?.avatar_url ?? null

  return (
    <div className="flex min-h-screen flex-col bg-ocap-feed-page px-ocap-x pb-6 pt-6 [color-scheme:light]">
      <h1 className="text-ocap-title font-black uppercase text-ocap-black">
        Profile
      </h1>
      {user && (
        <p className="text-ocap-meta mt-3 uppercase text-ocap-feed-meta">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      )}

      {loading ? (
        <p className="text-ocap-meta mt-6 uppercase text-ocap-feed-meta">
          Loading…
        </p>
      ) : null}
      {loadError ? (
        <p className="text-ocap-meta mt-6 font-semibold uppercase text-red-600">
          {loadError}
        </p>
      ) : null}

      {!loading && userRow?.role === "hirer" ? (
        <div className="mt-6 space-y-4 border-t border-black/10 pt-4">
          <p className="text-ocap-meta uppercase text-ocap-feed-meta">
            You’re signed in as a <strong>hirer</strong>. Manage your company
            profile on the hirer app.
          </p>
          <Link
            to="/hirer/profile"
            className="inline-block bg-ocap-lime-feed px-4 py-3 text-ocap-btn uppercase text-ocap-black"
          >
            Hirer profile
          </Link>
        </div>
      ) : null}

      {!loading && userRow?.role === "worker" ? (
        <div className="mt-6 space-y-5 border-t border-black/10 pt-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-black/10 bg-zinc-200">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ocap-meta uppercase text-ocap-feed-meta">
                  Photo
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePhotoChange(e)}
              />
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-ocap-black bg-ocap-lime-feed px-4 py-2 text-ocap-nav font-extrabold uppercase text-ocap-black disabled:opacity-50"
              >
                {photoBusy ? "Uploading…" : "Change profile photo"}
              </button>
              <p className="text-ocap-sub max-w-xs text-ocap-feed-meta">
                Uses your OCAP account (Clerk). Synced to our database for job
                cards.
              </p>
              {photoError ? (
                <p className="text-[12px] font-semibold text-red-600">
                  {photoError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 text-ocap-post-input font-semibold outline-none"
            />
            {fieldErrors.name ? (
              <p className="text-[12px] font-semibold text-red-600">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Phone</FieldLabel>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 text-ocap-post-input font-semibold outline-none"
            />
            {fieldErrors.phone ? (
              <p className="text-[12px] font-semibold text-red-600">
                {fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Date of birth</FieldLabel>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 text-ocap-post-input font-semibold outline-none"
            />
            {fieldErrors.dob ? (
              <p className="text-[12px] font-semibold text-red-600">
                {fieldErrors.dob}
              </p>
            ) : (
              <p className="text-ocap-sub text-ocap-feed-meta">
                You must be 18 or older to use OCAP as a worker.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer gap-3 rounded-ocap-post border border-black/10 bg-ocap-feed-card p-ocap-card">
            <input
              type="checkbox"
              checked={noPhysicalInjuries}
              onChange={(e) => setNoPhysicalInjuries(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-ocap-lime-feed"
            />
            <span className="text-[14px] font-semibold leading-snug text-ocap-black">
              I confirm that I have{" "}
              <strong>no physical injuries or medical conditions</strong> that
              prevent me from performing construction or site labor safely.
            </span>
          </label>
          {fieldErrors.injuries ? (
            <p className="text-[12px] font-semibold text-red-600">
              {fieldErrors.injuries}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <FieldLabel required>Skills (comma-separated)</FieldLabel>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              rows={3}
              className="ocap-post-native-input w-full resize-none rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 text-[14px] outline-none"
              placeholder="Mason, tiling, scaffolding…"
            />
            {fieldErrors.skills ? (
              <p className="text-[12px] font-semibold text-red-600">
                {fieldErrors.skills}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Expected hourly rate (₹)</FieldLabel>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {fieldErrors.hourly_rate ? (
                <p className="text-[12px] font-semibold text-red-600">
                  {fieldErrors.hourly_rate}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Years of experience</FieldLabel>
              <input
                type="number"
                min={0}
                max={80}
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {fieldErrors.experience_years ? (
                <p className="text-[12px] font-semibold text-red-600">
                  {fieldErrors.experience_years}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>About you (optional)</FieldLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="ocap-post-native-input w-full resize-none rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 text-[14px] outline-none"
              placeholder="Brief intro for hirers…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Emergency contact name (optional)</FieldLabel>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 font-semibold outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Emergency contact phone (optional)</FieldLabel>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="ocap-post-native-input w-full rounded-ocap-post border border-black/10 bg-ocap-feed-card px-3 py-3 font-semibold outline-none"
              />
            </div>
          </div>

          {saveError ? (
            <p className="text-[13px] font-semibold text-red-600">{saveError}</p>
          ) : null}
          {saveOk ? (
            <p className="text-[13px] font-bold uppercase text-green-700">
              Profile saved
            </p>
          ) : null}

          <button
            type="button"
            disabled={saveBusy}
            onClick={() => void handleSaveWorker()}
            className="w-full bg-ocap-lime-feed py-4 text-ocap-btn uppercase text-ocap-black shadow-ocap-post-btn disabled:opacity-50"
          >
            {saveBusy ? "Saving…" : "Save profile"}
          </button>
        </div>
      ) : null}

      {!loading && !userRow ? (
        <p className="text-ocap-meta mt-6 uppercase text-ocap-feed-meta">
          No saved profile yet. Complete onboarding from the sign-in flow.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/login" })}
        className="mt-10 w-full border border-red-300 bg-red-50 py-3 text-center text-ocap-btn uppercase text-red-600"
      >
        Sign out
      </button>
    </div>
  )
}
