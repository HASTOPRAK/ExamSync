import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  GraduationCap,
  ListChecks,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getValidationSummary } from "@/api/dashboardApi";
import { getExamPeriods } from "@/api/schedulingApi";
import { getApiErrorMessage } from "@/api/axios";
import { formatDate } from "@/utils/formatDate";
import { Button } from "@/components/ui/button";
import StudentScheduleModal from "@/components/common/StudentScheduleModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

const emptySummary = {
  students: 0,
  courses: 0,
  enrollments: 0,
  rooms: 0,
  examPeriods: 0,
  timeSlots: 0,
  exams: 0,
};

// ── Animation variants ────────────────────────────────────────────────────────

const pageContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(dateStr) {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / MS_PER_DAY);
}

function greeting(name) {
  const h = new Date().getHours();
  const base =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `${base}, ${first}` : base;
}

function examTypeColors(t = "") {
  const lower = t.toLowerCase();
  if (lower.includes("midterm"))
    return {
      accent: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      light: "bg-amber-500/8",
      lightHover: "group-hover:bg-amber-500/12",
      border: "border-amber-500/25",
      ring: "#f59e0b",
    };
  if (lower.includes("final"))
    return {
      accent: "bg-violet-500",
      text: "text-violet-600 dark:text-violet-400",
      light: "bg-violet-500/8",
      lightHover: "group-hover:bg-violet-500/12",
      border: "border-violet-500/25",
      ring: "#8b5cf6",
    };
  if (lower.includes("makeup"))
    return {
      accent: "bg-sky-500",
      text: "text-sky-600 dark:text-sky-400",
      light: "bg-sky-500/8",
      lightHover: "group-hover:bg-sky-500/12",
      border: "border-sky-500/25",
      ring: "#0ea5e9",
    };
  return {
    accent: "bg-slate-400",
    text: "text-muted-foreground",
    light: "bg-muted/50",
    lightHover: "group-hover:bg-muted",
    border: "border-border",
    ring: "#94a3b8",
  };
}

function statusBadge(status) {
  if (status === "published")
    return {
      label: "Published",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  if (status === "scheduled")
    return {
      label: "Scheduled",
      cls: "bg-primary/10 text-primary border-primary/20",
    };
  return {
    label: "Draft",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(
  target,
  { duration = 1100, delay = 0, enabled = true } = {},
) {
  const [value, setValue] = useState(0);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    if (!enabled || shouldReduce) {
      setValue(target);
      return;
    }
    setValue(0);
    let raf;
    const timeout = setTimeout(() => {
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(2, -10 * p)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      }
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, enabled, shouldReduce]);

  return value;
}

// ── Quality ring ──────────────────────────────────────────────────────────────

function QualityRing({ score, size = 52 }) {
  const shouldReduce = useReducedMotion();
  const sw = 3.5;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.min(100, Math.max(0, Number(score)));
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (shouldReduce || score == null) {
      setDrawn(pct);
      return;
    }
    const t = setTimeout(() => setDrawn(pct), 250);
    return () => clearTimeout(t);
  }, [pct, shouldReduce, score]);

  const offset = circ * (1 - drawn / 100);
  const strokeColor =
    score == null
      ? "#94a3b8"
      : score >= 75
        ? "#22c55e"
        : score >= 50
          ? "#f59e0b"
          : "#ef4444";
  const textCls =
    score == null
      ? "text-muted-foreground"
      : score >= 75
        ? "text-green-500 dark:text-green-400"
        : score >= 50
          ? "text-amber-500 dark:text-amber-400"
          : "text-red-500 dark:text-red-400";

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={sw}
          stroke="currentColor"
          fill="none"
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={sw}
          stroke={strokeColor}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: shouldReduce
              ? "none"
              : "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <span
        className={cn(
          "relative z-10 text-[11px] font-bold tabular-nums leading-none",
          textCls,
        )}
      >
        {score == null ? "—" : Number(score).toFixed(0)}
      </span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, isLoading, delay = 0 }) {
  const counted = useCountUp(isLoading ? 0 : (value ?? 0), {
    delay,
    enabled: !isLoading,
  });
  const shouldReduce = useReducedMotion();
  const cardRef = useRef(null);

  function handleMouseMove(e) {
    if (shouldReduce || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const dx = (x - 0.5) * 8;
    const dy = (y - 0.5) * 8;
    cardRef.current.style.boxShadow =
      `${dx}px ${dy}px 0 1.5px oklch(0.635 0.167 228 / 0.65), ` +
      `${dx}px ${dy}px 24px oklch(0.635 0.167 228 / 0.2)`;
  }

  function handleMouseLeave() {
    if (!cardRef.current) return;
    cardRef.current.style.boxShadow = "";
  }

  return (
    <motion.div
      ref={cardRef}
      className="rounded-xl border border-border bg-card p-4"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={shouldReduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 28, delay: delay / 1000 }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
          {title}
        </p>
        {Icon && (
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/25" />
        )}
      </div>
      <p className="font-display mt-2.5 text-[2rem] font-bold leading-none tabular-nums text-foreground">
        {isLoading ? (
          <span className="inline-block h-8 w-12 animate-pulse rounded-md bg-muted" />
        ) : (
          counted.toLocaleString()
        )}
      </p>
    </motion.div>
  );
}

// ── Hero period card ──────────────────────────────────────────────────────────

function HeroPeriodCard({ period, isActive, isLoading, navigate }) {
  const shouldReduce = useReducedMotion();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-7 w-52 animate-pulse rounded bg-muted" />
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="mt-auto h-6 w-28 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <CalendarRange className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No upcoming exams</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first exam period to get started.
          </p>
        </div>
        <Button onClick={() => navigate("/exams/new")} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Exam Period
        </Button>
      </div>
    );
  }

  const colors = examTypeColors(period.exam_type);
  const badge = statusBadge(period.status);
  const daysLeft = daysFromNow(isActive ? period.end_date : period.start_date);
  const countdownText = isActive
    ? daysLeft <= 0
      ? "Last day"
      : `${daysLeft}d remaining`
    : daysLeft <= 0
      ? "Starting today"
      : `Starts in ${daysLeft}d`;
  const countdownCls = isActive
    ? "text-primary font-semibold"
    : daysLeft <= 7
      ? "text-amber-500 font-semibold"
      : "text-muted-foreground";

  return (
    <motion.div
      onClick={() => navigate(`/exams/${period.id}`)}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col gap-5 overflow-hidden rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg",
      )}
      whileHover={shouldReduce ? {} : { y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Top accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.75 rounded-t-xl",
          colors.accent,
        )}
      />

      {/* Background color transition on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          colors.light,
        )}
      />

      {/* Content */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                colors.text,
              )}
            >
              {isActive ? "Active Now" : "Up Next"}
            </span>
            {isActive && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    colors.accent,
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    colors.accent,
                  )}
                />
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
            {period.name}
          </h3>
        </div>

        <QualityRing score={period.schedule_quality_score} size={58} />
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          {formatDate(period.start_date)} – {formatDate(period.end_date)}
        </span>
        <span className="text-border">·</span>
        <span className={countdownCls}>{countdownText}</span>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
              badge.cls,
            )}
          >
            {badge.label}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize",
              colors.light,
              colors.text,
              colors.border,
            )}
          >
            {period.exam_type}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
          View <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────

const quickActionVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
};

function QuickActionCard({ icon: Icon, label, description, colorCls, onClick }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
      variants={shouldReduce ? {} : quickActionVariants}
      whileHover={shouldReduce ? {} : { y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colorCls)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-colors group-hover:text-primary/50" />
    </motion.button>
  );
}

// ── Readiness bar (compact) ───────────────────────────────────────────────────

const READINESS_KEYS = [
  { key: "students",    label: "students" },
  { key: "courses",     label: "courses" },
  { key: "rooms",       label: "rooms" },
  { key: "enrollments", label: "enrollments" },
];

function ReadinessBar({ summary, isLoading, navigate }) {
  const shouldReduce = useReducedMotion();
  if (isLoading) return null;

  const missing = READINESS_KEYS.filter((i) => !(summary[i.key] > 0));
  const allGood = missing.length === 0;

  return (
    <motion.div
      variants={shouldReduce ? {} : fadeUp}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-2.5",
        allGood
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      )}
    >
      {allGood ? (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            All data loaded — ready to schedule
          </p>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Missing data:
          </p>
          {missing.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate("/data/setup")}
              className="text-sm font-semibold text-amber-600 underline underline-offset-2 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate("/data/setup")}
            className="ml-auto shrink-0 text-xs text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400"
          >
            Go to setup →
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Exam period card ──────────────────────────────────────────────────────────

function ExamPeriodCard({ period, navigate }) {
  const shouldReduce = useReducedMotion();
  const colors = examTypeColors(period.exam_type);
  const badge = statusBadge(period.status);
  const todayMs = Date.now();
  const startMs = new Date(period.start_date).getTime();
  const endMs = new Date(period.end_date).getTime();
  const isActive = startMs <= todayMs && todayMs <= endMs;
  const isUpcoming = startMs > todayMs;
  const daysLeft = isActive
    ? Math.round((endMs - todayMs) / MS_PER_DAY)
    : Math.round((startMs - todayMs) / MS_PER_DAY);

  return (
    <motion.div
      onClick={() => navigate(`/exams/${period.id}`)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
      whileHover={shouldReduce ? {} : { y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Top color bar */}
      <div className={cn("h-0.75 w-full shrink-0", colors.accent)} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Type + quality ring */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                colors.text,
              )}
            >
              {period.exam_type}
            </p>
            <p className="font-display mt-1 text-base font-semibold leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary">
              {period.name}
            </p>
          </div>
          <QualityRing score={period.schedule_quality_score} size={44} />
        </div>

        {/* Dates */}
        <p className="text-xs text-muted-foreground">
          {formatDate(period.start_date)} – {formatDate(period.end_date)}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              badge.cls,
            )}
          >
            {badge.label}
          </span>

          {isActive ? (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-primary">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {daysLeft}d left
            </span>
          ) : isUpcoming ? (
            <span
              className={cn(
                "text-[10px] font-medium",
                daysLeft <= 7 ? "text-amber-500" : "text-muted-foreground",
              )}
            >
              In {daysLeft}d
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">Ended</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const shouldReduce = useReducedMotion();

  const [summary, setSummary] = useState(emptySummary);
  const [examPeriods, setExamPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      const [summaryRes, periodsRes] = await Promise.all([
        getValidationSummary(),
        getExamPeriods(),
      ]);
      setSummary(summaryRes || emptySummary);
      setExamPeriods(periodsRes?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load dashboard"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

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
  const featuredPeriod = activePeriod ?? nextPeriod ?? null;

  const statCards = [
    { key: "students", title: "Students", icon: Users },
    { key: "courses", title: "Courses", icon: BookOpen },
    { key: "enrollments", title: "Enrollments", icon: ListChecks },
    { key: "rooms", title: "Rooms", icon: Building2 },
    { key: "examPeriods", title: "Exam Periods", icon: CalendarRange },
    { key: "exams", title: "Exams", icon: ClipboardList },
  ];

  const quickActions = [
    {
      icon: CalendarPlus,
      label: "New Exam Period",
      description: "Create & generate schedule",
      colorCls: "text-primary bg-primary/10",
      onClick: () => navigate("/exams/new"),
    },
    {
      icon: Settings,
      label: "Data Setup",
      description: "Import & configure data",
      colorCls: "text-violet-500 bg-violet-500/10",
      onClick: () => navigate("/data/setup"),
    },
    {
      icon: Database,
      label: "Data Management",
      description: "Browse & edit records",
      colorCls: "text-sky-500 bg-sky-500/10",
      onClick: () => navigate("/data/management"),
    },
    {
      icon: GraduationCap,
      label: "Student Schedules",
      description: "Look up student exams",
      colorCls: "text-amber-500 bg-amber-500/10",
      onClick: () => setStudentModalOpen(true),
    },
  ];

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <AnimatePresence>
        {studentModalOpen && (
          <StudentScheduleModal onClose={() => setStudentModalOpen(false)} />
        )}
      </AnimatePresence>

      <motion.div
        className="space-y-6"
        variants={shouldReduce ? {} : pageContainer}
        initial="hidden"
        animate="show"
      >
        {/* ── Greeting ────────────────────────────────────────────────────── */}
        <motion.div variants={shouldReduce ? {} : fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {dateLabel}
          </p>
          <h2 className="font-display mt-1.5 text-3xl font-bold text-foreground">
            {greeting(profile?.full_name)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening with your exam schedule.
          </p>
        </motion.div>

        {/* ── Bento: Hero + Stats ──────────────────────────────────────────── */}
        <motion.div
          variants={shouldReduce ? {} : fadeUp}
          className="grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          {/* Hero period card */}
          <div className="lg:col-span-5">
            <HeroPeriodCard
              period={featuredPeriod}
              isActive={!!activePeriod}
              isLoading={isLoading}
              navigate={navigate}
            />
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7 lg:content-start">
            {statCards.map((card, i) => (
              <StatCard
                key={card.key}
                title={card.title}
                value={summary[card.key]}
                icon={card.icon}
                isLoading={isLoading}
                delay={150 + i * 65}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Quick actions ─────────────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          variants={shouldReduce ? {} : {
            hidden: {},
            show: { transition: { staggerChildren: 0.05, delayChildren: 0 } },
          }}
        >
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.label}
              icon={action.icon}
              label={action.label}
              description={action.description}
              colorCls={action.colorCls}
              onClick={action.onClick}
            />
          ))}
        </motion.div>

        {/* ── Data readiness ────────────────────────────────────────────────── */}
        <ReadinessBar
          summary={summary}
          isLoading={isLoading}
          navigate={navigate}
        />

        {/* ── Exam periods ──────────────────────────────────────────────────── */}
        <motion.div variants={shouldReduce ? {} : fadeUp}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Exam Periods
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {isLoading
                  ? "Loading…"
                  : `${examPeriods.length} period${examPeriods.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/exams/new")}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Period
            </Button>
          </div>

          {!isLoading && examPeriods.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
              <CalendarRange className="h-8 w-8 text-muted-foreground/35" />
              <p className="text-sm text-muted-foreground">
                No exam periods yet.
              </p>
              <Button size="sm" onClick={() => navigate("/exams/new")}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create one
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {isLoading
                ? [...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <div className="h-0.75 w-full animate-pulse bg-muted" />
                      <div className="space-y-2.5 p-4">
                        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                        <div className="h-5 w-44 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                      </div>
                    </div>
                  ))
                : examPeriods.map((period) => (
                    <ExamPeriodCard
                      key={period.id}
                      period={period}
                      navigate={navigate}
                    />
                  ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
