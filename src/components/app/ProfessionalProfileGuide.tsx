import { useState } from "react";
import { ChevronDown, Download, Facebook, Info, Instagram, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "1. Connect a Facebook Page",
    body: "Create a Page with your creator/brand name, connect it here with “Connect Facebook”, and link your Instagram Professional account to it. All automations then run on the Page and Instagram.",
  },
  {
    title: "2. Share your Page's m.me link",
    body: "Every Page has a direct Messenger link: m.me/YourPageUsername. Create a Facebook DM keyword rule (e.g. GUIDE), then write in your profile post caption: “Message m.me/YourPage and type GUIDE”. AutoDM replies in seconds.",
  },
  {
    title: "3. Add a Delivery Page link",
    body: "Sales & Revenue → Delivery pages → create a page with a lead form. Put its link in your profile bio, caption or pinned comment — every lead and purchase is tracked in Contacts.",
  },
];

export function ProfessionalProfileGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 rounded-lg border bg-surface-secondary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <Info className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Using a Facebook Professional / Creator profile? Here's how to automate it
          </p>
          <p className="text-xs text-muted-foreground">
            Meta only allows automation on Pages and Instagram Professional accounts — 3 easy workarounds.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Facebook className="size-4 text-facebook" />
          <Instagram className="size-4 text-instagram" />
          <Youtube className="size-4 text-youtube" />
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t px-5 py-4">
          <p className="text-sm text-muted-foreground">
            A personal profile in Professional Mode — even if monetised — cannot be connected by any
            official tool (ManyChat, AutoDM or others). This is Meta's policy. Use these instead:
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="rounded-lg border bg-background p-4">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href="/facebook-professional-profile-automation-guide.txt" download>
              <Download className="size-4" /> Download full guide (.txt)
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
