import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import PageSection from "@/components/common/PageSection";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getApiErrorMessage } from "@/api/axios";
import {
  createExamPeriod,
  generateTimeSlotsForPeriod,
  generateSchedule,
} from "@/api/schedulingApi";
import { getCourses } from "@/api/dataApi";
import { getAcademicTerms } from "@/api/academicTermsApi";

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

  const templates = [];
  let current = WORK_START;

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

const MS_PER_DAY = 86_400_000;

function addDays(date, n) {
  return new Date(new Date(date).getTime() + n * MS_PER_DAY);
}

// Use local-time methods so UTC-offset dates from the backend don't shift by 1 day.
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EXAM_PRESETS = [
  {
    type:        "Midterm",
    startOffset: (t) => addDays(t.semester_start, 56),
    endOffset:   (t) => addDays(t.semester_start, 67),
  },
  {
    type:        "Final",
    startOffset: (t) => addDays(t.semester_end, 3),
    endOffset:   (t) => addDays(t.semester_end, 14),
  },
  {
    type:        "Makeup",
    startOffset: (t) => addDays(t.semester_end, 17),
    endOffset:   (t) => addDays(t.semester_end, 21),
  },
];

const initialForm = {
  name: "", academic_year: "", term: "", exam_type: "", start_date: "", end_date: "",
};

// ── component ─────────────────────────────────────────────────────────────────

export default function NewExamPeriodPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form,             setForm]             = useState(initialForm);
  const [slotDuration,     setSlotDuration]     = useState("");
  const [skipLunch,        setSkipLunch]        = useState(true);
  const [includeWeekends,  setIncludeWeekends]  = useState(false);
  const [maxCourseDuration, setMaxCourseDuration] = useState(null);
  const [isGenerating,     setIsGenerating]     = useState(false);

  const [academicTerms,    setAcademicTerms]    = useState([]);
  const [selectedTermId,   setSelectedTermId]   = useState(null);
  const preloadApplied = useRef(false);

  useEffect(() => {
    getCourses()
      .then((res) => {
        const courses = res?.data || [];
        if (courses.length > 0) {
          setMaxCourseDuration(Math.max(...courses.map((c) => c.exam_duration_minutes ?? 0)));
        }
      })
      .catch(() => {});
    getAcademicTerms()
      .then((res) => {
        const terms = res?.data || [];
        setAcademicTerms(terms);

        const { preloadTermId, preloadType } = location.state ?? {};

        if (preloadTermId && preloadType && !preloadApplied.current) {
          preloadApplied.current = true;
          const term = terms.find((t) => t.id === preloadTermId);
          const preset = EXAM_PRESETS.find((p) => p.type === preloadType);
          if (term && preset) {
            setSelectedTermId(term.id);
            setForm({
              name:          `${term.academic_year} ${term.term} ${preset.type}`,
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
      .catch(() => {});
  }, []);

  function handleLoadPreset(preset) {
    const term = academicTerms.find((t) => t.id === selectedTermId);
    if (!term) return;
    const start = preset.startOffset(term);
    const end   = preset.endOffset(term);
    setForm({
      name:          `${term.academic_year} ${term.term} ${preset.type}`,
      academic_year: term.academic_year,
      term:          term.term,
      exam_type:     preset.type,
      start_date:    toISODate(start),
      end_date:      toISODate(end),
    });
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const parsedDuration = parseInt(slotDuration, 10);
  const durationValid =
    !Number.isNaN(parsedDuration) &&
    parsedDuration > 0 &&
    parsedDuration <= MAX_SLOT_DURATION &&
    (maxCourseDuration === null || parsedDuration >= maxCourseDuration);

  const sessionPreview = useMemo(() => {
    if (!durationValid) return [];
    return computeSessionTemplates(parsedDuration, skipLunch);
  }, [durationValid, parsedDuration, skipLunch]);

  const formComplete =
    form.name && form.academic_year && form.term && form.exam_type &&
    form.start_date && form.end_date && durationValid && sessionPreview.length > 0;

  async function handleGenerate(e) {
    e.preventDefault();
    if (!formComplete) return;

    setIsGenerating(true);
    try {
      const periodRes = await createExamPeriod({ ...form, status: "draft" });
      const period    = periodRes?.data;
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
      toast.error(getApiErrorMessage(error, "Failed to generate schedule"));
      setIsGenerating(false);
    }
  }

  if (isGenerating) return <LoadingOverlay />;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Exams</p>
        <h2 className="font-display mt-2 text-3xl font-bold text-foreground">New Exam Period</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the period details and slot configuration, then generate the schedule in one step.
        </p>
      </div>

      {/* ── Load from academic calendar ───────────────────────────────────── */}
      {academicTerms.length > 0 && (
        <PageSection
          title="Load from academic calendar"
          description="Pick a term and exam type to pre-fill the form. All fields remain editable."
        >
          <div className="space-y-4">
            {/* Term selector */}
            <div className="flex flex-wrap gap-2">
              {academicTerms.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTermId(t.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedTermId === t.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  {t.term} {t.academic_year}
                </button>
              ))}
            </div>

            {/* Exam type buttons */}
            <div className="flex flex-wrap gap-2">
              {EXAM_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => handleLoadPreset(preset)}
                  disabled={!selectedTermId}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  {preset.type}
                </button>
              ))}
            </div>
          </div>
        </PageSection>
      )}

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* ── Period information ─────────────────────────────────────────── */}
        <PageSection
          title="Period information"
          description="Basic details about this exam period."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name" name="name"
                value={form.name} onChange={handleFormChange}
                placeholder="2025-2026 Spring Midterm"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="academic_year">Academic Year</Label>
              <Input
                id="academic_year" name="academic_year"
                value={form.academic_year} onChange={handleFormChange}
                placeholder="2025-2026"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="term">Term</Label>
              <Input
                id="term" name="term"
                value={form.term} onChange={handleFormChange}
                placeholder="Spring"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam_type">Exam Type</Label>
              <Input
                id="exam_type" name="exam_type"
                value={form.exam_type} onChange={handleFormChange}
                placeholder="Midterm"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date" name="start_date" type="date"
                value={form.start_date} onChange={handleFormChange}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date" name="end_date" type="date"
                value={form.end_date} onChange={handleFormChange}
                required
              />
            </div>
          </div>
        </PageSection>

        {/* ── Time slot configuration ────────────────────────────────────── */}
        <PageSection
          title="Time slot configuration"
          description="Define session windows. Slots are generated for every qualifying day in the period."
        >
          <div className="space-y-5">
            {maxCourseDuration !== null && (
              <div className="panel-info rounded-lg border px-4 py-3 text-sm">
                Longest exam duration:{" "}
                <span className="font-semibold text-foreground">{maxCourseDuration} min</span>.
                Slot duration must be at least this and at most{" "}
                <span className="font-semibold text-foreground">{MAX_SLOT_DURATION} min</span>.
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="slotDuration">Slot duration (min)</Label>
              <Input
                id="slotDuration" type="number"
                min={1} max={MAX_SLOT_DURATION}
                value={slotDuration}
                onChange={(e) => setSlotDuration(e.target.value)}
                placeholder={
                  maxCourseDuration !== null
                    ? `${maxCourseDuration} – ${MAX_SLOT_DURATION}`
                    : `1 – ${MAX_SLOT_DURATION}`
                }
                className="w-44"
              />
              {!Number.isNaN(parsedDuration) && parsedDuration > 0 &&
                maxCourseDuration !== null && parsedDuration < maxCourseDuration && (
                  <p className="text-xs text-destructive">
                    Must be at least {maxCourseDuration} min to cover the longest exam.
                  </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipLunch}
                  onChange={(e) => setSkipLunch(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Skip lunch break</span>
                <span className="text-muted-foreground">(12:00 – 13:00)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWeekends}
                  onChange={(e) => setIncludeWeekends(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Include weekends</span>
              </label>
            </div>

            {sessionPreview.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sessions per day ({sessionPreview.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {sessionPreview.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                    >
                      {s.start_time} – {s.end_time}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PageSection>

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={!formComplete} size="lg">
            Create Period & Generate Schedule
          </Button>
          {!formComplete && (
            <p className="text-xs text-muted-foreground">
              Fill all fields and set a valid slot duration to continue.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
