import { useState } from "react";
import { Outlet } from "react-router";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { DotGridBackground, GrainOverlay } from "@/components/common/PageBackground";

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <DotGridBackground />
      <GrainOverlay />

      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
          <Topbar onMobileMenuClick={() => setMobileNavOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
