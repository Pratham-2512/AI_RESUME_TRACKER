"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ClipboardList, Briefcase, MessagesSquare, BarChart3, Sparkles, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: readonly [string, string, React.ComponentType<{ className?: string }>][] = [
  ["/app/resumes", "Résumés", FileText],
  ["/app/jobs", "Jobs", Briefcase],
  ["/app/applications", "Applications", ClipboardList],
  ["/app/interview", "Interview", MessagesSquare],
  ["/app/analytics", "Analytics", BarChart3],
];

function Brand() {
  return (
    <Link href="/app/resumes" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">AI Resume</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 pb-4 space-y-0.5">
      {NAV.map(([href, label, Icon]) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {active && (
              <span aria-hidden className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
            )}
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-border bg-card pt-5 lg:flex">
      <div className="px-3"><Brand /></div>
      <NavLinks />
      <div className="border-t border-border px-5 py-3.5 text-[11px] text-muted-foreground/70">
        Personal workspace
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-card pt-5 shadow-card-hover">
            <div className="flex items-center justify-between px-3 pr-4">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
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
