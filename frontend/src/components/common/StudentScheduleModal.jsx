import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, GraduationCap, Calendar, Clock, MapPin, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { getStudents, getStudentSchedule } from "@/api/dataApi";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str + "T12:00:00+03:00").toLocaleDateString("en-GB", {
    timeZone: "Europe/Istanbul", weekday: "short", day: "numeric", month: "short",
  });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  return `${h}:${m}`;
}

const CLASS_LABELS = ["All", "1", "2", "3", "4"];

const YEAR_BADGE = {
  1: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  3: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  4: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

// Skeleton row
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
        <div className="h-2 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
      <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
      <div className="h-3.5 w-48 rounded bg-muted animate-pulse" />
      <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function StudentScheduleModal({ onClose }) {
  const shouldReduce = useReducedMotion();

  const [students,        setStudents]        = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [schedule,        setSchedule]        = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [query,           setQuery]           = useState("");
  const [classFilter,     setClassFilter]     = useState("All");

  // Per-session schedule cache: studentId → rows[]
  // Lives for the modal's lifetime; cleared automatically when modal unmounts.
  const scheduleCache = useRef(new Map());

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fetch students on mount
  useEffect(() => {
    getStudents()
      .then((res) => setStudents(res?.data || []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  // Fetch schedule when student selected — served from cache on repeat clicks
  useEffect(() => {
    if (!selectedStudent) { setSchedule([]); return; }

    if (scheduleCache.current.has(selectedStudent.id)) {
      setSchedule(scheduleCache.current.get(selectedStudent.id));
      return;
    }

    setLoadingSchedule(true);
    getStudentSchedule(selectedStudent.id)
      .then((res) => {
        const rows = res?.data || [];
        scheduleCache.current.set(selectedStudent.id, rows);
        setSchedule(rows);
      })
      .catch(() => setSchedule([]))
      .finally(() => setLoadingSchedule(false));
  }, [selectedStudent]);

  // Which year filters actually have data
  const availableYears = useMemo(() => {
    const set = new Set(students.map((s) => String(s.class_no)).filter((v) => v !== "null" && v !== "undefined"));
    return set;
  }, [students]);

  // Reset year filter if the selected year has no data
  useEffect(() => {
    if (classFilter !== "All" && !availableYears.has(classFilter)) {
      setClassFilter("All");
    }
  }, [availableYears]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter students
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return students.filter((s) => {
      const matchClass = classFilter === "All" || String(s.class_no) === classFilter;
      const matchQuery =
        !q ||
        (s.full_name  ?? "").toLowerCase().includes(q) ||
        (s.student_no ?? "").toLowerCase().includes(q) ||
        (s.email      ?? "").toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, query, classFilter]);

  // Group schedule by exam period
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of schedule) {
      const key = row.exam_period_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()];
  }, [schedule]);

  const spring = { type: "spring", stiffness: 320, damping: 30 };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={false}
    >
      {/* Backdrop — click to close */}
      <motion.div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        initial={shouldReduce ? {} : { opacity: 0 }}
        animate={shouldReduce ? {} : { opacity: 1 }}
        exit={shouldReduce ? {} : { opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        initial={shouldReduce ? {} : { opacity: 0, scale: 0.96, y: 8 }}
        animate={shouldReduce ? {} : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduce ? {} : { opacity: 0, scale: 0.96, y: 8 }}
        transition={shouldReduce ? {} : spring}
      >

        {/* ── Left: student list ── */}
        <div className={cn(
          "flex-col border-r border-border w-full sm:w-72 sm:shrink-0",
          selectedStudent ? "hidden sm:flex" : "flex",
        )}>

          {/* Header */}
          <div className="border-b border-border px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-foreground">Student Schedules</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or student no…"
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Class filter chips — year chips only shown when data has that year */}
            <div className="mt-2 flex gap-1">
              {CLASS_LABELS.filter((c) => c === "All" || availableYears.has(c)).map((c) => (
                <motion.button
                  key={c}
                  type="button"
                  onClick={() => setClassFilter(c)}
                  className={cn(
                    "relative flex-1 rounded-md py-1 text-xs font-medium overflow-hidden",
                    classFilter === c ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  whileTap={shouldReduce ? {} : { scale: 0.95 }}
                >
                  {classFilter === c && (
                    <motion.div
                      layoutId="filter-pill"
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={shouldReduce ? {} : spring}
                    />
                  )}
                  {classFilter !== c && (
                    <span className="absolute inset-0 rounded-md bg-muted" />
                  )}
                  <span className="relative z-10">{c === "All" ? "All" : `Yr ${c}`}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loadingStudents ? (
              <div className="space-y-1">
                {[...Array(7)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <motion.p
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={shouldReduce ? {} : { opacity: 1 }}
                className="px-3 py-6 text-center text-xs text-muted-foreground"
              >
                No students found.
              </motion.p>
            ) : (
              <div>
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudent(s)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selectedStudent?.id === s.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      YEAR_BADGE[s.class_no] ?? "bg-muted text-muted-foreground",
                    )}>
                      {String(s.full_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{s.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.student_no}{s.class_no != null ? ` · Yr ${s.class_no}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Count footer */}
          <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
            {filtered.length} of {students.length} students
          </div>
        </div>

        {/* ── Right: schedule ── */}
        <div className={cn(
          "relative flex-1 flex-col overflow-hidden",
          !selectedStudent ? "hidden sm:flex" : "flex",
        )}>
          <AnimatePresence mode="wait">
            {!selectedStudent ? (
              <motion.div
                key="empty"
                className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={shouldReduce ? {} : { opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <GraduationCap className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Select a student</p>
                <p className="max-w-48 text-xs text-muted-foreground">
                  Pick a student from the list to see their exam schedule.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedStudent.id}
                className="flex flex-1 flex-col overflow-hidden"
                initial={shouldReduce ? {} : { opacity: 0, x: 20 }}
                animate={shouldReduce ? {} : { opacity: 1, x: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, x: -20 }}
                transition={shouldReduce ? {} : spring}
              >
                {/* Student header */}
                <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="sm:hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      YEAR_BADGE[selectedStudent.class_no] ?? "bg-muted text-muted-foreground",
                    )}>
                      {String(selectedStudent.full_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{selectedStudent.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedStudent.student_no} · Year {selectedStudent.class_no} · {selectedStudent.education_type}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="sm:hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Schedule body */}
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                  <AnimatePresence mode="wait">
                    {loadingSchedule ? (
                      <motion.div
                        key="loading"
                        initial={shouldReduce ? {} : { opacity: 0 }}
                        animate={shouldReduce ? {} : { opacity: 1 }}
                        exit={shouldReduce ? {} : { opacity: 0 }}
                        className="space-y-3"
                      >
                        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                      </motion.div>
                    ) : grouped.length === 0 ? (
                      <motion.div
                        key="no-exams"
                        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                        animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
                        exit={shouldReduce ? {} : { opacity: 0 }}
                        className="flex flex-col items-center justify-center gap-2 py-16 text-center"
                      >
                        <Calendar className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No scheduled exams found.</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="schedule"
                        initial={shouldReduce ? {} : { opacity: 0 }}
                        animate={shouldReduce ? {} : { opacity: 1 }}
                        exit={shouldReduce ? {} : { opacity: 0 }}
                        className="space-y-6"
                      >
                        {grouped.map(([periodName, exams], gi) => (
                          <motion.div
                            key={periodName}
                            initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
                            animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
                            transition={shouldReduce ? {} : { ...spring, delay: Math.min(gi * 0.06, 0.18) }}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              {periodName}
                            </p>
                            <div className="space-y-2">
                              {exams.map((exam, i) => (
                                <motion.div
                                  key={i}
                                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                                  animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
                                  transition={shouldReduce ? {} : { ...spring, delay: Math.min(gi * 0.06 + i * 0.04, 0.3) }}
                                  className="flex items-start gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3"
                                >
                                  <div className="w-20 shrink-0 text-center">
                                    <p className="text-xs font-semibold text-foreground">
                                      {exam.slot_date ? fmtDate(exam.slot_date) : "—"}
                                    </p>
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                        YEAR_BADGE[selectedStudent.class_no] ?? "bg-muted text-muted-foreground",
                                      )}>
                                        {exam.course_code}
                                      </span>
                                      <span className="text-sm font-medium text-foreground">{exam.course_name}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      {exam.start_time && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {fmtTime(exam.start_time)} – {fmtTime(exam.end_time)}
                                        </span>
                                      )}
                                      {exam.rooms && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {exam.rooms}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
