"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, FileText, ClipboardList, User,
  MessagesSquare, GraduationCap, BarChart3, Rocket, Sparkles, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pruned nav: Tailoring Studio (duplicate of Application Studio),
// Copilot (overlaps Command Center + Coach), and Documents (stub) removed.
// Routes stay alive — they're just not first-class destinations.
const NAV_GROUPS: { label: string; items: readonly (readonly [string, string, React.ComponentType<{ className?: string }>])[] }[] = [
  {
    label: "Overview",
    items: [
      ["/app/dashboard", "Command Center", LayoutDashboard],
      ["/app/analytics", "Analytics", BarChart3],
    ],
  },
  {
    label: "Apply",
    items: [
      ["/app/studio", "Application Studio", Rocket],
      ["/app/opportunities", "Opportunities", Target],
      ["/app/applications", "Pipeline", ClipboardList],
    ],
  },
  {
    label: "Prepare",
    items: [
      ["/app/resumes", "Résumé Studio", FileText],
      ["/app/interview", "Interview Prep", MessagesSquare],
    ],
  },
  {
    label: "Grow",
    items: [
      ["/app/coach", "Career Coach", GraduationCap],
      ["/app/profile", "Profile", User],
    ],
  },
];

function Brand() {
  return (
    <Link href="/app/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">AI Career OS</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(([href, label, Icon]) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {active && (
                    <span aria-hidden className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Desktop sidebar — hidden below lg. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-5 border-r border-border bg-card pt-5 lg:flex">
      <div className="px-3"><Brand /></div>
      <NavLinks />
      <div className="border-t border-border px-5 py-3.5 text-[11px] text-muted-foreground/70">
        Personal workspace
      </div>
    </aside>
  );
}

/** Mobile top bar + slide-over drawer — hidden at lg and above. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on route change and lock scroll while open.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-scale-in flex-col gap-5 bg-card pt-5 shadow-card-hover">
            <div className="flex items-center justify-between px-3 pr-4">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
