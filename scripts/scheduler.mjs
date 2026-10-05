// Runs next to the web server on Railway: every 60s calls each cron job, then
// reports a heartbeat so stopped / failing / slow jobs are detectable.
const secret = process.env.CRON_SECRET;
const port = process.env.PORT || 3000;
const JOBS = [
  ["publish-due", '"attempted":0'],
  ["youtube-comments", '"replied":0'],
  ["flows", '"due":0'],
  ["revenue", '"sent":0'],
  ["nudges", '"sent":0'],
  ["team-webhooks", '"sent":0'],
  ["trust-guard", '"paused":0'],
  ["encrypt-tokens", '"sealed":0'],
];
if (!secret) {
  console.warn("[scheduler] CRON_SECRET not set — scheduled jobs will not run");
} else {
  const post = async (path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "x-cron-secret": secret, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.text() };
  };

  let running = false; // overlap guard: a slow tick never runs twice at once
  let failStreak = 0;
  const tick = async () => {
    if (running) {
      console.warn("[scheduler] previous tick still running — skipped");
      return;
    }
    running = true;
    const results = [];
    try {
      for (const [job, quiet] of JOBS) {
        const started = Date.now();
        let status = 0;
        try {
          const r = await post(`/api/public/cron/${job}`);
          status = r.status;
          if (r.status !== 200 || !r.body.includes(quiet)) console.log(`[${job}]`, r.status, r.body.slice(0, 500));
        } catch (e) {
          console.warn(`[${job}] tick failed`, e?.message ?? e);
        }
        results.push({ job, status, ms: Date.now() - started });
      }
      try {
        await post("/api/public/cron/heartbeat", { results });
        failStreak = 0;
      } catch (e) {
        failStreak += 1;
        if (failStreak >= 3) console.error("[scheduler] ALERT heartbeat failing", failStreak, e?.message ?? e);
      }
      const bad = results.filter((r) => r.status !== 200).map((r) => r.job);
      if (bad.length) console.error("[scheduler] ALERT jobs failed:", bad.join(", "));
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 20000);
  setInterval(tick, 60000);
}
