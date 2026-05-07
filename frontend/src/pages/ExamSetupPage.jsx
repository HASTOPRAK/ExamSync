import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { getApiErrorMessage } from "@/api/axios";
import { getCourses } from "@/api/dataApi";
import {
  createExamPeriod,
  generateSchedule,
  generateTimeSlotsForPeriod,
  getExamPeriods,
  getExamsByExamPeriod,
  getScheduleReport,
  getTimeSlotsByExamPeriod,
  resetSchedule,
} from "@/api/schedulingApi";
import { formatDate, formatTime } from "@/utils/formatDate";

const initialExamPeriodForm = {
  name: "",
  academic_year: "",
  term: "",
  exam_type: "",
  start_date: "",
  end_date: "",
  status: "draft",
};

function toTimeString(totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function computeSessionTemplates(durationMinutes, skipLunch) {
  const WORK_START = 9 * 60;
  const WORK_END = 17 * 60;
  const LUNCH_START = 12 * 60;
  const LUNCH_END = 13 * 60;

  const templates = [];
  let current = WORK_START;

  while (current <= WORK_END) {
    const slotEnd = current + durationMinutes;

    if (skipLunch && current < LUNCH_END && slotEnd > LUNCH_START) {
      current = LUNCH_END;
      continue;
    }

    templates.push({
      start_time: toTimeString(current),
      end_time: toTimeString(slotEnd),
    });

    current = slotEnd;
  }

  return templates;
}

function buildDayGrid(dayData) {
  const slotMap = new Map();
  for (const exam of dayData.exams) {
    if (exam.time_slot_id) {
      slotMap.set(exam.time_slot_id, {
        id: exam.time_slot_id,
        start_time: exam.start_time,
        end_time: exam.end_time,
      });
    }
  }
  const slots = [...slotMap.values()].sort((a, b) =>
    String(a.start_time).localeCompare(String(b.start_time)),
  );

  const roomMap = new Map();
  for (const exam of dayData.exams) {
    for (const room of exam.rooms || []) {
      if (!roomMap.has(room.room_code)) roomMap.set(room.room_code, room);
    }
  }
  const rooms = [...roomMap.values()].sort((a, b) =>
    a.room_code.localeCompare(b.room_code),
  );

  const cellMap = {};
  for (const exam of dayData.exams) {
    for (const room of exam.rooms || []) {
      if (!cellMap[room.room_code]) cellMap[room.room_code] = {};
      cellMap[room.room_code][exam.time_slot_id] = exam;
    }
  }

  return { slots, rooms, cellMap };
}

function shortDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function ScheduleGridView({ report }) {
  const days = report?.dayByDaySchedule ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
        No scheduled days to display.
      </div>
    );
  }

  const safeIndex = Math.min(selectedIndex, days.length - 1);
  const day = days[safeIndex];
  const { slots, rooms, cellMap } = buildDayGrid(day);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((d, idx) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              idx === safeIndex
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {shortDate(d.date)}
            <span className="ml-1.5 text-xs opacity-60">{d.totalExams}</span>
          </button>
        ))}
      </div>

      {slots.length === 0 || rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
          No room assignments for this day.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-r border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-medium text-slate-400 min-w-28">
                  Room
                </th>
                {slots.map((slot) => (
                  <th
                    key={slot.id}
                    className="border-b border-r border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-medium text-slate-400 min-w-40 last:border-r-0"
                  >
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, roomIdx) => (
                <tr
                  key={room.room_code}
                  className={roomIdx % 2 === 0 ? "" : "bg-slate-900/30"}
                >
                  <td className="border-r border-slate-800 px-3 py-2.5 align-top">
                    <p className="text-xs font-medium text-slate-200">
                      {room.room_code}
                    </p>
                    {room.building && (
                      <p className="text-xs text-slate-500">{room.building}</p>
                    )}
                  </td>
                  {slots.map((slot) => {
                    const exam = cellMap[room.room_code]?.[slot.id];
                    return (
                      <td
                        key={slot.id}
                        className="border-r border-slate-800 px-3 py-2.5 align-top last:border-r-0"
                      >
                        {exam ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-100">
                              {exam.course_code}
                            </p>
                            <p className="mt-0.5 text-xs leading-tight text-slate-500">
                              {exam.course_name}
                            </p>
                            {exam.primary_instructor && (
                              <p className="mt-1 text-xs text-slate-400">
                                {exam.primary_instructor.full_name}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ExamSetupPage() {
  const [examPeriods, setExamPeriods] = useState([]);
  const [selectedExamPeriodId, setSelectedExamPeriodId] = useState("");
  const [courses, setCourses] = useState([]);

  const [examPeriodForm, setExamPeriodForm] = useState(initialExamPeriodForm);
  const [examPeriodSheetOpen, setExamPeriodSheetOpen] = useState(false);

  const [timeSlots, setTimeSlots] = useState([]);
  const [exams, setExams] = useState([]);
  const [report, setReport] = useState(null);

  const [slotDuration, setSlotDuration] = useState("");
  const [skipLunch, setSkipLunch] = useState(true);
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);

  const [showScheduleGrid, setShowScheduleGrid] = useState(false);
  const [scheduleGridReport, setScheduleGridReport] = useState(null);
  const [isLoadingScheduleGrid, setIsLoadingScheduleGrid] = useState(false);

  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSubmittingExamPeriod, setIsSubmittingExamPeriod] = useState(false);
  const [isGeneratingSlots, setIsGeneratingSlots] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  async function loadExamPeriods() {
    try {
      setIsLoadingPeriods(true);

      const response = await getExamPeriods();
      const periods = response?.data || [];

      setExamPeriods(periods);

      if (!selectedExamPeriodId && periods.length > 0) {
        setSelectedExamPeriodId(String(periods[0].id));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load exam periods"));
    } finally {
      setIsLoadingPeriods(false);
    }
  }

  async function loadCourses() {
    try {
      setIsLoadingCourses(true);
      const data = await getCourses();
      setCourses(data?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load courses"));
    } finally {
      setIsLoadingCourses(false);
    }
  }

  async function loadSelectedExamPeriodDetails(examPeriodId) {
    if (!examPeriodId) {
      setTimeSlots([]);
      setExams([]);
      setReport(null);
      return;
    }

    try {
      setIsLoadingDetails(true);

      const [timeSlotsRes, examsRes] = await Promise.all([
        getTimeSlotsByExamPeriod(examPeriodId),
        getExamsByExamPeriod(examPeriodId),
      ]);

      setTimeSlots(timeSlotsRes?.data || []);
      setExams(examsRes?.data || []);
      setReport(null);
      setShowScheduleGrid(false);
      setScheduleGridReport(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load exam setup data"));
    } finally {
      setIsLoadingDetails(false);
    }
  }

  useEffect(() => {
    loadExamPeriods();
    loadCourses();
  }, []);

  useEffect(() => {
    loadSelectedExamPeriodDetails(selectedExamPeriodId);
  }, [selectedExamPeriodId]);

  const selectedExamPeriod = useMemo(
    () =>
      examPeriods.find(
        (item) => String(item.id) === String(selectedExamPeriodId),
      ) || null,
    [examPeriods, selectedExamPeriodId],
  );

  const maxCourseDuration = useMemo(
    () =>
      courses.length > 0
        ? Math.max(...courses.map((c) => c.exam_duration_minutes ?? 0))
        : null,
    [courses],
  );

  const MAX_SLOT_DURATION = 120;

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

  function handleExamPeriodFormChange(event) {
    const { name, value } = event.target;
    setExamPeriodForm((prev) => ({ ...prev, [name]: value }));
  }

  function openExamPeriodSheet() {
    setExamPeriodForm(initialExamPeriodForm);
    setExamPeriodSheetOpen(true);
  }

  function closeExamPeriodSheet() {
    setExamPeriodSheetOpen(false);
    setExamPeriodForm(initialExamPeriodForm);
  }

  async function handleCreateExamPeriod(event) {
    event.preventDefault();

    try {
      setIsSubmittingExamPeriod(true);

      const response = await createExamPeriod(examPeriodForm);
      const created = response?.data;

      toast.success(response?.message || "Exam period created");

      closeExamPeriodSheet();
      await loadExamPeriods();

      if (created?.id) {
        setSelectedExamPeriodId(String(created.id));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create exam period"));
    } finally {
      setIsSubmittingExamPeriod(false);
    }
  }

  async function handleGenerateTimeSlots(event) {
    event.preventDefault();

    if (!selectedExamPeriodId) {
      toast.error("Select an exam period first");
      return;
    }

    if (sessionPreview.length === 0) {
      toast.error("No sessions fit within 09:00–18:00 with the given duration");
      return;
    }

    try {
      setIsGeneratingSlots(true);

      const response = await generateTimeSlotsForPeriod({
        exam_period_id: Number(selectedExamPeriodId),
        session_templates: sessionPreview,
        include_weekends: includeWeekends,
        clear_existing: clearExisting,
      });

      const count = response?.data?.createdCount ?? 0;
      toast.success(
        `Created ${count} time slot${count !== 1 ? "s" : ""}`,
      );

      await loadSelectedExamPeriodDetails(selectedExamPeriodId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate time slots"));
    } finally {
      setIsGeneratingSlots(false);
    }
  }

  async function handleGenerateSchedule() {
    if (!selectedExamPeriodId) {
      toast.error("Select an exam period first");
      return;
    }

    try {
      setIsGenerating(true);

      const response = await generateSchedule({
        examPeriodId: Number(selectedExamPeriodId),
        phase: 5,
      });

      toast.success(response?.message || "Schedule generated");

      await loadSelectedExamPeriodDetails(selectedExamPeriodId);

      const reportRes = await getScheduleReport(selectedExamPeriodId);
      setReport(reportRes?.data || null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate schedule"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleResetSchedule() {
    if (!selectedExamPeriodId) {
      toast.error("Select an exam period first");
      return;
    }

    try {
      setIsResetting(true);

      const response = await resetSchedule(selectedExamPeriodId);
      toast.success(response?.message || "Schedule reset");

      await loadSelectedExamPeriodDetails(selectedExamPeriodId);
      setReport(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to reset schedule"));
    } finally {
      setIsResetting(false);
    }
  }

  async function handleShowSchedule() {
    if (!selectedExamPeriodId) return;

    if (showScheduleGrid) {
      setShowScheduleGrid(false);
      return;
    }

    try {
      setIsLoadingScheduleGrid(true);
      const response = await getScheduleReport(selectedExamPeriodId);
      setScheduleGridReport(response?.data || null);
      setShowScheduleGrid(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load schedule"));
    } finally {
      setIsLoadingScheduleGrid(false);
    }
  }

  const hasCourses = !isLoadingCourses && courses.length > 0;
  const hasScheduledExams = exams.some((e) => e.status === "scheduled");
  const durationTooShort =
    !Number.isNaN(parsedDuration) &&
    parsedDuration > 0 &&
    maxCourseDuration !== null &&
    parsedDuration < maxCourseDuration;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
          Exam Setup
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Periods, time slots, scheduling, reports
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Core scheduling workflow lives here now.
        </p>
      </div>

      {/* ── Create exam period sheet ───────────────────────── */}
      <Sheet
        open={examPeriodSheetOpen}
        onOpenChange={(open) => { if (!open) closeExamPeriodSheet(); }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Exam Period</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleCreateExamPeriod} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={examPeriodForm.name}
                onChange={handleExamPeriodFormChange}
                placeholder="2025-2026 Spring Midterm"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="academic_year">Academic Year</Label>
                <Input
                  id="academic_year"
                  name="academic_year"
                  value={examPeriodForm.academic_year}
                  onChange={handleExamPeriodFormChange}
                  placeholder="2025-2026"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="term">Term</Label>
                <Input
                  id="term"
                  name="term"
                  value={examPeriodForm.term}
                  onChange={handleExamPeriodFormChange}
                  placeholder="Spring"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="exam_type">Exam Type</Label>
                <Input
                  id="exam_type"
                  name="exam_type"
                  value={examPeriodForm.exam_type}
                  onChange={handleExamPeriodFormChange}
                  placeholder="Midterm"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  value={examPeriodForm.status}
                  onChange={handleExamPeriodFormChange}
                  className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={examPeriodForm.start_date}
                  onChange={handleExamPeriodFormChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  value={examPeriodForm.end_date}
                  onChange={handleExamPeriodFormChange}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmittingExamPeriod}>
                {isSubmittingExamPeriod ? "Creating..." : "Create Exam Period"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Select exam period */}
        <PageSection
          title="Exam periods"
          description="Everything below works against the selected period."
          action={
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={openExamPeriodSheet}
              title="Create exam period"
            >
              <PlusIcon />
            </Button>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="selectedExamPeriod">Active period</Label>
              <select
                id="selectedExamPeriod"
                value={selectedExamPeriodId}
                onChange={(e) => setSelectedExamPeriodId(e.target.value)}
                className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                disabled={isLoadingPeriods}
              >
                <option value="">Select exam period</option>
                {examPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedExamPeriod ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 space-y-1">
                <p>
                  <span className="text-slate-500">Academic Year:</span>{" "}
                  {selectedExamPeriod.academic_year}
                </p>
                <p>
                  <span className="text-slate-500">Term:</span>{" "}
                  {selectedExamPeriod.term}
                </p>
                <p>
                  <span className="text-slate-500">Exam Type:</span>{" "}
                  {selectedExamPeriod.exam_type}
                </p>
                <p>
                  <span className="text-slate-500">Date Range:</span>{" "}
                  {formatDate(selectedExamPeriod.start_date)} -{" "}
                  {formatDate(selectedExamPeriod.end_date)}
                </p>
                <p>
                  <span className="text-slate-500">Quality Score:</span>{" "}
                  {selectedExamPeriod.schedule_quality_score != null ? (
                    <span className="font-semibold text-white">
                      {Number(selectedExamPeriod.schedule_quality_score).toFixed(1)}
                      <span className="text-slate-500 font-normal"> / 100</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">not scheduled yet</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                Pick an exam period to load time slots, exams, and reports.
              </div>
            )}

            {hasScheduledExams && (
              <Button
                variant="secondary"
                onClick={handleShowSchedule}
                disabled={isLoadingScheduleGrid}
              >
                {isLoadingScheduleGrid
                  ? "Loading..."
                  : showScheduleGrid
                    ? "Hide Schedule"
                    : "Show Schedule"}
              </Button>
            )}
          </div>
        </PageSection>

        {/* Generate time slots */}
        <PageSection
          title="Generate time slots"
          description="Fills every qualifying day in the exam period with session windows."
        >
          {isLoadingCourses ? (
            <p className="text-sm text-slate-500">Loading courses...</p>
          ) : !hasCourses ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
              No courses found in the database. Import courses first before
              generating time slots.
            </div>
          ) : (
            <form onSubmit={handleGenerateTimeSlots} className="grid gap-4">
              {maxCourseDuration !== null && (
                <p className="text-xs text-slate-500">
                  Longest exam duration across all courses:{" "}
                  <span className="text-slate-300">{maxCourseDuration} min</span>
                  . Slot duration must be between this value and{" "}
                  <span className="text-slate-300">{MAX_SLOT_DURATION} min</span>
                  .
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor="slotDuration">Slot duration (min)</Label>
                <Input
                  id="slotDuration"
                  type="number"
                  min={1}
                  max={MAX_SLOT_DURATION}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(e.target.value)}
                  placeholder={
                    maxCourseDuration !== null
                      ? `${maxCourseDuration} – ${MAX_SLOT_DURATION}`
                      : `1 – ${MAX_SLOT_DURATION}`
                  }
                  className="w-40"
                />
                {durationTooShort && (
                  <p className="text-xs text-red-400">
                    Duration must be at least {maxCourseDuration} min to cover
                    the longest exam.
                  </p>
                )}
                {!Number.isNaN(parsedDuration) &&
                  parsedDuration > MAX_SLOT_DURATION && (
                    <p className="text-xs text-red-400">
                      Duration cannot exceed {MAX_SLOT_DURATION} min.
                    </p>
                  )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={skipLunch}
                    onChange={(e) => setSkipLunch(e.target.checked)}
                  />
                  Skip lunch break{" "}
                  <span className="text-slate-500">(12:00 – 13:00)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeWeekends}
                    onChange={(e) => setIncludeWeekends(e.target.checked)}
                  />
                  Include weekends
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                  />
                  Clear existing slots first{" "}
                  <span className="text-slate-500">(removes all current slots)</span>
                </label>
              </div>

              {sessionPreview.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-500 mb-2">
                    Sessions per day ({sessionPreview.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionPreview.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {s.start_time} – {s.end_time}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  disabled={
                    isGeneratingSlots ||
                    !selectedExamPeriodId ||
                    !durationValid ||
                    sessionPreview.length === 0
                  }
                >
                  {isGeneratingSlots ? "Generating..." : "Generate Slots"}
                </Button>
              </div>
            </form>
          )}
        </PageSection>

        {/* Schedule actions */}
        <PageSection
          title="Schedule actions"
          description="Generate, reset, and inspect schedule results."
        >
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerateSchedule} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Schedule"}
            </Button>

            <Button
              variant="destructive"
              onClick={handleResetSchedule}
              disabled={isResetting || !selectedExamPeriodId}
            >
              {isResetting ? "Resetting..." : "Reset Schedule"}
            </Button>
          </div>

          {report && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-500">Total Exams</p>
                  <p className="mt-1 text-xl font-semibold">
                    {report.summary?.totalExams ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-500">Scheduled</p>
                  <p className="mt-1 text-xl font-semibold text-green-400">
                    {report.summary?.scheduledExams ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-500">Unscheduled</p>
                  <p className="mt-1 text-xl font-semibold text-red-400">
                    {report.summary?.unscheduledExams ?? 0}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-500">Quality Score</p>
                  <p className="mt-1 text-xl font-semibold">
                    {report.scoring?.qualityScore ?? "-"}
                  </p>
                </div>
              </div>

              {(report.unscheduledExams?.length ?? 0) > 0 && (
                <p className="text-xs text-red-400">
                  {report.unscheduledExams.length} exam
                  {report.unscheduledExams.length !== 1 ? "s" : ""} could not be
                  scheduled.
                </p>
              )}

              {report.scoring?.metrics && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-400">Scoring metrics</p>
                  <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    <p className="text-slate-500">
                      Days used:{" "}
                      <span className="text-slate-200">{report.summary?.totalDaysUsed ?? "—"}</span>
                    </p>
                    <p className="text-slate-500">
                      Most crowded day:{" "}
                      <span className="text-slate-200">
                        {report.scoring.metrics.mostCrowdedDay?.date
                          ? `${shortDate(report.scoring.metrics.mostCrowdedDay.date)} (${report.scoring.metrics.mostCrowdedDay.examCount} exams)`
                          : "—"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Same-day student conflicts:{" "}
                      <span className={report.scoring.metrics.sameDayStudentConflicts > 0 ? "text-red-400" : "text-green-400"}>
                        {report.scoring.metrics.sameDayStudentConflicts ?? "—"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Max exams/student/day:{" "}
                      <span className="text-slate-200">{report.scoring.metrics.maxExamsPerStudentPerDay ?? "—"}</span>
                    </p>
                    <p className="text-slate-500">
                      Avg room utilization:{" "}
                      <span className="text-slate-200">
                        {report.scoring.metrics.averageRoomUtilization != null
                          ? `${(report.scoring.metrics.averageRoomUtilization * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      Last scheduled:{" "}
                      <span className="text-slate-200">
                        {report.scoring?.lastScheduledAt
                          ? new Date(report.scoring.lastScheduledAt).toLocaleString()
                          : "—"}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {(report.dayByDaySchedule?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-400">Exams per day</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.dayByDaySchedule.map((day) => (
                      <span
                        key={day.date}
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {shortDate(day.date)}: {day.totalExams}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </PageSection>

        {/* Time slots */}
        <PageSection
          title="Time slots"
          description="Slots for the selected exam period."
        >
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 border-b border-slate-800 bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Start</th>
                  <th className="px-3 py-3 font-medium">End</th>
                  <th className="px-3 py-3 font-medium">Duration</th>
                  <th className="px-3 py-3 font-medium">Active</th>
                </tr>
              </thead>

              <tbody>
                {!isLoadingDetails && timeSlots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-slate-500">
                      No time slots found for this exam period.
                    </td>
                  </tr>
                ) : (
                  timeSlots.map((slot) => (
                    <tr key={slot.id} className="border-b border-slate-900">
                      <td className="px-3 py-3">{formatDate(slot.slot_date)}</td>
                      <td className="px-3 py-3">{formatTime(slot.start_time)}</td>
                      <td className="px-3 py-3">{formatTime(slot.end_time)}</td>
                      <td className="px-3 py-3">{slot.duration_minutes} min</td>
                      <td className="px-3 py-3">
                        {slot.is_active ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PageSection>
      </div>

      {/* Schedule grid — full width */}
      {showScheduleGrid && (
        <PageSection
          title="Schedule grid"
          description="Room × time slot view for each exam day."
        >
          <ScheduleGridView report={scheduleGridReport} />
        </PageSection>
      )}

      {/* Generated exams — full width */}
      <PageSection
        title="Generated exams"
        description="Exam records currently attached to the selected exam period."
      >
        <div className="max-h-72 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 border-b border-slate-800 bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Course</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Time</th>
                <th className="px-3 py-3 font-medium">Instructor</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {!isLoadingDetails && exams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-slate-500">
                    No exams found for this exam period yet.
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="border-b border-slate-900">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-100">
                        {exam.course_code}
                      </div>
                      <div className="text-xs text-slate-500">
                        {exam.course_name}
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatDate(exam.slot_date)}</td>
                    <td className="px-3 py-3">
                      {formatTime(exam.start_time)} –{" "}
                      {formatTime(exam.end_time)}
                    </td>
                    <td className="px-3 py-3">
                      {exam.primary_instructor_name || "-"}
                    </td>
                    <td className="px-3 py-3 capitalize">{exam.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  );
}
