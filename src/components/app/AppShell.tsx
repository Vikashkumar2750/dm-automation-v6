import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  BarChart3,
  Share2,
  Sparkles,
  ShieldCheck,
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

type NavItem = { label: string; to: string; icon: LucideIcon; badge?: number };

const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Create Post", to: "/create-post", icon: PenSquare },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Inbox", to: "/inbox", icon: Inbox, badge: 12 },
  { label: "Comments", to: "/comments", icon: MessageSquare, badge: 8 },
  { label: "Automations", to: "/automations", icon: Workflow },
  { label: "Contacts", to: "/contacts", icon: Users },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Social Accounts", to: "/social-accounts", icon: Share2 },
  { label: "AI Assistant", to: "/ai-assistant", icon: Sparkles },
];

const secondaryNav: NavItem[] = [
  { label: "Account Health", to: "/account-health", icon: ShieldCheck },
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
  const { activeOrg } = useTenant();
  const brand = activeOrg?.brandName?.trim() || "DM FB-IG-YT";
  const logo = activeOrg?.logoUrl?.trim() || null;
  const color = activeOrg?.brandColor?.trim() || null;

  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      <div className="flex items-center gap-3 border-b px-5 py-4">
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

      <div className="border-t p-3">
        <div className="rounded-xl border bg-surface-secondary p-4">
          <p className="text-sm font-semibold">Upgrade to Pro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            More automations, higher limits and advanced analytics.
          </p>
          <Button className="mt-3 w-full" size="sm">
            Upgrade Plan
          </Button>
        </div>
      </div>
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-danger" />
          <span className="sr-only">Notifications</span>
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
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
