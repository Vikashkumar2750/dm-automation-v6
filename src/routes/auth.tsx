import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getMyPlatformRole } from "@/lib/admin.functions";
import { getPlatformStatus } from "@/lib/platform-status.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content:
          "Sign in to your Techaasvik workspace to manage Instagram, Facebook and YouTube conversations.",
      },
      { property: "og:title", content: "Sign in — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Access your social automation workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const fetchPlatformRole = useServerFn(getMyPlatformRole);
  const fetchStatus = useServerFn(getPlatformStatus);
  const redirectingRef = useRef(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const navigateAfterSignIn = useCallback(async () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    try {
      const role = await fetchPlatformRole();
      await navigate({
        to: role.isSuperAdmin ? "/admin" : "/dashboard",
        replace: true,
      });
    } catch {
      redirectingRef.current = false;
      setError("Signed in, but we could not verify your access. Please try again.");
    }
  }, [fetchPlatformRole, navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigateAfterSignIn();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        window.setTimeout(() => void navigateAfterSignIn(), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigateAfterSignIn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const res = await requestReset({ data: { email, origin: window.location.origin } }).catch(
        () => ({ ok: false as const, reason: "error" as const }),
      );
      if (!res.ok && res.reason === "rate_limited")
        setError("Too many reset requests for this email. Please try again later.");
      else if (!res.ok) setError("Could not send the reset link. Please try again.");
      else
        setNotice(
          "If that email has an account, a password reset link is on its way. Check your inbox.",
        );
    } else if (mode === "signup" && (await fetchStatus()).registrationBlocked) {
      setError("New registrations are closed right now. Please try again later.");
    } else if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (err) setError(err.message);
      else if (!data.session)
        setNotice("Check your email to confirm your address, then sign in.");
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else if (data.session) await navigateAfterSignIn();
    }
    setBusy(false);
  }

  async function handleGoogle() {
    setError(null);

    // The Lovable broker only works on Lovable-hosted domains. On any other
    // host (e.g. Railway / custom domain) go straight to Supabase OAuth,
    // otherwise the callback comes back with "OAuth state parameter missing".
    const isLovableHost = /(^|\.)lovable\.(app|dev)$/.test(window.location.hostname);

    if (!isLovableHost) {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (err) setError("Google sign-in failed. Please try again.");
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    await navigateAfterSignIn();
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            W
          </span>
          <span className="text-left">
            <span className="block text-sm font-bold">DM FB-IG-YT</span>
            <span className="block text-xs text-subtle-foreground">by Techaasvik</span>
          </span>
        </Link>

        <div className="panel p-6">
          <h1 className="text-xl font-semibold">
            {mode === "signin"
              ? "Sign in to your workspace"
              : mode === "signup"
                ? "Create your workspace"
                : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Welcome back. Enter your details to continue."
              : mode === "signup"
                ? "Start automating Instagram, Facebook and YouTube."
                : "Enter your email and we will send you a reset link."}
          </p>

          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={handleGoogle}
              >
                Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs text-subtle-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}


          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-sm font-medium" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1 h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
                />
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
