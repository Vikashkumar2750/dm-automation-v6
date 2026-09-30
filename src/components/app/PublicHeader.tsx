import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Benefits", hash: "benefits" },
  { label: "How it works", hash: "how-it-works" },
  { label: "Safety", hash: "safety" },
  { label: "Pricing", hash: "pricing" },
  { label: "FAQ", hash: "faq" },
] as const;

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.webp" alt="AutoDM" className="size-9 rounded-xl object-contain" />
          <div>
            <p className="text-sm font-bold">AutoDM</p>
            <p className="text-xs text-subtle-foreground">by Techaasvik</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.hash}
              to="/"
              hash={item.hash}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
