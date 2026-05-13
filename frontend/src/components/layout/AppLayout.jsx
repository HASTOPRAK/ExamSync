import { Outlet } from "react-router";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { DotGridBackground, GrainOverlay } from "@/components/common/PageBackground";

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <DotGridBackground />
      <GrainOverlay />

      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
          <Topbar />

          <main className="flex-1 p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
