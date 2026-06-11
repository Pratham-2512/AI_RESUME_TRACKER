import { Sidebar, MobileNav } from "@/components/app/sidebar";

// Single-user app: no authentication. Direct access to all pages (Option A).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
