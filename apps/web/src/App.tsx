import { Navigate, Route, Routes } from "react-router-dom"
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react"
import { LoginScreen } from "./components/screens/LoginScreen"
import { SignUpScreen } from "./components/screens/SignUpScreen"
import { AuthRedirectScreen } from "./components/screens/AuthRedirectScreen"
import { OnboardingScreen } from "./components/screens/OnboardingScreen"
import { OnboardingHirerProfileScreen } from "./components/screens/OnboardingHirerProfileScreen"
import { OnboardingWorkerProfileScreen } from "./components/screens/OnboardingWorkerProfileScreen"
import { ProtectedRoute } from "./auth/ProtectedRoute"
import { FeedScreen } from "./components/screens/FeedScreen"
import { HirerDashboardScreen } from "./components/screens/HirerDashboardScreen"
import { HirerProfileScreen } from "./components/screens/HirerProfileScreen"
import { JobDetailScreen } from "./components/screens/JobDetailScreen"
import { MapScreen } from "./components/screens/MapScreen"
import { MyJobsScreen } from "./components/screens/MyJobsScreen"
import { PostJobScreen } from "./components/screens/PostJobScreen"
import { ProfileScreen } from "./components/screens/ProfileScreen"
import { WorkerLayout } from "./worker/WorkerLayout"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login/*" element={<LoginScreen />} />
      <Route path="/sign-up/*" element={<SignUpScreen />} />
      <Route
        path="/sso-callback"
        element={<AuthenticateWithRedirectCallback />}
      />
      <Route path="/auth-redirect" element={<AuthRedirectScreen />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route
          path="/onboarding/worker"
          element={<OnboardingWorkerProfileScreen />}
        />
        <Route
          path="/onboarding/hirer"
          element={<OnboardingHirerProfileScreen />}
        />
        <Route path="/worker" element={<WorkerLayout />}>
          <Route index element={<Navigate to="feed" replace />} />
          <Route path="feed" element={<FeedScreen />} />
          <Route path="map" element={<MapScreen />} />
          <Route path="my-jobs" element={<MyJobsScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="job/:jobId" element={<JobDetailScreen />} />
        </Route>
        <Route path="/hirer" element={<HirerDashboardScreen />} />
        <Route path="/hirer/profile" element={<HirerProfileScreen />} />
        <Route path="/hirer/post" element={<PostJobScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
