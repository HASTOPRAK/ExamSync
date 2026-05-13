import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, NavLink } from "react-router";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Database,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getAcademicTerms } from "@/api/academicTermsApi";
import { getExamPeriods, getExamPeriodById } from "@/api/schedulingApi";

// ── helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROUTE_LABELS = {
  "/": [{ label: "Dashboard" }],
  "/data/setup": [{ label: "Data" }, { label: "Setup" }],
  "/data/management": [{ label: "Data" }, { label: "Management" }],
  "/exams/new": [{ label: "Exams" }, { label: "New Period" }],
};

function useBreadcrumbs() {
  const location = useLocation();
  const [dynamicLabel, setDynamicLabel] = useState(null);

  const examIdMatch = location.pathname.match(/^\/exams\/(\d+)$/);
  const examId = examIdMatch ? examIdMatch[1] : null;

  useEffect(() => {
    if (!examId) {
      setDynamicLabel(null);
      return;
    }
    getExamPeriodById(examId)
      .then((res) => setDynamicLabel(res?.data?.name ?? null))
      .catch(() => setDynamicLabel(null));
  }, [examId]);

  if (examId) {
    return [{ label: "Exams" }, { label: dynamicLabel ?? "…" }];
  }
  return ROUTE_LABELS[location.pathname] ?? [];
}

// ── Era / countdown ───────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysBetween(a, b) {
  return Math.round((b - a) / MS_PER_DAY);
}

function addDays(date, n) {
  return new Date(new Date(date).getTime() + n * MS_PER_DAY);
}

// Derives the three exam blocks from stored class dates (never persisted).
// semester_start = Monday (first day of classes)
// semester_end   = Friday (last day of classes)
export function calcExamBlocks(term) {
  const s = new Date(term.semester_start);
  const e = new Date(term.semester_end);
  return [
    { label: "Midterm", start: addDays(s, 56), end: addDays(s, 67) },
    { label: "Final", start: addDays(e, 3), end: addDays(e, 14) },
    { label: "Makeup", start: addDays(e, 17), end: addDays(e, 21) },
  ];
}

// Actual exam periods take priority over calculated blocks.
function computeEra(terms, periods, today) {
  const todayMs = today.getTime();

  // ── 1. Find the active/upcoming term ────────────────────────────────────────
  const currentTerm = terms.find((t) => {
    const s = new Date(t.semester_start).getTime();
    const e = addDays(new Date(t.semester_end), 21).getTime();
    return s <= todayMs && todayMs <= e;
  });

  // ── 2. No matching term — check actual periods directly, then term countdown ─
  if (!currentTerm) {
    const activePeriod = periods.find((p) => {
      const s = new Date(p.start_date).getTime();
      const e = new Date(p.end_date).getTime();
      return s <= todayMs && todayMs <= e;
    });
    if (activePeriod) {
      const d = daysBetween(todayMs, new Date(activePeriod.end_date).getTime());
      return {
        text: `${activePeriod.exam_type} week · ${d}d remaining`,
        urgency: "exam",
        term: null,
      };
    }

    const nextPeriod = [...periods]
      .filter((p) => new Date(p.start_date).getTime() > todayMs)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
    if (nextPeriod) {
      const d = daysBetween(todayMs, new Date(nextPeriod.start_date).getTime());
      if (d <= 7)
        return {
          text: `${d}d until ${nextPeriod.exam_type}s!`,
          urgency: "urgent",
          term: null,
        };
      if (d <= 21)
        return {
          text: `${d}d until ${nextPeriod.exam_type}s`,
          urgency: "soon",
          term: null,
        };
    }

    const upcomingTerm = [...terms]
      .filter((t) => new Date(t.semester_start).getTime() > todayMs)
      .sort(
        (a, b) => new Date(a.semester_start) - new Date(b.semester_start),
      )[0];
    if (upcomingTerm) {
      const d = daysBetween(
        todayMs,
        new Date(upcomingTerm.semester_start).getTime(),
      );
      return {
        text: `${d}d until ${upcomingTerm.term} term`,
        urgency: "normal",
        term: upcomingTerm,
      };
    }
    return null;
  }

  // ── 3. Current term — check actual periods for this term first ───────────────
  const termPeriods = periods
    .filter(
      (p) =>
        p.academic_year === currentTerm.academic_year &&
        p.term === currentTerm.term,
    )
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const activePeriod = termPeriods.find((p) => {
    const s = new Date(p.start_date).getTime();
    const e = new Date(p.end_date).getTime();
    return s <= todayMs && todayMs <= e;
  });
  if (activePeriod) {
    const d = daysBetween(todayMs, new Date(activePeriod.end_date).getTime());
    return {
      text: `${activePeriod.exam_type} week · ${d}d remaining`,
      urgency: "exam",
      term: currentTerm,
    };
  }

  const nextActual = termPeriods.find(
    (p) => new Date(p.start_date).getTime() > todayMs,
  );
  if (nextActual) {
    const d = daysBetween(todayMs, new Date(nextActual.start_date).getTime());
    if (d <= 7)
      return {
        text: `${d}d until ${nextActual.exam_type}s!`,
        urgency: "urgent",
        term: currentTerm,
      };
    if (d <= 21)
      return {
        text: `${d}d until ${nextActual.exam_type}s`,
        urgency: "soon",
        term: currentTerm,
      };
    const semStart = new Date(currentTerm.semester_start).getTime();
    const weekNo = Math.ceil(daysBetween(semStart, todayMs) / 7);
    return {
      text: `Week ${weekNo} · ${d}d until ${nextActual.exam_type}s`,
      urgency: "normal",
      term: currentTerm,
    };
  }

  // ── 4. Fall back to calculated blocks ────────────────────────────────────────
  const blocks = calcExamBlocks(currentTerm);

  const activeBlock = blocks.find(
    ({ start, end }) => start.getTime() <= todayMs && todayMs <= end.getTime(),
  );
  if (activeBlock) {
    const d = daysBetween(todayMs, activeBlock.end.getTime());
    return {
      text: `${activeBlock.label} week · ${d}d remaining`,
      urgency: "exam",
      term: currentTerm,
    };
  }

  const nextBlock = blocks
    .filter(({ start }) => start.getTime() > todayMs)
    .sort((a, b) => a.start - b.start)[0];
  if (nextBlock) {
    const d = daysBetween(todayMs, nextBlock.start.getTime());
    if (d <= 7)
      return {
        text: `${d}d until ${nextBlock.label}s!`,
        urgency: "urgent",
        term: currentTerm,
      };
    if (d <= 21)
      return {
        text: `${d}d until ${nextBlock.label}s`,
        urgency: "soon",
        term: currentTerm,
      };
    const semStart = new Date(currentTerm.semester_start).getTime();
    const weekNo = Math.ceil(daysBetween(semStart, todayMs) / 7);
    return {
      text: `Week ${weekNo} · ${d}d until ${nextBlock.label}s`,
      urgency: "normal",
      term: currentTerm,
    };
  }

  const semStart = new Date(currentTerm.semester_start).getTime();
  const weekNo = Math.ceil(daysBetween(semStart, todayMs) / 7);
  return {
    text: `Week ${weekNo} of ${currentTerm.term}`,
    urgency: "normal",
    term: currentTerm,
  };
}

const URGENCY_STYLE = {
  normal: "text-muted-foreground",
  soon: "text-amber-500 dark:text-amber-400",
  urgent: "text-red-500 dark:text-red-400 animate-pulse",
  exam: "text-primary font-semibold",
};

// ── Typewriter breadcrumb ─────────────────────────────────────────────────────

function TypewriterText({ text, className }) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce || !text) return <span className={className}>{text}</span>;
  return (
    <span className={cn("inline-flex", className)}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.03, duration: 0.08 }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

// ── Theme icon variants ───────────────────────────────────────────────────────

const themeIconVariants = {
  initial: { y: 8, opacity: 0, scale: 0.5 },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 20 },
  },
  exit: { y: -8, opacity: 0, scale: 0.5, transition: { duration: 0.12 } },
};

// Returns exam periods that are active or starting within 30 days and have no schedule yet.
function computeHealthIssues(periods, today) {
  const todayMs = today.getTime();
  return periods.filter((p) => {
    const start = new Date(p.start_date).getTime();
    const end = new Date(p.end_date).getTime();
    const daysUntil = Math.round((start - todayMs) / MS_PER_DAY);
    const relevant =
      (start <= todayMs && todayMs <= end) ||
      (daysUntil >= 0 && daysUntil <= 30);
    return (
      relevant && (p.schedule_quality_score == null || p.status === "draft")
    );
  });
}

// ── Exam type colors ──────────────────────────────────────────────────────────

function examTypeColor(examType) {
  const t = (examType ?? "").toLowerCase();
  if (t.includes("midterm"))
    return {
      bar: "bg-amber-500",
      dot: "bg-amber-500",
      label: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500",
      bgLight: "bg-amber-500/10",
      text: "text-amber-500",
    };
  if (t.includes("final"))
    return {
      bar: "bg-violet-500",
      dot: "bg-violet-500",
      label: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500",
      bgLight: "bg-violet-500/10",
      text: "text-violet-500",
    };
  if (t.includes("makeup"))
    return {
      bar: "bg-sky-500",
      dot: "bg-sky-500",
      label: "text-sky-600 dark:text-sky-400",
      border: "border-sky-500",
      bgLight: "bg-sky-500/10",
      text: "text-sky-500",
    };
  return {
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    label: "text-muted-foreground",
    border: "border-slate-500",
    bgLight: "bg-slate-500/10",
    text: "text-slate-500",
  };
}

// ── Command palette ───────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    label: "Dashboard",
    sub: "Overview & active schedules",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Data Setup",
    sub: "Rooms, instructors, imports",
    path: "/data/setup",
    icon: Settings,
  },
  {
    label: "Data Management",
    sub: "Browse & edit records",
    path: "/data/management",
    icon: Database,
  },
  {
    label: "New Exam Period",
    sub: "Create & generate schedule",
    path: "/exams/new",
    icon: CalendarPlus,
  },
];

function CommandPalette({ examPeriods, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const q = query.toLowerCase().trim();

  const allItems = useMemo(() => {
    const nav = NAV_ITEMS.filter(
      (i) =>
        !q ||
        i.label.toLowerCase().includes(q) ||
        i.sub.toLowerCase().includes(q),
    ).map((i) => ({ ...i, group: "nav" }));

    const periods = examPeriods
      .filter(
        (p) =>
          !q ||
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.exam_type ?? "").toLowerCase().includes(q) ||
          (p.academic_year ?? "").toLowerCase().includes(q) ||
          (p.term ?? "").toLowerCase().includes(q),
      )
      .map((p) => ({
        label: p.name,
        sub: `${p.exam_type} · ${p.academic_year} ${p.term}`,
        path: `/exams/${p.id}`,
        icon: CalendarDays,
        group: "period",
        score: p.schedule_quality_score,
      }));

    return [...nav, ...periods];
  }, [q, examPeriods]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(path) {
    navigate(path);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[activeIndex]) go(allItems[activeIndex].path);
    }
  }

  const navItems = allItems.filter((i) => i.group === "nav");
  const periodItems = allItems.filter((i) => i.group === "period");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]"
      initial={shouldReduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduce ? {} : { opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        initial={shouldReduce ? false : { scale: 0.96, y: -12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={shouldReduce ? {} : { scale: 0.96, y: -12, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, exam periods…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {allItems.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {navItems.length > 0 && (
            <section>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Navigation
              </p>
              {navItems.map((item) => {
                const idx = allItems.indexOf(item);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      idx === activeIndex
                        ? "bg-accent text-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sub}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  </button>
                );
              })}
            </section>
          )}

          {periodItems.length > 0 && (
            <section>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Exam Periods
              </p>
              {periodItems.map((item) => {
                const idx = allItems.indexOf(item);
                const score = item.score;
                const scoreColor =
                  score == null
                    ? "text-muted-foreground"
                    : score >= 75
                      ? "text-emerald-500"
                      : score >= 50
                        ? "text-amber-500"
                        : "text-red-500";
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      idx === activeIndex
                        ? "bg-accent text-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sub}
                      </p>
                    </div>
                    {score != null && (
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold",
                          scoreColor,
                        )}
                      >
                        {Number(score).toFixed(0)}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  </button>
                );
              })}
            </section>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">↵</kbd>{" "}
              open
            </span>
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">/</kbd>{" "}
              toggle
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {allItems.length} result{allItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Calendar popover ──────────────────────────────────────────────────────────

function CalendarPopover({ terms, periods, today, onClose }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const todayMs = today.getTime();

  const sortedTerms = [...terms]
    .sort(
      (a, b) =>
        Math.abs(new Date(a.semester_start) - today) -
        Math.abs(new Date(b.semester_start) - today),
    )
    .slice(0, 3);

  const termPeriodMap = (term) =>
    periods.filter(
      (p) => p.academic_year === term.academic_year && p.term === term.term,
    );

  // Timeline spans semester_start → semester_end + 21 days (end of makeups)
  function termTimelineEnd(term) {
    return addDays(new Date(term.semester_end), 21).getTime();
  }

  function pct(date, termStart, totalMs) {
    const d = (date instanceof Date ? date : new Date(date)).getTime();
    return Math.max(0, Math.min(100, ((d - termStart) / totalMs) * 100));
  }

  function goToNew(termId, examType) {
    navigate("/exams/new", {
      state: { preloadTermId: termId, preloadType: examType },
    });
    onClose();
  }

  function goToPeriod(periodId) {
    navigate(`/exams/${periodId}`);
    onClose();
  }

  return (
    <motion.div
      ref={ref}
      className="absolute left-1/2 top-full z-50 mt-2 w-130 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl p-px shadow-xl"
      style={{ background: "var(--border)" }}
      initial={shouldReduce ? false : { opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduce ? {} : { opacity: 0, scale: 0.95, y: -6 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.background = `radial-gradient(380px circle at ${x}px ${y}px, oklch(0.635 0.167 228 / 0.55), var(--border) 55%)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--border)";
      }}
    >
      <div className="rounded-[15px] bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Academic Calendar
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {sortedTerms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No academic terms configured. Add them in{" "}
            <NavLink
              to="/data/setup"
              className="text-primary hover:underline"
              onClick={onClose}
            >
              Data Setup
            </NavLink>
            .
          </p>
        ) : (
          <div className="space-y-6">
            {sortedTerms.map((term, termIdx) => {
              const termStart = new Date(term.semester_start).getTime();
              const termEnd = termTimelineEnd(term);
              const totalMs = termEnd - termStart;
              const tPeriods = termPeriodMap(term);
              const todayPct = pct(today, termStart, totalMs);
              const inTerm = termStart <= todayMs && todayMs <= termEnd;

              // Always render one block per exam type: solid if period exists, dashed if not
              const blocks = calcExamBlocks(term).map(
                ({ label, start, end }) => {
                  const match = tPeriods.find((p) =>
                    (p.exam_type ?? "")
                      .toLowerCase()
                      .includes(label.toLowerCase()),
                  );
                  return {
                    label,
                    estStart: start,
                    estEnd: end,
                    period: match ?? null,
                  };
                },
              );

              return (
                <motion.div
                  key={term.id}
                  initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: termIdx * 0.08,
                    type: "spring",
                    stiffness: 300,
                    damping: 28,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-foreground">
                      {term.term} {term.academic_year}
                    </span>
                    {inTerm && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Date range labels */}
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      {new Date(term.semester_start + "T12:00:00+03:00").toLocaleDateString(
                        "en-GB",
                        {
                          timeZone: "Europe/Istanbul",
                          day: "numeric",
                          month: "short",
                        },
                      )}
                    </span>
                    <span>
                      {addDays(
                        new Date(term.semester_end + "T12:00:00+03:00"),
                        21,
                      ).toLocaleDateString("en-GB", {
                        timeZone: "Europe/Istanbul",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {/* Timeline track */}
                  <div className="relative h-9 w-full">
                    <div className="absolute inset-y-3.5 left-0 right-0 rounded-full bg-muted" />

                    {blocks.map(
                      ({ label, estStart, estEnd, period }, blockIdx) => {
                        const colors = examTypeColor(label);
                        const blockStart = period
                          ? period.start_date
                          : estStart;
                        const blockEnd = period ? period.end_date : estEnd;
                        const leftPct = pct(blockStart, termStart, totalMs);
                        const rightPct = pct(blockEnd, termStart, totalMs);
                        const widthPct = Math.max(rightPct - leftPct, 2);
                        const barDelay = termIdx * 0.1 + blockIdx * 0.07 + 0.05;

                        if (period) {
                          return (
                            <motion.button
                              key={label}
                              type="button"
                              onClick={() => goToPeriod(period.id)}
                              className={cn(
                                "absolute inset-y-2.5 rounded-full opacity-85 transition-opacity hover:opacity-100 cursor-pointer",
                                colors.bar,
                              )}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                transformOrigin: "left",
                              }}
                              initial={shouldReduce ? false : { scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{
                                delay: barDelay,
                                type: "spring",
                                stiffness: 280,
                                damping: 28,
                              }}
                              title={`${period.exam_type} — click to open`}
                            />
                          );
                        }

                        return (
                          <motion.button
                            key={label}
                            type="button"
                            onClick={() => goToNew(term.id, label)}
                            className={cn(
                              "absolute inset-y-2.5 rounded-full border-2 border-dashed flex items-center justify-center",
                              "opacity-60 hover:opacity-100 transition-opacity cursor-pointer",
                              colors.border,
                              colors.bgLight,
                            )}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              transformOrigin: "left",
                            }}
                            initial={shouldReduce ? false : { scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              delay: barDelay,
                              type: "spring",
                              stiffness: 280,
                              damping: 28,
                            }}
                            title={`${label} (estimated) — click to create exam period`}
                          >
                            {widthPct > 5 && (
                              <span
                                className={cn(
                                  "text-[9px] font-bold leading-none select-none",
                                  colors.text,
                                )}
                              >
                                +
                              </span>
                            )}
                          </motion.button>
                        );
                      },
                    )}

                    {/* Today marker */}
                    {inTerm && (
                      <motion.div
                        className="absolute inset-y-0.5 w-0.5 rounded-full bg-primary shadow-sm"
                        style={{ left: `${todayPct}%`, transformOrigin: "top" }}
                        initial={shouldReduce ? false : { scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{
                          delay: termIdx * 0.1 + 0.3,
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                        }}
                      >
                        <motion.div
                          className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary ring-2 ring-card"
                          initial={shouldReduce ? false : { scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            delay: termIdx * 0.1 + 0.45,
                            type: "spring",
                            stiffness: 500,
                            damping: 18,
                          }}
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {blocks.map(
                      ({ label, estStart, estEnd, period }, blockIdx) => {
                        const colors = examTypeColor(label);

                        if (period) {
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => goToPeriod(period.id)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  colors.dot,
                                )}
                              />
                              <span className={colors.label}>
                                {period.exam_type}
                              </span>
                              <span className="text-muted-foreground/50">
                                {new Date(period.start_date + "T12:00:00+03:00").toLocaleDateString(
                                  "en-GB",
                                  { timeZone: "Europe/Istanbul", day: "numeric", month: "short" },
                                )}
                                {" – "}
                                {new Date(period.end_date + "T12:00:00+03:00").toLocaleDateString(
                                  "en-GB",
                                  { timeZone: "Europe/Istanbul", day: "numeric", month: "short" },
                                )}
                              </span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => goToNew(term.id, label)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground/55 hover:text-muted-foreground transition-colors"
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full opacity-40",
                                colors.dot,
                              )}
                            />
                            <span className={cn("opacity-70", colors.label)}>
                              {label}
                            </span>
                            <span className="text-muted-foreground/40">
                              {estStart.toLocaleDateString("en-GB", {
                                timeZone: "Europe/Istanbul",
                                day: "numeric",
                                month: "short",
                              })}
                              {" – "}
                              {estEnd.toLocaleDateString("en-GB", {
                                timeZone: "Europe/Istanbul",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className={cn("font-medium", colors.text)}>
                              + Add
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3 text-center">
          <NavLink
            to="/data/setup"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Manage academic terms →
          </NavLink>
        </div>
      </div>
    </motion.div>
  );
}

// ── Health dropdown ───────────────────────────────────────────────────────────

function HealthDropdown({ issues, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function fmtDate(str) {
    if (!str) return "";
    return new Date(str + "T12:00:00+03:00").toLocaleDateString("en-GB", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "short",
    });
  }

  function issueReason(p) {
    if (p.status === "draft") return "Draft · not yet published";
    if (p.schedule_quality_score == null) return "No schedule generated";
    return "Needs attention";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-accent",
          open && "bg-accent",
        )}
        title={`${issues.length} exam period${issues.length > 1 ? "s" : ""} need${issues.length === 1 ? "s" : ""} attention`}
      >
        <AlertCircle className="h-4 w-4" />
        <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white leading-none">
          {issues.length}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            initial={shouldReduce ? false : { opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                Needs Attention · {issues.length}
              </p>
            </div>
            <div className="p-1">
              {issues.map((p, i) => (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onNavigate(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  initial={shouldReduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: i * 0.05,
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                >
                  <span className="text-sm font-medium text-foreground">
                    {p.name}
                  </span>
                  <span className="text-xs text-amber-500/80">
                    {issueReason(p)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Avatar dropdown ───────────────────────────────────────────────────────────

function AvatarDropdown({ user, profile, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = profile?.full_name ?? user?.email ?? "";
  const initials = getInitials(displayName);
  const roleLabel =
    { admin: "Admin", teacher: "Teacher", student: "Student" }[user?.role] ??
    "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-transparent transition-all hover:ring-primary/30",
          open && "ring-primary/40",
        )}
        title={displayName}
      >
        {initials}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1 shadow-xl"
            initial={shouldReduce ? false : { opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <motion.div
              className="flex items-center gap-3 px-3 py-3"
              initial={shouldReduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.04,
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </motion.div>

            <div className="my-1 border-t border-border" />

            <motion.button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
              initial={shouldReduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.08,
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Sign out
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Topbar ───────────────────────────────────────────────────────────────

export default function Topbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const shouldReduce = useReducedMotion();
  const breadcrumbs = useBreadcrumbs();

  const [academicTerms, setAcademicTerms] = useState([]);
  const [examPeriods, setExamPeriods] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const calendarRef = useRef(null);
  const today = new Date();

  // Stable ref so visibility/interval effects never need to re-register
  const refetch = useRef(null);
  refetch.current = () => {
    getAcademicTerms()
      .then((r) => setAcademicTerms(r?.data || []))
      .catch(() => {});
    getExamPeriods()
      .then((r) => setExamPeriods(r?.data || []))
      .catch(() => {});
  };

  // Re-fetch on navigation or when an exam period is mutated elsewhere on the page
  useEffect(() => {
    refetch.current();
  }, [location.pathname]);

  useEffect(() => {
    function handler() {
      refetch.current();
    }
    window.addEventListener("examperiod:changed", handler);
    return () => window.removeEventListener("examperiod:changed", handler);
  }, []);

  // Global "/" shortcut — fires only when focus is not inside a text input
  useEffect(() => {
    function handler(e) {
      if (e.key !== "/") return;
      const tag = document.activeElement?.tagName ?? "";
      const editable = document.activeElement?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable)
        return;
      e.preventDefault();
      setPaletteOpen((o) => !o);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleLogout() {
    logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  const era = computeEra(academicTerms, examPeriods, today);
  const healthIssues = computeHealthIssues(examPeriods, today);

  const dateLabel = today.toLocaleDateString("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <>
      <AnimatePresence>
        {paletteOpen && (
          <CommandPalette
            examPeriods={examPeriods}
            onClose={() => setPaletteOpen(false)}
          />
        )}
      </AnimatePresence>

      <header className="relative z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/20 px-4 backdrop-blur-sm lg:px-6">
        {/* ── Left: Breadcrumb ── */}
        <nav className="hidden items-center gap-1.5 text-sm lg:flex">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label + i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
              <TypewriterText
                text={crumb.label}
                className={
                  i === breadcrumbs.length - 1
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }
              />
            </span>
          ))}
        </nav>

        {/* Mobile: logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="font-display text-sm font-bold">
            <span className="text-foreground">Exam</span>
            <span className="text-primary">Sync</span>
          </span>
        </div>

        {/* ── Center: Date + Era + Calendar trigger ── */}
        <div className="relative" ref={calendarRef}>
          <button
            type="button"
            onClick={() => setCalendarOpen((o) => !o)}
            className={cn(
              "flex flex-col items-center rounded-xl px-4 py-1.5 text-center transition-colors hover:bg-accent",
              calendarOpen && "bg-accent",
            )}
          >
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {dateLabel}
              </span>
            </div>

            {/* ── Feature 3: active period gets a filled chip, otherwise plain text ── */}
            {era?.urgency === "exam" ? (
              <span className="mt-0.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {era.text}
              </span>
            ) : era ? (
              <span
                className={cn(
                  "text-xs leading-tight",
                  URGENCY_STYLE[era.urgency],
                )}
              >
                {era.text}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50">
                No term configured
              </span>
            )}
          </button>

          <AnimatePresence>
            {calendarOpen && (
              <CalendarPopover
                terms={academicTerms}
                periods={examPeriods}
                today={today}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: search · health · quick-create · divider · theme · avatar ── */}
        <div className="flex items-center gap-1.5">
          {/* ── Feature 1: Command palette trigger ── */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Search (/)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden items-center gap-1.5 text-[11px] lg:flex">
              <span className="text-muted-foreground/70">Search </span>
              <kbd className="rounded border border-border px-1 py-0.5 font-sans">
                /
              </kbd>
            </span>
          </button>

          {/* ── Feature 2: Schedule health dropdown ── */}
          {healthIssues.length > 0 && (
            <HealthDropdown
              issues={healthIssues}
              onNavigate={(id) => navigate(`/exams/${id}`)}
            />
          )}

          {/* Divider */}
          <div className="mx-1 h-4 w-px bg-border" />

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {resolvedTheme === "dark" ? (
                <motion.span
                  key="moon"
                  variants={shouldReduce ? {} : themeIconVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center justify-center"
                >
                  <Moon className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  variants={shouldReduce ? {} : themeIconVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center justify-center"
                >
                  <Sun className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {user && (
            <AvatarDropdown
              user={user}
              profile={profile}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>
    </>
  );
}
