import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Trash2, MapPin, User, Clock } from "lucide-react";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";

import { getApiErrorMessage } from "@/api/axios";
import {
  deleteExamPeriod,
  getExamPeriodById,
  getScheduleReport,
  updateExamPeriodStatus,
} from "@/api/schedulingApi";
import { formatDate, formatTime } from "@/utils/formatDate";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function shortDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function weekday(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function timeToMinutes(timeValue) {
  const [h, m] = String(timeValue).split(":");
  return Number(h) * 60 + Number(m);
}

// Color coding by academic year from course code (CE1xx → sky, CE2xx → emerald, etc.)
function getYearFromCode(courseCode) {
  const match = courseCode?.match(/[A-Za-z]+(\d)\d\d/);
  return match ? parseInt(match[1]) : 0;
}

const YEAR_STYLES = {
  1: {
    card: "bg-sky-500/8 dark:bg-sky-500/10 border-sky-500/25 dark:border-sky-500/25",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  2: {
    card: "bg-emerald-500/8 dark:bg-emerald-500/10 border-emerald-500/25 dark:border-emerald-500/25",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  3: {
    card: "bg-amber-500/8 dark:bg-amber-500/10 border-amber-500/25 dark:border-amber-500/25",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  4: {
    card: "bg-violet-500/8 dark:bg-violet-500/10 border-violet-500/25 dark:border-violet-500/25",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  0: {
    card: "bg-slate-500/8 dark:bg-slate-500/10 border-slate-500/25 dark:border-slate-500/25",
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

function getStyle(courseCode) {
  const year = getYearFromCode(courseCode);
  return YEAR_STYLES[year] ?? YEAR_STYLES[0];
}

// ── Status picker ─────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "draft",     label: "Draft",     color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30"   },
  { value: "scheduled", label: "Scheduled", color: "text-primary",                         bg: "bg-primary/10 border-primary/30"       },
  { value: "published", label: "Published", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
];

function getStatusMeta(value) {
  return STATUSES.find((s) => s.value === value) ?? { value, label: value, color: "text-muted-foreground", bg: "bg-muted border-border" };
}

function StatusPicker({ status, onUpdate }) {
  const [open, setOpen]           = useState(false);
  const [updating, setUpdating]   = useState(false);
  const ref                       = useRef(null);
  const meta                      = getStatusMeta(status);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSelect(next) {
    if (next === status) { setOpen(false); return; }
    setUpdating(true);
    setOpen(false);
    await onUpdate(next);
    setUpdating(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={updating}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${meta.bg} ${meta.color}`}
      >
        <span className="capitalize">{updating ? "Saving…" : meta.label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleSelect(s.value)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${s.value === status ? "font-semibold" : ""}`}
            >
              <span className={`h-2 w-2 rounded-full ${s.bg.split(" ")[0].replace("/10", "/80")}`} />
              <span className={s.color}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calendar schedule grid ────────────────────────────────────────────────────

function buildCalendarData(dayData) {
  // Group exams by time_slot_id → sorted slots → list of exams per slot
  const slotMeta = new Map(); // slot_id → { start_time, end_time }
  for (const exam of dayData.exams) {
    if (exam.time_slot_id && !slotMeta.has(exam.time_slot_id)) {
      slotMeta.set(exam.time_slot_id, {
        id: exam.time_slot_id,
        start_time: exam.start_time,
        end_time: exam.end_time,
      });
    }
  }
  const slots = [...slotMeta.values()].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );

  const examsBySlot = {};
  for (const exam of dayData.exams) {
    const sid = exam.time_slot_id;
    if (!sid) continue;
    if (!examsBySlot[sid]) examsBySlot[sid] = [];
    examsBySlot[sid].push(exam);
  }

  return { slots, examsBySlot };
}

function ScheduleGrid({ report }) {
  const days = report?.dayByDaySchedule ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No schedule generated yet.
      </div>
    );
  }

  const safeIndex = Math.min(selectedIndex, days.length - 1);
  const day = days[safeIndex];
  const { slots, examsBySlot } = buildCalendarData(day);

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((d, idx) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm transition-colors",
              idx === safeIndex
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="block text-xs opacity-70">{weekday(d.date)}</span>
            <span className="font-medium">{shortDate(d.date)}</span>
            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[10px] font-semibold">
              {d.totalExams}
            </span>
          </button>
        ))}
      </div>

      {/* Calendar lanes */}
      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No exams scheduled for this day.
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => {
            const exams = examsBySlot[slot.id] ?? [];
            return (
              <div key={slot.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Time header */}
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {formatTime(slot.start_time)}
                  </span>
                  <span className="text-muted-foreground">–</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatTime(slot.end_time)}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {exams.length} exam{exams.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Exam cards */}
                <div className="flex flex-wrap gap-3 p-3">
                  {exams.map((exam) => {
                    const style = getStyle(exam.course_code);
                    return (
                      <div
                        key={exam.exam_id}
                        className={cn(
                          "flex min-w-48 max-w-64 flex-col gap-1.5 rounded-lg border p-3 text-sm",
                          style.card,
                        )}
                      >
                        {/* Course badge + code */}
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", style.badge)}>
                            {exam.course_code}
                          </span>
                        </div>

                        {/* Course name */}
                        <p className="font-medium leading-snug text-foreground">
                          {exam.course_name}
                        </p>

                        {/* Instructor */}
                        {exam.primary_instructor && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{exam.primary_instructor.full_name}</span>
                          </div>
                        )}

                        {/* Rooms */}
                        {exam.rooms?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{exam.rooms.map((r) => r.room_code).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExamPeriodPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [period,        setPeriod]        = useState(null);
  const [report,        setReport]        = useState(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [examsExpanded, setExamsExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [periodRes, reportRes] = await Promise.allSettled([
          getExamPeriodById(id),
          getScheduleReport(id),
        ]);
        if (periodRes.status === "fulfilled") setPeriod(periodRes.value?.data ?? null);
        if (reportRes.status === "fulfilled") setReport(reportRes.value?.data ?? null);
      } catch {
        toast.error("Failed to load exam period");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleStatusChange(newStatus) {
    try {
      await updateExamPeriodStatus(id, newStatus);
      setPeriod((prev) => ({ ...prev, status: newStatus }));
      toast.success(`Status updated to ${newStatus}`);
      window.dispatchEvent(new Event("examperiod:changed"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${period?.name}"? This will remove all time slots, exams, and room assignments. This cannot be undone.`,
      )
    )
      return;

    try {
      setIsDeleting(true);
      await deleteExamPeriod(id);
      toast.success("Exam period deleted");
      navigate("/");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete exam period"));
      setIsDeleting(false);
    }
  }

  const metrics = report?.scoring?.metrics ?? {};
  const summary = report?.summary ?? {};
  const days    = report?.dayByDaySchedule ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!period) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Exam period not found.
      </div>
    );
  }

  const qualityScore = period.schedule_quality_score != null
    ? Number(period.schedule_quality_score)
    : null;

  const scoreColor =
    qualityScore == null ? "text-muted-foreground"
    : qualityScore >= 75  ? "text-green-500 dark:text-green-400"
    : qualityScore >= 50  ? "text-amber-500 dark:text-amber-400"
    :                       "text-red-500 dark:text-red-400";

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Exam Period
          </p>
          <h2 className="font-display mt-1 text-3xl font-bold text-foreground">{period.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{period.academic_year} · {period.term} · {period.exam_type}</span>
            <span className="text-border">|</span>
            <span>{formatDate(period.start_date)} – {formatDate(period.end_date)}</span>
            <StatusPicker status={period.status} onUpdate={handleStatusChange} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {qualityScore !== null && (
            <div className="rounded-xl border border-border bg-card px-5 py-3 text-center">
              <p className="text-xs text-muted-foreground">Quality Score</p>
              <p className={`font-display text-3xl font-bold ${scoreColor}`}>
                {qualityScore.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">/ 100</p>
            </div>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      {/* ── Schedule grid ────────────────────────────────────────────────── */}
      <PageSection
        title="Schedule"
        description={
          days.length > 0
            ? `${summary.scheduledExams ?? 0} exams across ${summary.totalDaysUsed ?? 0} days`
            : "No schedule generated for this period."
        }
      >
        <ScheduleGrid report={report} />
      </PageSection>

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      {qualityScore !== null && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PageSection title="Schedule metrics">
            <div className="space-y-0.5 text-sm">
              <Row label="Scheduled exams"   value={summary.scheduledExams ?? "—"} />
              <Row
                label="Unscheduled exams"
                value={summary.unscheduledExams ?? "—"}
                highlight={summary.unscheduledExams > 0 ? "red" : undefined}
              />
              <Row label="Days used"         value={summary.totalDaysUsed ?? "—"} />
              <Row
                label="Most crowded day"
                value={
                  metrics.mostCrowdedDay?.date
                    ? `${shortDate(metrics.mostCrowdedDay.date)} (${metrics.mostCrowdedDay.examCount} exams)`
                    : "—"
                }
              />
              <Row
                label="Same-day student conflicts"
                value={metrics.sameDayStudentConflicts ?? "—"}
                highlight={metrics.sameDayStudentConflicts > 0 ? "red" : "green"}
              />
              <Row label="Max exams / student / day" value={metrics.maxExamsPerStudentPerDay ?? "—"} />
              <Row
                label="Avg room utilization"
                value={
                  metrics.averageRoomUtilization != null
                    ? `${(metrics.averageRoomUtilization * 100).toFixed(0)}%`
                    : "—"
                }
              />
            </div>
          </PageSection>

          <PageSection title="Exams per day">
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2.5">
                {days.map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-medium text-muted-foreground">{weekday(d.date)}</p>
                      <p className="text-xs text-muted-foreground">{shortDate(d.date)}</p>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary/60 transition-all"
                        style={{
                          width: `${Math.max(4, (d.totalExams / (summary.scheduledExams || 1)) * 100 * 3)}%`,
                          maxWidth: "100%",
                        }}
                      />
                      <span className="text-xs font-medium text-foreground">{d.totalExams}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </div>
      )}

      {/* ── Unscheduled ──────────────────────────────────────────────────── */}
      {(report?.unscheduledExams?.length ?? 0) > 0 && (
        <PageSection title={`Unscheduled exams (${report.unscheduledExams.length})`} variant="error">
          <div className="space-y-1">
            {report.unscheduledExams.map((exam) => (
              <div key={exam.exam_id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground">{exam.course_code}</span>
                <span className="text-muted-foreground">{exam.course_name}</span>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      {/* ── All exams (collapsible) ───────────────────────────────────────── */}
      {days.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setExamsExpanded((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
          >
            <span className="font-display font-semibold">
              All scheduled exams ({summary.scheduledExams ?? 0})
            </span>
            {examsExpanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {examsExpanded && (
            <div className="border-t border-border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Course</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instructor</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rooms</th>
                  </tr>
                </thead>
                <tbody>
                  {days.flatMap((d) =>
                    d.exams.map((exam) => {
                      const style = getStyle(exam.course_code);
                      return (
                        <tr key={exam.exam_id} className="border-b border-border text-foreground hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground">{shortDate(d.date)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {formatTime(exam.start_time)} – {formatTime(exam.end_time)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn("mr-2 rounded px-1.5 py-0.5 text-xs font-bold", style.badge)}>
                              {exam.course_code}
                            </span>
                            <span className="text-muted-foreground">{exam.course_name}</span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {exam.primary_instructor?.full_name ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {exam.rooms?.map((r) => r.room_code).join(", ") || "—"}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight === "red"   ? "text-red-500 dark:text-red-400"
          : highlight === "green" ? "text-green-500 dark:text-green-400"
          : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
