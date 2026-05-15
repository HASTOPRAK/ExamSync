import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { getApiErrorMessage } from "@/api/axios";
import {
  createExamPeriod,
  deleteExamPeriod,
  generateTimeSlotsForPeriod,
  generateSchedule,
} from "@/api/schedulingApi";
import { getCourses } from "@/api/dataApi";
import { getAcademicTerms } from "@/api/academicTermsApi";

// ── Animation variants ────────────────────────────────────────────────────────

const pageContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 28 } },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function toTimeString(totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function computeSessionTemplates(durationMinutes, skipLunch) {
  const WORK_START  = 9 * 60;
  const WORK_END    = 17 * 60;
  const LUNCH_START = 12 * 60;
  const LUNCH_END   = 13 * 60;
  const templates   = [];
  let current       = WORK_START;

  while (current <= WORK_END) {
    const slotEnd = current + durationMinutes;
    if (skipLunch && current < LUNCH_END && slotEnd > LUNCH_START) {
      current = LUNCH_END;
      continue;
    }
    templates.push({ start_time: toTimeString(current), end_time: toTimeString(slotEnd) });
    current = slotEnd;
  }
  return templates;
}

const MAX_SLOT_DURATION = 120;
const MS_PER_DAY        = 86_400_000;

function addDays(date, n) {
  return new Date(new Date(date).getTime() + n * MS_PER_DAY);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtShort(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr + "T12:00:00+03:00").toLocaleDateString("en-GB", {
    timeZone: "Europe/Istanbul", day: "numeric", month: "short",
  });
}

function currentAcademicStartYear() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

const TERMS      = ["Fall", "Spring", "Summer"];
const EXAM_TYPES = ["Midterm", "Final", "Makeup"];

const EXAM_PRESETS = [
  { type: "Midterm", startOffset: (t) => addDays(t.semester_start, 56), endOffset: (t) => addDays(t.semester_start, 67) },
  { type: "Final",   startOffset: (t) => addDays(t.semester_end,   3),  endOffset: (t) => addDays(t.semester_end,  14) },
  { type: "Makeup",  startOffset: (t) => addDays(t.semester_end,  17),  endOffset: (t) => addDays(t.semester_end,  21) },
];

const initialForm = { academic_year: "", term: "", exam_type: "", start_date: "", end_date: "" };

// ── Chip group ────────────────────────────────────────────────────────────────

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? "" : opt)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            opt === value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Date range picker ─────────────────────────────────────────────────────────

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  const step = !startDate ? "start" : !endDate ? "end" : null;

  const selected = {
    from: startDate ? new Date(startDate + "T00:00:00") : undefined,
    to:   endDate   ? new Date(endDate   + "T00:00:00") : undefined,
  };

  const defaultMonth = selected.from ?? new Date();

  function handleSelect(range) {
    onStartChange(range?.from ? toISODate(range.from) : "");
    onEndChange(range?.to   ? toISODate(range.to)   : "");
  }

  function clear() { onStartChange(""); onEndChange(""); }

  const hint =
    step === "start" ? "Click a day to set the start date" :
    step === "end"   ? "Click another day to set the end date" : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => onStartChange("")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
            step === "start"
              ? "ring-1 ring-primary/30 bg-primary/5 text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <span className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
            startDate ? "bg-emerald-500 text-white" : "bg-primary text-white",
          )}>1</span>
          <span>{startDate ? fmtShort(startDate) : "Start"}</span>
        </button>

        <span className="text-[10px] text-muted-foreground/30">—</span>

        <button
          type="button"
          onClick={() => { if (startDate) onEndChange(""); }}
          disabled={!startDate}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
            step === "end"
              ? "ring-1 ring-primary/30 bg-primary/5 text-foreground"
              : startDate
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "cursor-not-allowed text-muted-foreground/30",
          )}
        >
          <span className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
            endDate ? "bg-emerald-500 text-white" : step === "end" ? "bg-primary text-white" : "bg-muted text-muted-foreground",
          )}>2</span>
          <span>{endDate ? fmtShort(endDate) : "End"}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          {(startDate || endDate) && (
            <button type="button" onClick={clear} title="Clear dates"
              className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Calendar
        mode="range"
        selected={selected}
        onSelect={handleSelect}
        defaultMonth={defaultMonth}
        className="p-3"
      />
    </div>
  );
}

// ── Time slot box ─────────────────────────────────────────────────────────────
// Matches the calendar's visual weight — same border, same rounded corners,
// same header strip — so the two sit as a natural pair.

function TimeSlotBox({
  slotDuration, onSlotDurationChange,
  skipLunch, onSkipLunchChange,
  includeWeekends, onIncludeWeekendsChange,
  maxCourseDuration, sessionPreview,
}) {
  const shouldReduce = useReducedMotion();
  const parsedDuration = parseInt(slotDuration, 10);
  const tooShort =
    !Number.isNaN(parsedDuration) &&
    parsedDuration > 0 &&
    maxCourseDuration !== null &&
    parsedDuration < maxCourseDuration;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header strip — mirrors the step indicator height */}
      <div className="flex items-center border-b border-border px-3 py-2">
        <p className="text-xs font-semibold text-foreground">Time Slots</p>
        <span className="ml-2 text-[11px] text-muted-foreground">
          sessions per qualifying day
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Duration */}
        <div className="space-y-1.5">
          <Label htmlFor="slotDuration">Slot duration</Label>
          <div className="flex items-center gap-2">
            <Input
              id="slotDuration"
              type="number"
              min={1}
              max={MAX_SLOT_DURATION}
              value={slotDuration}
              onChange={(e) => onSlotDurationChange(e.target.value)}
              placeholder={maxCourseDuration !== null ? String(maxCourseDuration) : "90"}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
          {maxCourseDuration !== null && !tooShort && (
            <p className="text-xs text-muted-foreground">
              Longest exam: {maxCourseDuration} min · max {MAX_SLOT_DURATION} min
            </p>
          )}
          {tooShort && (
            <p className="text-xs text-destructive">
              Must be ≥ {maxCourseDuration} min to cover the longest exam.
            </p>
          )}
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={skipLunch}
              onChange={(e) => onSkipLunchChange(e.target.checked)}
              className="rounded border-border" />
            Skip lunch break
            <span className="text-xs text-muted-foreground">12–13</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={includeWeekends}
              onChange={(e) => onIncludeWeekendsChange(e.target.checked)}
              className="rounded border-border" />
            Include weekends
          </label>
        </div>

        {/* Session preview */}
        <AnimatePresence>
          {sessionPreview.length > 0 && (
            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-auto rounded-xl border border-border bg-muted/30 px-3 py-3"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {sessionPreview.length} sessions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sessionPreview.map((s, idx) => (
                  <span key={idx}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground">
                    {s.start_time}–{s.end_time}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Typewriter text ───────────────────────────────────────────────────────────

function TypewriterText({ text, className }) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce || !text) return <span className={className}>{text}</span>;
  return (
    <span className={cn("inline-flex flex-wrap", className)}>
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

// ── page ──────────────────────────────────────────────────────────────────────

export default function NewExamPeriodPage() {
  const shouldReduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const [form,              setForm]              = useState(initialForm);
  const [slotDuration,      setSlotDuration]      = useState("");
  const [skipLunch,         setSkipLunch]         = useState(true);
  const [includeWeekends,   setIncludeWeekends]   = useState(false);
  const [maxCourseDuration, setMaxCourseDuration] = useState(null);
  const [isGenerating,      setIsGenerating]      = useState(false);
  const [academicTerms,     setAcademicTerms]     = useState([]);
  const [selectedTermId,    setSelectedTermId]    = useState(null);
  const preloadApplied = useRef(false);
  const preloadTermId = location.state?.preloadTermId ?? null;
  const preloadType   = location.state?.preloadType   ?? null;

  useEffect(() => {
    getCourses()
      .then((res) => {
        const courses = res?.data || [];
        if (courses.length > 0) {
          const max = Math.max(...courses.map((c) => c.exam_duration_minutes ?? 0));
          setMaxCourseDuration(max);
          setSlotDuration((prev) => prev === "" ? String(max) : prev);
        }
      })
      .catch(() => toast.error("Failed to load courses"));

    getAcademicTerms()
      .then((res) => {
        const terms = res?.data || [];
        setAcademicTerms(terms);

        if (preloadTermId && preloadType && !preloadApplied.current) {
          preloadApplied.current = true;
          const term   = terms.find((t) => t.id === preloadTermId);
          const preset = EXAM_PRESETS.find((p) => p.type === preloadType);
          if (term && preset) {
            setSelectedTermId(term.id);
            setForm({
              academic_year: term.academic_year,
              term:          term.term,
              exam_type:     preset.type,
              start_date:    toISODate(preset.startOffset(term)),
              end_date:      toISODate(preset.endOffset(term)),
            });
          }
        } else if (terms.length > 0) {
          setSelectedTermId(terms[0].id);
        }
      })
      .catch(() => toast.error("Failed to load academic terms"));
  }, [preloadTermId, preloadType]);

  const visibleYears = useMemo(() => {
    if (academicTerms.length > 0)
      return [...new Set(academicTerms.map((t) => t.academic_year))].sort();
    const base = currentAcademicStartYear();
    return [`${base - 1}-${base}`, `${base}-${base + 1}`, `${base + 1}-${base + 2}`];
  }, [academicTerms]);

  const derivedName = [form.academic_year, form.term, form.exam_type].filter(Boolean).join(" ");

  function handleSelectTerm(id) {
    setSelectedTermId(id);
    const term = academicTerms.find((t) => t.id === id);
    if (term) setForm((p) => ({ ...p, academic_year: term.academic_year, term: term.term, start_date: "", end_date: "" }));
  }

  function handleLoadPreset(preset) {
    const term = academicTerms.find((t) => t.id === selectedTermId);
    if (!term) return;
    setForm({
      academic_year: term.academic_year,
      term:          term.term,
      exam_type:     preset.type,
      start_date:    toISODate(preset.startOffset(term)),
      end_date:      toISODate(preset.endOffset(term)),
    });
  }

  const parsedDuration = parseInt(slotDuration, 10);
  const durationValid  =
    !Number.isNaN(parsedDuration) &&
    parsedDuration > 0 &&
    parsedDuration <= MAX_SLOT_DURATION &&
    (maxCourseDuration === null || parsedDuration >= maxCourseDuration);

  const sessionPreview = useMemo(() => {
    if (!durationValid) return [];
    return computeSessionTemplates(parsedDuration, skipLunch);
  }, [durationValid, parsedDuration, skipLunch]);

  const formComplete =
    form.academic_year && form.term && form.exam_type &&
    form.start_date && form.end_date && durationValid && sessionPreview.length > 0;

  async function handleGenerate(e) {
    e.preventDefault();
    if (!formComplete) return;
    setIsGenerating(true);
    let period = null;
    try {
      const periodRes = await createExamPeriod({
        name:          derivedName,
        academic_year: form.academic_year,
        term:          form.term,
        exam_type:     form.exam_type,
        start_date:    form.start_date,
        end_date:      form.end_date,
        status:        "draft",
      });
      period = periodRes?.data;
      if (!period?.id) throw new Error("Period creation failed");

      await generateTimeSlotsForPeriod({
        exam_period_id:    Number(period.id),
        session_templates: sessionPreview,
        include_weekends:  includeWeekends,
        clear_existing:    false,
      });

      await generateSchedule({ examPeriodId: Number(period.id), phase: 5 });

      toast.success("Schedule generated successfully");
      navigate(`/exams/${period.id}`);
    } catch (error) {
      if (period?.id) await deleteExamPeriod(period.id).catch(() => {});
      toast.error(getApiErrorMessage(error, "Failed to generate schedule"));
      setIsGenerating(false);
    }
  }

  if (isGenerating) return <LoadingOverlay />;

  return (
    <motion.div
      className="space-y-6"
      variants={shouldReduce ? {} : pageContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div variants={shouldReduce ? {} : fadeUp}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Exams</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground">New Exam Period</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Configure the period details and time slots, then generate the full schedule in one step.
        </p>
      </motion.div>

      <motion.form variants={shouldReduce ? {} : fadeUp} onSubmit={handleGenerate} className="space-y-5">
        {/* ── Single card ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-5">

            {/* Quick fill strip */}
            {academicTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fill from calendar
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {academicTerms.map((t) => (
                    <button key={t.id} type="button" onClick={() => handleSelectTerm(t.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        selectedTermId === t.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}>
                      {t.term} {t.academic_year}
                    </button>
                  ))}
                </div>
                {selectedTermId && (
                  <>
                    <span className="text-muted-foreground/30">→</span>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAM_PRESETS.map((p) => (
                        <button key={p.type} type="button" onClick={() => handleLoadPreset(p)}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                          {p.type}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Name display + chip groups */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <AnimatePresence mode="wait">
                  {derivedName ? (
                    <TypewriterText
                      key={derivedName}
                      text={derivedName}
                      className="text-base font-semibold text-foreground"
                    />
                  ) : (
                    <motion.p
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm text-muted-foreground/50"
                    >
                      Name will appear once year, term, and type are selected
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Academic Year</p>
                  <ChipGroup options={visibleYears} value={form.academic_year}
                    onChange={(v) => setForm((p) => ({ ...p, academic_year: v }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Term</p>
                  <ChipGroup options={TERMS} value={form.term}
                    onChange={(v) => setForm((p) => ({ ...p, term: v }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Exam Type</p>
                  <ChipGroup options={EXAM_TYPES} value={form.exam_type}
                    onChange={(v) => setForm((p) => ({ ...p, exam_type: v }))} />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="-mx-6 border-t border-border" />

            {/* Calendar + Time slots side by side */}
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <DateRangePicker
                startDate={form.start_date}
                endDate={form.end_date}
                onStartChange={(v) => setForm((p) => ({ ...p, start_date: v }))}
                onEndChange={(v) => setForm((p) => ({ ...p, end_date: v }))}
              />
              <TimeSlotBox
                slotDuration={slotDuration}
                onSlotDurationChange={setSlotDuration}
                skipLunch={skipLunch}
                onSkipLunchChange={setSkipLunch}
                includeWeekends={includeWeekends}
                onIncludeWeekendsChange={setIncludeWeekends}
                maxCourseDuration={maxCourseDuration}
                sessionPreview={sessionPreview}
              />
            </div>

          </div>
        </div>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={!formComplete} size="lg">
            Create & Generate Schedule
          </Button>
          <AnimatePresence>
            {!formComplete && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-muted-foreground"
              >
                Fill all fields and set a valid slot duration to continue.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.form>
    </motion.div>
  );
}
