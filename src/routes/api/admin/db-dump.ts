import { createFileRoute } from "@tanstack/react-router";

/**
 * Full pg_dump download (Super Admin only). Streams the real pg_dump binary output
 * using the server's DATABASE_URL. Requires postgresql-client in the server image.
 */
const MODES = {
  full: ["--schema=public", "--schema=auth", "--schema=storage"],
  schema: ["--schema-only", "--schema=public"],
  data: ["--data-only", "--schema=public", "--schema=auth", "--schema=storage"],
} as const;

export const Route = createFileRoute("/api/admin/db-dump")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!token || !url || !key) return new Response("Unauthorized", { status: 401 });
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: isAdmin, error } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" } as never);
        if (error || !isAdmin) return new Response("Forbidden", { status: 403 });

        const body = (await request.json().catch(() => ({}))) as { mode?: string };
        const mode = (body.mode && body.mode in MODES ? body.mode : "full") as keyof typeof MODES;
        const dbUrl = (process.env["DATABASE_URL"] ?? "").trim();
        if (!dbUrl) return new Response("DATABASE_URL is not set on the server.", { status: 501 });

        let spawn: typeof import("node:child_process").spawn;
        try { ({ spawn } = await import("node:child_process")); }
        catch { return new Response("pg_dump is not available on this server.", { status: 501 }); }

        const child = spawn("pg_dump", ["--no-owner", "--no-privileges", "--quote-all-identifiers", ...MODES[mode], dbUrl], { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (c: Buffer) => { stderr += c.toString().slice(0, 2000); });
        const started = await new Promise<boolean>((resolve) => {
          child.once("error", () => resolve(false));
          child.stdout.once("readable", () => resolve(true));
          child.once("exit", (code) => resolve(code === 0));
        });
        if (!started) return new Response(`pg_dump failed: ${stderr.replace(dbUrl, "***").slice(0, 500) || "not installed"}`, { status: 500 });

        await sb.from("platform_audit_log").insert({ action: "db_dump.download", target_type: "database", detail: { mode } } as never).then(() => null, () => null);

        const stream = new ReadableStream({
          start(ctrl) {
            child.stdout.on("data", (c: Buffer) => ctrl.enqueue(new Uint8Array(c)));
            child.on("close", () => ctrl.close());
          },
          cancel() { child.kill(); },
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        return new Response(stream, {
          headers: {
            "content-type": "application/sql",
            "content-disposition": `attachment; filename="autodm-${mode}-${stamp}.sql"`,
          },
        });
      },
    },
  },
});
