import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { SeoTracking } from "@/lib/site-settings.server";

const CONSENT_KEY = "autodm_cookie_consent";
const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/inbox", "/automations", "/settings", "/billing", "/social-accounts", "/create-post", "/calendar", "/analytics", "/ai-assistant", "/team", "/usage", "/contacts", "/comments", "/account-health", "/invite"];

function addScript(src: string, attrs: Record<string, string> = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

function load(t: SeoTracking) {
  const w = window as unknown as Record<string, any>;
  if (t.gtmId) {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${t.gtmId}`);
  }
  if (t.ga4Id) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () { w.dataLayer.push(arguments); };
    w.gtag("js", new Date());
    w.gtag("config", t.ga4Id);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${t.ga4Id}`);
  }
  if (t.adsenseId) addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${t.adsenseId}`, { crossorigin: "anonymous" });
  if (t.metaPixelId && !w.fbq) {
    const fbq: any = function (...a: unknown[]) { fbq.callMethod ? fbq.callMethod(...a) : fbq.queue.push(a); };
    fbq.queue = []; fbq.loaded = true; fbq.version = "2.0"; w.fbq = fbq; w._fbq = fbq;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", t.metaPixelId);
    fbq("track", "PageView");
  }
}

/** Loads analytics/ads only on public pages, after consent when required. */
export function TrackingScripts({ tracking }: { tracking: SeoTracking }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = !PRIVATE_PREFIXES.some((p) => path.startsWith(p));
  const any = Boolean(tracking.ga4Id || tracking.gtmId || tracking.adsenseId || tracking.metaPixelId);
  const [consent, setConsent] = useState<string | null>("pending");
  useEffect(() => setConsent(localStorage.getItem(CONSENT_KEY)), []);

  useEffect(() => {
    if (!any || !isPublic) return;
    if (!tracking.requireConsent || consent === "yes") load(tracking);
  }, [any, isPublic, consent, tracking]);

  if (!any || !isPublic || !tracking.requireConsent || consent !== null) return null;
  const choose = (v: string) => { localStorage.setItem(CONSENT_KEY, v); setConsent(v); };
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-lg">
      <p className="min-w-0 flex-1">We use cookies for analytics and ads to improve AutoDM. <a href="/privacy" className="underline">Privacy</a></p>
      <Button size="sm" variant="outline" onClick={() => choose("no")}>Decline</Button>
      <Button size="sm" onClick={() => choose("yes")}>Accept</Button>
    </div>
  );
}
