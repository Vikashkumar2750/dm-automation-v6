import { Link } from "@tanstack/react-router";

const metaPartnerBadge = { url: "/meta-business-partner.png" };

export const SUPPORT_EMAIL = "contact@techaavik.com";

export function PublicFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.webp" alt="AutoDM by Techaasvik" className="size-11 rounded-lg object-contain" />
              <div>
                <p className="font-bold text-foreground">AutoDM</p>
                <p className="text-xs text-muted-foreground">by Techaasvik</p>
              </div>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Official-platform tools for managing comments, messages, publishing, and customer conversations.
            </p>
            <img
              src={metaPartnerBadge.url}
              alt="Meta Business Partner"
              className="mt-5 h-16 w-auto object-contain"
            />
          </div>

          <FooterGroup title="Product">
            <Link to="/" hash="benefits">Benefits</Link>
            <Link to="/" hash="how-it-works">How it works</Link>
            <Link to="/" hash="pricing">Pricing</Link>
            <Link to="/auth">Sign in</Link>
          </FooterGroup>
          <FooterGroup title="Support">
            <Link to="/contact">Contact &amp; Support</Link>
          </li>
          <li>
            <Link to="/blog">Blog</Link>
            <Link to="/data-deletion">Data Deletion</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </FooterGroup>
          <FooterGroup title="Legal">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/refund-policy">Refund Policy</Link>
            <Link to="/disclaimer">Disclaimer</Link>
          </FooterGroup>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
          <p>© {new Date().getFullYear()} Techaasvik. All rights reserved.</p>
          <p className="max-w-xl sm:text-right">
            Instagram and Facebook are trademarks of Meta Platforms, Inc. YouTube is a trademark of Google LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-3 flex flex-col items-start gap-2.5 text-sm text-muted-foreground [&_a:hover]:text-foreground">
        {children}
      </div>
    </div>
  );
}