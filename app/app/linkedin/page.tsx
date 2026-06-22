import Link from "next/link";
import { LinkedInAnalyticsPanel } from "@/components/linkedin/linkedin-analytics-panel";

export const dynamic = "force-dynamic";

export default function LinkedInPage() {
  return (
    <div className="animate-fade-up space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/app/dashboard" className="transition-colors hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">LinkedIn</span>
      </div>
      <LinkedInAnalyticsPanel />
    </div>
  );
}
