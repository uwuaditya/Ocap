import { SignUp } from "@clerk/clerk-react"

export function SignUpScreen() {
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
          letterSpacing: "2px",
          marginBottom: "48px",
          textTransform: "uppercase",
        }}
      >
        Create your account
      </p>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/login"
        fallbackRedirectUrl="/auth-redirect"
      />
    </div>
  )
}
