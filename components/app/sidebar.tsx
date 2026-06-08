"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, FileText, Wand2, ClipboardList, MessageSquare, User, Mail,
  MessagesSquare, GraduationCap, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Core surfaces. Jobs/Matches merged into Opportunities;
// Skills folds into Coach; LinkedIn folds into Documents.
const NAV = [
  ["/app/dashboard", "Command Center", LayoutDashboard],
  ["/app/opportunities", "Opportunities", Target],
  ["/app/tailor", "Tailoring Studio", Wand2],
  ["/app/resumes", "Résumé Studio", FileText],
  ["/app/applications", "Pipeline", ClipboardList],
  ["/app/interview", "Interview Prep", MessagesSquare],
  ["/app/coach", "Career Coach", GraduationCap],
  ["/app/analytics", "Analytics", BarChart3],
  ["/app/copilot", "Copilot", MessageSquare],
  ["/app/profile", "Profile", User],
  ["/app/documents", "Documents", Mail],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      <div className="px-5 py-5 text-lg font-bold">AI Career OS</div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(([href, label, Icon]) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        Personal mode · single user
      </div>
    </aside>
  );
}
