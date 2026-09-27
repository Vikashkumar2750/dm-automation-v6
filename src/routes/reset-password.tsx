import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Choose a new password for your Techaasvik workspace account.",
      },
      { property: "og:title", content: "Set a new password — AutoDM" },
      {
        property: "og:description",
        content: "Choose a new password for your Techaasvik workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    window.setTimeout(() => void navigate({ to: "/dashboard", replace: true }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3">
          <img src={"/logo.webp"} alt="AutoDM" className="size-10 rounded-xl object-contain" />
          <span className="text-left">
            <span className="block text-sm font-bold">AutoDM</span>
            <span className="block text-xs text-subtle-foreground">by Techaasvik</span>
          </span>
        </Link>

        <div className="panel p-6">
          <h1 className="text-xl font-semibold">Set a new password</h1>

          {done ? (
            <p className="mt-3 text-sm text-success">
              Password updated. Taking you to your workspace...
            </p>
          ) : !ready ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Open this page from the reset link in your email. If the link has expired,{" "}
              <Link to="/auth" className="font-medium text-primary">
                request a new one
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving..." : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
