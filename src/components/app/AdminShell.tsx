import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Newspaper,
  Activity,
  Building2,
  CreditCard,
  FileClock,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Menu,
  Settings,
  Share2,
  Siren,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { label: string; to: string; icon: LucideIcon; exact?: boolean };

const opsNav: NavItem[] = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Organizations", to: "/admin/organizations", icon: Building2 },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Social Accounts", to: "/admin/accounts", icon: Share2 },
  { label: "Automations", to: "/admin/automations", icon: Workflow },
  { label: "Messages", to: "/admin/messages", icon: MessageSquare },
  { label: "Inquiries", to: "/admin/inquiries", icon: LifeBuoy },
];

const healthNav: NavItem[] = [
  { label: "Live Alerts", to: "/admin/alerts", icon: Siren },
  { label: "Jobs & Queue", to: "/admin/jobs", icon: Gauge },
  { label: "Webhooks", to: "/admin/webhooks", icon: Webhook },
  { label: "API Health", to: "/admin/health", icon: Activity },
];

const governNav: NavItem[] = [
  { label: "Plans & Billing", to: "/admin/plans", icon: CreditCard },
  { label: "Blog & SEO", to: "/admin/blog", icon: Newspaper },
  { label: "Security & Audit", to: "/admin/audit", icon: FileClock },
  { label: "System Settings", to: "/admin/settings", icon: Settings },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-primary"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <img
          src="/logo.webp"
          alt="Techaasvik"
          className="size-9 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Operations</p>
          <p className="truncate text-xs text-subtle-foreground">Techaasvik platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
          Platform
        </p>
        <div className="space-y-1">
          {opsNav.map((i) => (
            <NavLink key={i.to} item={i} pathname={pathname} />
          ))}
        </div>
        <p className="px-3 pt-5 pb-2 text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
          Health
        </p>
        <div className="space-y-1">
          {healthNav.map((i) => (
            <NavLink key={i.to} item={i} pathname={pathname} />
          ))}
        </div>
        <p className="px-3 pt-5 pb-2 text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
          Governance
        </p>
        <div className="space-y-1">
          {governNav.map((i) => (
            <NavLink key={i.to} item={i} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="border-t p-3">
        <Button variant="outline" className="w-full justify-start gap-2" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="size-4" />
            Back to workspace
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  banner,
}: {
  children: ReactNode;
  banner?: string | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar pathname={pathname} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
            <span className="sr-only">Toggle navigation</span>
          </Button>
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
            Super admin console
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </header>
        {banner ? (
          <div className="border-b bg-warning-soft px-4 py-2 text-sm font-medium text-warning lg:px-6">
            {banner}
          </div>
        ) : null}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
