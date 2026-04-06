import { SignIn } from "@clerk/clerk-react"

export function LoginScreen() {
  console.log("[LoginScreen] rendered at", window.location.pathname)
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <h1
        style={{
          color: "#CCFF00",
          fontSize: "48px",
          fontWeight: 900,
          marginBottom: "8px",
          textTransform: "uppercase",
        }}
      >
        OCAP
      </h1>
      <p
        style={{
          color: "#888888",
          fontSize: "12px",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
          letterSpacing: "2px",
          marginBottom: "48px",
          textTransform: "uppercase",
        }}
      >
        Construction gig marketplace
      </p>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/auth-redirect"
      />
    </div>
  )
}
