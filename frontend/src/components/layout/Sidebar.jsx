import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Database,
  LayoutDashboard,
  Plus,
  GraduationCap,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getExamPeriods } from "@/api/schedulingApi";

export default function Sidebar() {
  const location = useLocation();

  const onDataRoute  = location.pathname.startsWith("/data");
  const onExamsRoute = location.pathname.startsWith("/exams");

  const [dataOpen,    setDataOpen]    = useState(onDataRoute);
  const [examsOpen,   setExamsOpen]   = useState(onExamsRoute);
  const [examPeriods, setExamPeriods] = useState([]);

  useEffect(() => {
    if (onDataRoute)  setDataOpen(true);
    if (onExamsRoute) setExamsOpen(true);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getExamPeriods()
      .then((res) => setExamPeriods(res?.data || []))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      {/* ── Logo ── */}
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <GraduationCap className="h-4.5 w-4.5 text-primary" />
        </div>
        <span className="font-display text-base font-bold tracking-tight">
          <span className="text-foreground">Exam</span>
          <span className="text-primary">Sync</span>
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {/* Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </NavLink>

        {/* Data */}
        <div>
          <button
            type="button"
            onClick={() => setDataOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              onDataRoute
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Database className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Data</span>
            {dataOpen
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            }
          </button>

          {dataOpen && (
            <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-3">
              <SubLink to="/data/setup" icon={<Settings className="h-3.5 w-3.5" />}>
                Data Setup
              </SubLink>
              <SubLink to="/data/management" icon={<Database className="h-3.5 w-3.5" />}>
                Data Management
              </SubLink>
            </div>
          )}
        </div>

        {/* Exams */}
        <div>
          <button
            type="button"
            onClick={() => setExamsOpen((o) => !o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              onExamsRoute
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <CalendarRange className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Exams</span>
            {examsOpen
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            }
          </button>

          {examsOpen && (
            <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-3">
              <SubLink to="/exams/new" icon={<Plus className="h-3.5 w-3.5" />}>
                New Exam Period
              </SubLink>

              {examPeriods.map((period) => (
                <NavLink
                  key={period.id}
                  to={`/exams/${period.id}`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )
                  }
                >
                  <CalendarRange className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{period.name}</span>
                  {period.schedule_quality_score != null && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {Number(period.schedule_quality_score).toFixed(0)}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <p className="text-center text-[10px] text-muted-foreground/50">ExamSync Admin</p>
      </div>
    </aside>
  );
}

function SubLink({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )
      }
    >
      {icon && <span className="shrink-0 opacity-70">{icon}</span>}
      {children}
    </NavLink>
  );
}
