import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Database,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getExamPeriods } from "@/api/schedulingApi";
import StudentScheduleModal from "@/components/common/StudentScheduleModal";

// ── helpers ───────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysFromNow(dateStr) {
  return Math.max(0, Math.round((new Date(dateStr).getTime() - Date.now()) / MS_PER_DAY));
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusDot(status) {
  if (status === "published") return "bg-emerald-500";
  if (status === "scheduled") return "bg-primary";
  return "bg-amber-500";
}

function statusTextColor(status) {
  if (status === "published") return "text-emerald-600 dark:text-emerald-400";
  if (status === "scheduled") return "text-primary";
  return "text-amber-600 dark:text-amber-400";
}

// ── animated nav item ─────────────────────────────────────────────────────────

const iconVariants = {
  rest:  { x: 0 },
  hover: { x: 3 },
};

const gradCapVariants = {
  rest:  { y: 0, rotate: 0 },
  hover: { y: -6, rotate: 20 },
};

function NavItem({ to, end, icon: Icon, label }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      whileHover="hover"
      initial="rest"
      animate="rest"
      className="relative"
    >
      <NavLink
        to={to}
        end={end}
        className="relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium outline-none"
      >
        {({ isActive: active }) => (
          <>
            {active && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-lg bg-accent"
                transition={shouldReduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <motion.span
              variants={shouldReduce ? {} : iconVariants}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn("relative z-10 shrink-0", active ? "text-foreground" : "text-muted-foreground")}
            >
              <Icon className="h-5 w-5" />
            </motion.span>
            <span className={cn("relative z-10 flex-1 text-left", active ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </>
        )}
      </NavLink>
    </motion.div>
  );
}

// ── section button (Data / Exams) ─────────────────────────────────────────────

function SectionButton({ icon: Icon, label, description, isActive, isOpen, onClick }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      whileHover="hover"
      initial="rest"
      animate="rest"
      whileTap={shouldReduce ? {} : { scale: 0.98 }}
    >
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg bg-accent"
          transition={shouldReduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      {!isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 bg-accent/60 transition-opacity hover:opacity-100"
        />
      )}
      <motion.span
        variants={shouldReduce ? {} : iconVariants}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="relative z-10 shrink-0"
      >
        <Icon className="h-5 w-5" />
      </motion.span>
      <span className="relative z-10 flex-1 text-left">
        <span className="block">{label}</span>
        <span className="block text-[10px] font-normal text-muted-foreground/70">{description}</span>
      </span>
      <motion.span
        animate={shouldReduce ? {} : { rotate: isOpen ? 90 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-10 shrink-0 opacity-50"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </motion.span>
    </motion.button>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user, profile, logout } = useAuth();
  const shouldReduce = useReducedMotion();

  const onDataRoute  = location.pathname.startsWith("/data");
  const onExamsRoute = location.pathname.startsWith("/exams");

  const [dataOpen,          setDataOpen]          = useState(onDataRoute);
  const [examsOpen,         setExamsOpen]         = useState(onExamsRoute);
  const [examPeriods,       setExamPeriods]       = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  useEffect(() => {
    if (onDataRoute)  setDataOpen(true);
    if (onExamsRoute) setExamsOpen(true);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getExamPeriods()
      .then((res) => setExamPeriods(res?.data || []))
      .catch(() => {});
  }, [location.pathname]);

  // Derive featured period
  const todayMs = Date.now();
  const activePeriod = examPeriods.find((p) => {
    const s = new Date(p.start_date).getTime();
    const e = new Date(p.end_date).getTime();
    return s <= todayMs && todayMs <= e;
  });
  const nextPeriod = !activePeriod
    ? [...examPeriods]
        .filter((p) => new Date(p.start_date).getTime() > todayMs)
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]
    : null;
  const featured = activePeriod ?? nextPeriod ?? null;

  function handleLogout() {
    logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  const displayName = profile?.full_name ?? user?.email ?? "";
  const initials    = getInitials(displayName);
  const roleLabel   = { admin: "Admin", teacher: "Teacher", student: "Student" }[user?.role] ?? "";

  return (
    <>
      <AnimatePresence>
        {scheduleModalOpen && (
          <StudentScheduleModal onClose={() => setScheduleModalOpen(false)} />
        )}
      </AnimatePresence>

      <aside className="hidden h-screen w-64 flex-col border-r border-border bg-sidebar lg:flex fixed left-0 top-0 z-30 overflow-hidden">

        {/* ── Logo ── */}
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
          <img
            src={resolvedTheme === "dark"
              ? "/examsync-brand/mark-40px-dark.svg"
              : "/examsync-brand/mark-40px.svg"}
            alt="ExamSync mark"
            className="h-7 w-7 shrink-0"
          />
          <span className="font-display text-base font-bold tracking-tight">
            <span className="text-foreground">Exam</span>
            <span className="text-primary">Sync</span>
          </span>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">

          {/* Dashboard */}
          <NavItem to="/dashboard" end icon={LayoutDashboard} label="Dashboard" />

          {/* Data */}
          <div>
            <SectionButton
              icon={Database}
              label="Data"
              description="Rooms, instructors, courses"
              isActive={onDataRoute}
              isOpen={dataOpen}
              onClick={() => setDataOpen((o) => !o)}
            />
            <AnimatePresence initial={false}>
              {dataOpen && (
                <motion.div
                  initial={shouldReduce ? {} : { height: 0, opacity: 0 }}
                  animate={shouldReduce ? {} : { height: "auto", opacity: 1 }}
                  exit={shouldReduce ? {} : { height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-3 pb-1">
                    {[
                      { to: "/data/setup",       icon: <Settings className="h-3.5 w-3.5" />, label: "Data Setup" },
                      { to: "/data/management",  icon: <Database className="h-3.5 w-3.5" />, label: "Data Management" },
                    ].map(({ to, icon, label }, i) => (
                      <motion.div
                        key={to}
                        initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.04, type: "spring", stiffness: 400, damping: 30 }}
                      >
                        <SubLink to={to} icon={icon}>{label}</SubLink>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Exams */}
          <div>
            <SectionButton
              icon={CalendarRange}
              label="Exams"
              description="Periods & schedules"
              isActive={onExamsRoute}
              isOpen={examsOpen}
              onClick={() => setExamsOpen((o) => !o)}
            />
            <AnimatePresence initial={false}>
              {examsOpen && (
                <motion.div
                  initial={shouldReduce ? {} : { height: 0, opacity: 0 }}
                  animate={shouldReduce ? {} : { height: "auto", opacity: 1 }}
                  exit={shouldReduce ? {} : { height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-3 pb-1">
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04, type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <SubLink to="/exams/new" icon={<Plus className="h-3.5 w-3.5" />}>
                        New Exam Period
                      </SubLink>
                    </motion.div>

                    {examPeriods.length > 0 && (
                      <>
                        <motion.div
                          className="flex items-center gap-2 px-2.5 pb-0.5 pt-3"
                          initial={shouldReduce ? {} : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.08 }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Exam Periods
                          </p>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                            {examPeriods.length}
                          </span>
                        </motion.div>

                        {examPeriods.map((period, i) => (
                          <motion.div
                            key={period.id}
                            initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 + 0.12, type: "spring", stiffness: 400, damping: 30 }}
                          >
                            <NavLink
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
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(period.status))} />
                              <span className="flex-1 truncate">{period.name}</span>
                              {period.schedule_quality_score != null && (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {Number(period.schedule_quality_score).toFixed(0)}
                                </span>
                              )}
                            </NavLink>
                          </motion.div>
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Student Schedules */}
          <motion.button
            type="button"
            onClick={() => setScheduleModalOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            whileHover="hover"
            initial="rest"
            animate="rest"
            whileTap={shouldReduce ? {} : { scale: 0.98 }}
          >
            <motion.span
              variants={shouldReduce ? {} : gradCapVariants}
              transition={{ type: "spring", stiffness: 350, damping: 15 }}
              className="shrink-0"
            >
              <GraduationCap className="h-5 w-5" />
            </motion.span>
            <span className="flex-1 text-left">
              <span className="block">Student Schedules</span>
              <span className="block text-[10px] font-normal text-muted-foreground/70">
                Look up individual exams
              </span>
            </span>
          </motion.button>

        </nav>

        {/* ── Upcoming exam widget ── */}
        {featured && (
          <div className="px-3 pb-3">
            <NavLink
              to={`/exams/${featured.id}`}
              className="group block rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {activePeriod ? "Active Now" : "Up Next"}
              </p>
              <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {featured.name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  statusDot(featured.status),
                  activePeriod && "animate-pulse",
                )} />
                <span className="flex-1 text-xs text-muted-foreground">
                  {activePeriod
                    ? `${daysFromNow(featured.end_date)}d remaining`
                    : `Starts in ${daysFromNow(featured.start_date)}d`
                  }
                </span>
                <span className={cn("text-[10px] font-medium capitalize", statusTextColor(featured.status))}>
                  {featured.status}
                </span>
              </div>
            </NavLink>
          </div>
        )}

        {/* ── User card ── */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{displayName || "User"}</p>
              <p className="text-xs capitalize text-muted-foreground">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </aside>
    </>
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
