import { OpportunityAnalyzer } from "@/components/opportunities/opportunity-analyzer";
import { PageHeader } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Opportunities"
        desc="Paste any job — get your match score, interview probability, skill gaps, and how to apply."
      />
      <OpportunityAnalyzer />
    </div>
  );
}
