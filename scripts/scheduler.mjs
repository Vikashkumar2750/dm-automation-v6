// Runs next to the web server on Railway: every 60s publishes posts whose scheduled time has passed
// and polls connected YouTube channels for new comments to auto-reply to.
const secret = process.env.CRON_SECRET;
const port = process.env.PORT || 3000;
if (!secret) {
  console.warn("[scheduler] CRON_SECRET not set — scheduled posts will not auto-publish");
} else {
  const post = async (path) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    return { status: res.status, body: await res.text() };
  };

  const tick = async () => {
    try {
      const { status, body } = await post("/api/public/cron/publish-due");
      if (status !== 200 || !body.includes('"attempted":0')) console.log("[scheduler]", status, body);
    } catch (e) {
      console.warn("[scheduler] tick failed", e?.message ?? e);
    }
    try {
      const { status, body } = await post("/api/public/cron/youtube-comments");
      if (status !== 200 || !body.includes('"replied":0')) console.log("[youtube]", status, body);
    } catch (e) {
      console.warn("[youtube] tick failed", e?.message ?? e);
    }
    try {
      const { status, body } = await post("/api/public/cron/flows");
      if (status !== 200 || !body.includes('"due":0')) console.log("[flows]", status, body);
    } catch (e) {
      console.warn("[flows] tick failed", e?.message ?? e);
    }
    try {
      const { status, body } = await post("/api/public/cron/revenue");
      if (status !== 200 || !body.includes('"sent":0')) console.log("[revenue]", status, body);
    } catch (e) {
      console.warn("[revenue] tick failed", e?.message ?? e);
    }
    try {
      const { status, body } = await post("/api/public/cron/nudges");
      if (status !== 200 || !body.includes('"sent":0')) console.log("[nudges]", status, body);
    } catch (e) {
      console.warn("[nudges] tick failed", e?.message ?? e);
    }
  };
  setTimeout(tick, 20000);
  setInterval(tick, 60000);
}
