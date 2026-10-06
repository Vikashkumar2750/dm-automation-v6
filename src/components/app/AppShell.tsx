import { trialEndsAt } from "@/lib/trial";
import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStatus } from "@/lib/platform-status.functions";
import { getMyPlatformRole } from "@/lib/admin.functions";
import {
  Bell,
  Search,
  ChevronDown,
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  Inbox,
  MessageSquare,
  Workflow,
  Users,
  IndianRupee,
  Headset,
  BarChart3,
  Share2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  LineChart as GrowthIcon,
  Gauge,
  UsersRound,
  Settings,
  CreditCard,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { PageReadyGate } from "@/components/app/PageReadyGate";

type NavItem = { label: string; to: string; icon: LucideIcon; badge?: number };

const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Create Post", to: "/create-post", icon: PenSquare },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Inbox", to: "/inbox", icon: Inbox },
  { label: "Comments", to: "/comments", icon: MessageSquare },
  { label: "Automations", to: "/automations", icon: Workflow },
  { label: "Contacts", to: "/contacts", icon: Users },
  { label: "Revenue", to: "/revenue", icon: IndianRupee },
  { label: "Team desk", to: "/team-desk", icon: Headset },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Social Accounts", to: "/social-accounts", icon: Share2 },
  { label: "AI Assistant", to: "/ai-assistant", icon: Sparkles },
];

const secondaryNav: NavItem[] = [
  { label: "Account Health", to: "/account-health", icon: ShieldCheck },
  { label: "Trust & safety", to: "/trust-safety", icon: ShieldAlert },
  { label: "Growth insights", to: "/growth", icon: GrowthIcon },
  { label: "Usage & Limits", to: "/usage", icon: Gauge },
  { label: "Team", to: "/team", icon: UsersRound },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Billing", to: "/billing", icon: CreditCard },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
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
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && (
        <span className="num rounded-md bg-surface-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { activeOrg, loading } = useTenant();
  const brand = activeOrg?.brandName?.trim() || "AutoDM";
  const logo = activeOrg?.logoUrl?.trim() || "/logo.webp";
  const color = activeOrg?.brandColor?.trim() || null;

  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        {loading ? (
          <div className="flex animate-pulse items-center gap-3">
            <span className="size-9 rounded-xl bg-surface-secondary" />
            <span className="space-y-1.5">
              <span className="block h-3.5 w-24 rounded bg-surface-secondary" />
              <span className="block h-3 w-16 rounded bg-surface-secondary" />
            </span>
          </div>
        ) : (
        <>
        {logo ? (
          <img
            src={logo}
            alt={brand}
            className="size-9 rounded-xl object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span
            className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground"
            style={color ? { background: color } : undefined}
          >
            {brand.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{brand}</p>
          <p className="truncate text-xs text-subtle-foreground">
            {activeOrg?.name ?? "by Techaasvik"}
          </p>
        </div>
        </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {primaryNav.map((item) => (
            <NavLink key={item.to} item={item} active={pathname.startsWith(item.to)} />
          ))}
        </div>
        <div className="my-4 border-t" />
        <div className="space-y-1">
          {secondaryNav.map((item) => (
            <NavLink key={item.to} item={item} active={pathname.startsWith(item.to)} />
          ))}
        </div>
      </nav>

      {activeOrg && !/^(pro|agency)\b/i.test(activeOrg.plan) && (
      <div className="border-t p-3">
        <div className="rounded-xl border bg-surface-secondary p-4">
          <p className="text-sm font-semibold">Upgrade to Pro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            More automations, higher limits and advanced analytics.
          </p>
          <Button className="mt-3 w-full" size="sm" asChild>
            <Link to="/billing">Upgrade Plan</Link>
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { profile, organizations, activeOrg, switchOrg } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="size-5" />
        <span className="sr-only">Toggle navigation</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <span className="max-w-40 truncate">
              {activeOrg?.name ?? "Loading workspace..."}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((ws) => (
            <DropdownMenuItem key={ws.id} onSelect={() => switchOrg(ws.id)}>
              <div>
                <p className="text-sm font-medium">{ws.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ws.plan} · {ws.role}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
          {organizations.length === 0 && (
            <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative mx-auto hidden w-full max-w-lg md:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
        <input
          type="search"
          placeholder="Search posts, conversations, contacts..."
          className="h-10 w-full rounded-lg border bg-surface-secondary pr-4 pl-9 text-sm outline-none placeholder:text-subtle-foreground focus:border-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/account-health">
            <Bell className="size-5" />
            <span className="sr-only">Account health</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {profile.initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium">{profile.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {activeOrg?.plan ?? ""}
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{profile.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{profile.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/billing">Billing</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const tenant = useTenant();
  const fetchStatus = useServerFn(getPlatformStatus);
  const fetchRole = useServerFn(getMyPlatformRole);
  const status = useQuery({ queryKey: ["platform-status"], queryFn: () => fetchStatus(), staleTime: 60_000 });
  const role = useQuery({
    queryKey: ["platform-role"],
    queryFn: () => fetchRole(),
    retry: false,
    staleTime: 60_000,
  });

  // Super admins run the platform from the admin console, never the customer app.
  if (role.data?.isSuperAdmin) return <Navigate to="/admin" replace />;

  if (status.data?.maintenanceMode && role.data && !role.data.isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-semibold">We'll be right back</h1>
          <p className="text-muted-foreground">
            The app is under scheduled maintenance. Your automations keep their settings — please check back shortly.
          </p>
        </div>
      </div>
    );
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
        <TopBar onMenu={() => setMobileOpen(true)} />
        <TrialBanner />
        <main className="p-4 lg:p-6">
          <PageReadyGate ready={!tenant.loading && role.isFetched && !role.data?.isSuperAdmin}>
            {children}
          </PageReadyGate>
        </main>
      </div>
    </div>
  );
}

function TrialBanner() {
  const { activeOrg } = useTenant();
  if (!activeOrg) return null;
  const trialEnd = trialEndsAt(activeOrg.planKey, activeOrg.planExpiresAt, activeOrg.createdAt);
  if (trialEnd) {
    const msLeft = trialEnd.getTime() - Date.now();
    if (msLeft > 864e5) return null;
    const expired = msLeft <= 0;
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm lg:px-6 ${expired ? "bg-destructive/10 text-destructive" : "bg-warning/10"}`}>
        <p>
          {expired
            ? "Your 3-day free trial has ended. New automations are paused. Conversations already in progress will still finish."
            : `Your free trial ends in ${Math.max(1, Math.ceil(msLeft / 36e5))} hours. Upgrade to keep your automations running.`}
        </p>
        <Button size="sm" asChild>
          <Link to="/billing">{expired ? "Upgrade now" : "View plans"}</Link>
        </Button>
      </div>
    );
  }
  // Paid plan with an end date: warn in the last 7 days and after expiry.
  if (!activeOrg.planExpiresAt || activeOrg.planKey === "starter") return null;
  const msLeft = new Date(activeOrg.planExpiresAt).getTime() - Date.now();
  if (msLeft > 7 * 864e5) return null;
  const expired = msLeft <= 0;
  const days = Math.ceil(msLeft / 864e5);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm lg:px-6 ${expired ? "bg-destructive/10 text-destructive" : "bg-warning/10"}`}>
      <p>
        {expired
          ? `Your ${activeOrg.plan} has expired. Your workspace is now on free Starter limits — renew to restore full access.`
          : days <= 1
            ? `Your ${activeOrg.plan} ends today. Renew to keep your current limits.`
            : `Your ${activeOrg.plan} ends in ${days} days. Renew to keep your current limits.`}
      </p>
      <Button size="sm" asChild>
        <Link to="/billing">{expired ? "Renew now" : "View plans"}</Link>
      </Button>
    </div>
  );
}
