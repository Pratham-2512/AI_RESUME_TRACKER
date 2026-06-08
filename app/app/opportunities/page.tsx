import { OpportunityAnalyzer } from "@/components/opportunities/opportunity-analyzer";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Opportunities</h1>
      <p className="mt-1 text-muted-foreground">
        Paste any job — get your match score, interview probability, skill gaps, and how to apply.
      </p>
      <div className="mt-6">
        <OpportunityAnalyzer />
      </div>
    </div>
  );
}
