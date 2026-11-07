import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Images,
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
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PageReadyGate } from "@/components/app/PageReadyGate";
import { useSidebarGroup } from "@/hooks/useSidebarGroup";

type NavItem = { label: string; to: string; icon: LucideIcon; exact?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "Command Centre", items: [{ label: "Overview", to: "/admin", icon: LayoutDashboard, exact: true }] },
  { label: "Workspaces & Users", items: [{ label: "Workspaces", to: "/admin/organizations", icon: Building2 }, { label: "Users", to: "/admin/users", icon: Users }, { label: "Social Accounts", to: "/admin/accounts", icon: Share2 }] },
  { label: "Operations", items: [{ label: "Automations", to: "/admin/automations", icon: Workflow }, { label: "Messages", to: "/admin/messages", icon: MessageSquare }, { label: "Inquiries", to: "/admin/inquiries", icon: LifeBuoy }] },
  { label: "Monitoring & Health", items: [{ label: "Live Alerts", to: "/admin/alerts", icon: Siren }, { label: "Jobs & Queue", to: "/admin/jobs", icon: Gauge }, { label: "Webhooks", to: "/admin/webhooks", icon: Webhook }, { label: "API Health", to: "/admin/health", icon: Activity }] },
  { label: "Platform Management", items: [{ label: "Plans & Billing", to: "/admin/plans", icon: CreditCard }, { label: "Security & Audit", to: "/admin/audit", icon: FileClock }, { label: "System Settings", to: "/admin/settings", icon: Settings }, { label: "Database Backups", to: "/admin/database", icon: Database }] },
  { label: "Content", items: [{ label: "Blog & SEO", to: "/admin/blog", icon: Newspaper }, { label: "Media Library", to: "/admin/media", icon: Images }] },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.exact ? pathname.replace(/\/$/, "") === item.to : pathname.startsWith(item.to) || (item.to === "/admin/organizations" && pathname.startsWith("/admin/org/"));
  return (
    <Link
      to={item.to}
      preload="intent"
      aria-current={active ? "page" : undefined}
      className={cn(
        "dashboard-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-selected text-sidebar-primary"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { openGroup, toggleGroup } = useSidebarGroup("admin");
  const navigateTo = useNavigate();
  return (
    <div className="dashboard-sidebar flex h-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <img
          src="/logo.webp"
          alt="Techaasvik"
          className="size-9 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-bold">AutoDM</p>
          <p className="truncate text-xs text-muted-foreground">Super Admin · Operations</p>
        </div>
      </div>

      <nav aria-label="Super Admin navigation" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {navGroups.map((group, index) => {
          const expanded = openGroup === group.label;
          const GroupIcon = group.items[0]?.icon ?? LayoutDashboard;
          return <div key={group.label}><Button variant="ghost" onClick={() => { const opening = !expanded; toggleGroup(group.label); const first = group.items[0]; const inGroup = group.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)); if (opening && first && !inGroup) void navigateTo({ to: first.to as never }); }} aria-expanded={expanded} aria-controls={`admin-nav-${index}`} className="dashboard-nav-group min-h-12 h-auto w-full justify-between gap-2 whitespace-normal rounded-lg px-3 py-2 text-left text-sm font-semibold leading-5 text-sidebar-foreground"><span className="flex min-w-0 items-center gap-3"><span className="dashboard-group-icon inline-flex size-7 shrink-0 items-center justify-center rounded-md"><GroupIcon className="size-4" /></span><span>{group.label}</span></span><ChevronDown className={cn("size-4 shrink-0 transition-transform motion-reduce:transition-none", !expanded && "-rotate-90")} /></Button><div id={`admin-nav-${index}`} hidden={!expanded} className="dashboard-nav-children ml-6 mt-1 space-y-1 border-l border-sidebar-border pl-3">{group.items.map((item) => <NavLink key={item.to} item={item} pathname={pathname} />)}</div></div>;
        })}
      </nav>
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
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", close); };
  }, [mobileOpen]);
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
          <div role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 w-64 max-w-[85vw]">
            <Sidebar pathname={pathname} />
          </div>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">
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
        <main className="app-content min-w-0 p-3 sm:p-4 lg:p-6">
          <PageReadyGate>{children}</PageReadyGate>
        </main>
      </div>
    </div>
  );
}
