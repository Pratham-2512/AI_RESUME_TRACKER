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
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {module}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">{desc}</p>
      <div className="mt-6 rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        Coming in an upcoming phase. Scaffolding is in place — see <code>docs/07-roadmap.md</code>.
      </div>
    </div>
  );
}
