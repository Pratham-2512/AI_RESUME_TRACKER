import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";

export function PageStub({
  title,
  module,
  desc,
}: {
  title: string;
  module: string;
  desc: string;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title={title} desc={desc}>
        <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {module}
        </span>
      </PageHeader>
      <div className="card flex flex-col items-center gap-3 border-dashed p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </span>
        <p className="text-sm font-medium">Coming in an upcoming phase</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Scaffolding is in place — see <code className="rounded bg-muted px-1 py-0.5">docs/07-roadmap.md</code> for the build order.
        </p>
      </div>
    </div>
  );
}
