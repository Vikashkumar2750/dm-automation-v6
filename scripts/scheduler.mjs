// Runs next to the web server on Railway: every 60s publishes posts whose scheduled time has passed.
const secret = process.env.CRON_SECRET;
const port = process.env.PORT || 3000;
if (!secret) {
  console.warn("[scheduler] CRON_SECRET not set — scheduled posts will not auto-publish");
} else {
  const tick = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/public/cron/publish-due`, {
        method: "POST",
        headers: { "x-cron-secret": secret },
      });
      const body = await res.text();
      if (!res.ok || !body.includes('"attempted":0')) console.log("[scheduler]", res.status, body);
    } catch (e) {
      console.warn("[scheduler] tick failed", e?.message ?? e);
    }
  };
  setTimeout(tick, 20000);
  setInterval(tick, 60000);
}
