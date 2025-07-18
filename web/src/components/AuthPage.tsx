import { useState } from "react";
import { AuthForm } from "./AuthForm";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>Welcome</h1>
        <p>Please sign in to continue</p>

        <AuthForm mode={mode} />

        <div className="auth-switch">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="link-btn"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="link-btn"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
