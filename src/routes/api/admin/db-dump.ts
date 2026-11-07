import { createFileRoute } from "@tanstack/react-router";
import { dumpRequestSchema } from "@/lib/db-dump-request";

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

        const parsed = dumpRequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Choose full, schema or data dump mode.", { status: 400 });
        const { mode } = parsed.data;
        const { data: userData, error: userError } = await sb.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const dbUrl = (process.env["DATABASE_URL"] ?? "").trim();
        if (!dbUrl) return new Response("DATABASE_URL is not set on the server.", { status: 501 });

        let spawn: typeof import("node:child_process").spawn;
        try { ({ spawn } = await import("node:child_process")); }
        catch { return new Response("pg_dump is not available on this server.", { status: 501 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: auditError } = await supabaseAdmin.from("platform_audit_log").insert({ actor_user_id: userData.user.id, action: "db_dump.download", target_type: "database", detail: { mode, stage: "requested" } } as never);
        if (auditError) return new Response("Audit unavailable. Download was not started.", { status: 503 });
        let child;
        try { child = spawn("pg_dump", ["--no-owner", "--no-privileges", "--quote-all-identifiers", ...MODES[mode], dbUrl], { stdio: ["ignore", "pipe", "pipe"] }); }
        catch { return new Response("Database dumps are unavailable on this host.", { status: 501 }); }
        child.stderr.resume();
        const started = await new Promise<boolean>((resolve) => {
          child.once("error", () => resolve(false));
          child.stdout.once("readable", () => resolve(true));
          child.once("exit", (code) => resolve(code === 0));
        });
        if (!started) return new Response("Database dump could not start. Check the hosting database connection and pg_dump installation.", { status: 500 });

        const stream = new ReadableStream({
          start(ctrl) {
            child.stdout.on("data", (c: Buffer) => ctrl.enqueue(new Uint8Array(c)));
            child.on("close", (code) => code === 0 ? ctrl.close() : ctrl.error(new Error("Database dump interrupted; discard the incomplete download.")));
            child.on("error", () => ctrl.error(new Error("Database dump interrupted.")));
          },
          cancel() { child.kill(); },
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        return new Response(stream, {
          headers: {
            "content-type": "application/sql",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
            "content-disposition": `attachment; filename="autodm-${mode}-${stamp}.sql"`,
          },
        });
      },
    },
  },
});
