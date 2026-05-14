import { useEffect, useRef, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  FileCheck2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getApiErrorMessage } from "@/api/axios";
import { getRooms, getInstructors } from "@/api/dataApi";
import { seedSchedulerDemo } from "@/api/schedulingApi";
import {
  getAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
} from "@/api/academicTermsApi";
import {
  generateCEMockDataset,
  loadMockRooms,
  loadMockInstructors,
  loadMockCourses,
  loadMockStudents,
  loadMockEnrollments,
  downloadTemplate,
  getValidationSummary,
  previewCourseImport,
  commitCourseImport,
  previewStudentImport,
  commitStudentImport,
  previewEnrollmentImport,
  commitEnrollmentImport,
} from "@/api/importsApi";
import { downloadBlob } from "@/utils/downloadBlob";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "rooms",
    label: "Rooms",
    description:
      "Add exam venues. Room capacity determines how many students can sit per session.",
  },
  {
    id: "instructors",
    label: "Instructors",
    description:
      "Add faculty (course instructors) and assistants (exam supervisors). The scheduler assigns them separately.",
  },
  {
    id: "courses",
    label: "Courses",
    description:
      "Import the course catalog. Each course needs a code, name, and exam duration.",
    templateKey: "courses",
    templateFile: "courses_template.csv",
  },
  {
    id: "students",
    label: "Students",
    description:
      "Import student records. Student number encodes class year and education type.",
    templateKey: "students",
    templateFile: "students_template.csv",
  },
  {
    id: "enrollments",
    label: "Enrollments",
    description:
      "Link students to courses. CSV format: one row per student with all course codes separated by semicolons.",
    templateKey: "enrollments",
    templateFile: "enrollments_template.csv",
  },
];

const TERM_TYPES = ["Fall", "Spring", "Summer"];

const TERM_META = {
  Fall: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
  },
  Spring: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
  },
  Summer: {
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    text: "text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    ring: "ring-sky-500/40",
  },
};

const initialImportState = {
  file: null,
  previewResult: null,
  commitResult: null,
  isPreviewing: false,
  isCommitting: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentAcademicStartYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? y : y - 1;
}

function getVisibleYears() {
  const base = currentAcademicStartYear();
  return [base - 1, base, base + 1].map((y) => `${y}-${y + 1}`);
}

function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str + "T12:00:00+03:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-GB", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" });
}

// ── Quick Start — demo preset metadata ───────────────────────────────────────

const DEMO_PRESETS = [
  {
    name: "easy",
    label: "Easy",
    score: "95–100",
    courses: 15,
    rooms: 8,
    students: 500,
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/40",
    bgClass: "bg-emerald-500/8",
    selectedBg: "bg-emerald-500/15",
  },
  {
    name: "standard",
    label: "Standard",
    score: "85–94",
    courses: 24,
    rooms: 10,
    students: 630,
    dotClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-500/40",
    bgClass: "bg-amber-500/8",
    selectedBg: "bg-amber-500/15",
  },
  {
    name: "stressed",
    label: "Stressed",
    score: "65–80",
    courses: 35,
    rooms: 6,
    students: 200,
    dotClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
    borderClass: "border-rose-500/40",
    bgClass: "bg-rose-500/8",
    selectedBg: "bg-rose-500/15",
  },
];

// ── Quick Start Box ───────────────────────────────────────────────────────────

function QuickStartBox({ counts, isLoading, isLoadingMock, onLoadMock, onDemoSeeded, confirm }) {
  const shouldReduce = useReducedMotion();
  const hasAnyData = !isLoading && Object.values(counts).some((c) => c > 0);
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);

  // Demo preset state
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  useEffect(() => {
    if (!isLoading && !initialized.current) {
      initialized.current = true;
      setOpen(!hasAnyData);
    }
  }, [isLoading, hasAnyData]);

  async function handleSeedDemo() {
    if (!selectedPreset) return;
    const preset = DEMO_PRESETS.find((p) => p.name === selectedPreset);

    const ok = await confirm({
      title: `Load "${preset.label}" demo data?`,
      description: `This replaces ALL rooms, courses, instructors, and student data on your account with the ${preset.label} preset. This cannot be undone.`,
      confirmLabel: "Seed & Test",
      destructive: true,
    });
    if (!ok) return;

    setIsSeedingDemo(true);
    try {
      await seedSchedulerDemo(selectedPreset);
      toast.success(`${preset.label} demo data loaded — ready to schedule`);
      onDemoSeeded?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to seed demo data"));
    } finally {
      setIsSeedingDemo(false);
    }
  }

  const canSeed = selectedPreset && !isSeedingDemo;

  return (
    <div className="relative shrink-0">
      {/* Button always in the layout — holds its space regardless of panel state */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-2.5",
          "text-sm font-semibold text-primary shadow-sm transition-all",
          open
            ? "border-primary/60 bg-linear-to-r from-primary/25 to-violet-500/25"
            : "border-primary/40 bg-linear-to-r from-primary/15 to-violet-500/15 hover:from-primary/25 hover:to-violet-500/25",
        )}
        whileHover={shouldReduce ? {} : { scale: 1.02 }}
        whileTap={shouldReduce ? {} : { scale: 0.98 }}
      >
        <Sparkles className="h-4 w-4" />
        Quick Start
      </motion.button>

      {/* Panel floats above the page — does not shift layout */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl p-px shadow-xl shadow-primary/10"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.635 0.167 228 / 0.35), oklch(0.5 0.2 280 / 0.25))",
            }}
            initial={shouldReduce ? false : { opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
          <div className="rounded-[15px] bg-card/95 p-4">
            {/* Header */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-violet-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Quick Start</p>
                  <p className="text-[10px] text-muted-foreground">mock data &amp; demo presets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Section 1: CE mock dataset ── */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                { label: "Rooms", value: "10" },
                { label: "Instructors", value: "18" },
                { label: "Courses", value: "14" },
                { label: "Students", value: "490" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-primary/5 px-2.5 py-1.5">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-primary">{value}</p>
                </div>
              ))}
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              Realistic CE scenario across all class groups with full enrollments.
            </p>
            <Button
              size="sm"
              className="w-full border-0 bg-linear-to-r from-primary to-violet-500 text-white hover:opacity-90"
              onClick={onLoadMock}
              disabled={isLoadingMock}
            >
              {isLoadingMock ? "Loading dataset…" : "Load CE Mock Data"}
            </Button>

            {/* ── Divider ── */}
            <div className="my-3.5 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground/60">SCHEDULER DEMO</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* ── Section 2: Demo presets ── */}
            <p className="mb-2.5 text-[11px] text-muted-foreground">
              Replace all data with a preset designed to hit a target score band.
            </p>

            {/* Preset chips */}
            <div className="mb-3 flex gap-1.5">
              {DEMO_PRESETS.map((p) => {
                const isSelected = selectedPreset === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSelectedPreset(isSelected ? null : p.name)}
                    className={cn(
                      "flex-1 rounded-lg border px-1.5 py-1.5 text-center transition-all",
                      isSelected
                        ? `${p.selectedBg} ${p.borderClass}`
                        : "border-border bg-muted/30 hover:bg-muted/60",
                    )}
                  >
                    <p className={cn("text-[11px] font-semibold", isSelected ? p.textClass : "text-foreground")}>
                      {p.label}
                    </p>
                    <p className={cn("text-[9px]", isSelected ? p.textClass : "text-muted-foreground")}>
                      {p.score}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected preset stats */}
            {selectedPreset && (() => {
              const p = DEMO_PRESETS.find((x) => x.name === selectedPreset);
              return (
                <div className="mb-3 grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Courses", value: p.courses },
                    { label: "Rooms",   value: p.rooms },
                    { label: "Students", value: p.students },
                  ].map(({ label, value }) => (
                    <div key={label} className={cn("rounded-lg px-2 py-1.5", p.bgClass)}>
                      <p className="text-[9px] text-muted-foreground">{label}</p>
                      <p className={cn("text-xs font-semibold", p.textClass)}>{value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleSeedDemo}
              disabled={!canSeed}
            >
              {isSeedingDemo ? "Seeding…" : "Seed & Test"}
            </Button>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Term Cell ─────────────────────────────────────────────────────────────────

function TermCell({
  year,
  termType,
  existing,
  isEditing,
  editingCell,
  setEditingCell,
  onSave,
  onDelete,
  isSaving,
}) {
  const c = TERM_META[termType] ?? TERM_META.Fall;
  const isSummer = termType === "Summer";

  function openEdit() {
    setEditingCell({
      year,
      term: termType,
      termId: existing?.id ?? null,
      startDate: existing?.semester_start?.split("T")[0] ?? "",
      endDate: existing?.semester_end?.split("T")[0] ?? "",
    });
  }

  // ── Editing state ──
  if (isEditing) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 p-3",
          c.border,
          c.bg,
          "ring-2",
          c.ring,
        )}
      >
        <p className={cn("mb-2.5 text-xs font-semibold", c.text)}>
          {termType} · {year}
        </p>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
              Start
            </label>
            <input
              type="date"
              value={editingCell.startDate}
              onChange={(e) =>
                setEditingCell((p) => ({ ...p, startDate: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5
                         text-xs text-foreground outline-none transition-colors
                         focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
              End
            </label>
            <input
              type="date"
              value={editingCell.endDate}
              onChange={(e) =>
                setEditingCell((p) => ({ ...p, endDate: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5
                         text-xs text-foreground outline-none transition-colors
                         focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90",
              c.dot,
            )}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditingCell(null)}
            className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium
                       text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        {existing && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-1.5 w-full rounded-lg py-1 text-[10px] text-muted-foreground/50
                       transition-colors hover:bg-destructive/5 hover:text-destructive"
          >
            Delete term
          </button>
        )}
      </div>
    );
  }

  // ── Filled state ──
  if (existing) {
    return (
      <button
        type="button"
        onClick={openEdit}
        className={cn(
          "group w-full rounded-xl border p-3 text-left transition-all hover:shadow-sm",
          c.border,
          c.bg,
          isSummer && "py-2",
        )}
      >
        <p className={cn("text-xs font-semibold", c.text)}>{existing.term}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {fmtDate(existing.semester_start)}
          <span className="opacity-40"> – </span>
          {fmtDate(existing.semester_end)}
        </p>
        <p
          className={cn(
            "mt-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-60",
            c.text,
          )}
        >
          Edit
        </p>
      </button>
    );
  }

  // ── Empty state ──
  return (
    <button
      type="button"
      onClick={openEdit}
      className={cn(
        "group w-full rounded-xl border-2 border-dashed p-3 text-left transition-all",
        "border-border/60 hover:border-muted-foreground/40 hover:bg-accent/30",
        isSummer && "py-2",
      )}
    >
      <div className="flex items-center gap-1">
        <Plus className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
        <span className="text-xs text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60">
          {termType}
        </span>
      </div>
    </button>
  );
}

// ── Academic Calendar Grid ────────────────────────────────────────────────────

function AcademicCalendarGrid({
  academicTerms,
  editingCell,
  setEditingCell,
  onSave,
  onDelete,
  isSaving,
}) {
  const years = getVisibleYears();
  const cols = `64px repeat(${years.length}, 1fr)`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-130 space-y-2">
        {/* Year header row */}
        <div className="grid gap-x-3" style={{ gridTemplateColumns: cols }}>
          <div />
          {years.map((year) => (
            <div
              key={year}
              className="pb-1 text-center text-xs font-semibold text-foreground"
            >
              {year}
            </div>
          ))}
        </div>

        {/* Term rows */}
        {TERM_TYPES.map((termType) => (
          <div
            key={termType}
            className="grid items-start gap-x-3"
            style={{ gridTemplateColumns: cols }}
          >
            {/* Row label */}
            <div
              className={cn(
                "flex items-center pt-2.5 text-xs font-medium text-muted-foreground",
                termType === "Summer" && "text-[11px] text-muted-foreground/70",
              )}
            >
              {termType}
            </div>

            {/* Cells */}
            {years.map((year) => {
              const existing = academicTerms.find(
                (t) => t.academic_year === year && t.term === termType,
              );
              const isEdit =
                editingCell?.year === year && editingCell?.term === termType;
              return (
                <TermCell
                  key={`${year}-${termType}`}
                  year={year}
                  termType={termType}
                  existing={existing ?? null}
                  isEditing={isEdit}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  onSave={onSave}
                  onDelete={() => onDelete(existing?.id, `${termType} ${year}`)}
                  isSaving={isSaving}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── File Drop Zone ────────────────────────────────────────────────────────────

function FileDropZone({ label, file, onChange }) {
  const id = `file-${label}`;
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all",
        dragging
          ? "scale-[1.01] border-primary bg-primary/5"
          : file
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/30",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onChange({ target: { files: [f] } });
      }}
      onClick={() => document.getElementById(id)?.click()}
    >
      <input
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onChange}
      />
      {file ? (
        <div className="flex flex-col items-center gap-1.5">
          <FileCheck2 className="h-7 w-7 text-primary" />
          <p className="max-w-50 truncate text-sm font-medium text-foreground">
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">Click to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload className="h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm text-foreground">Drop {label} CSV here</p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </div>
      )}
    </div>
  );
}

// ── Count Badge ───────────────────────────────────────────────────────────────

function CountBadge({ label, count, isLoading }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
        isLoading || count === null
          ? "bg-muted text-muted-foreground"
          : count > 0
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
      )}
    >
      {!isLoading && count !== null && count > 0 && (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {isLoading || count === null
        ? `Loading ${label}…`
        : count > 0
          ? `${count} ${label} loaded`
          : `No ${label} yet`}
    </span>
  );
}

// ── Step sub-components ───────────────────────────────────────────────────────

function StepManualOnly({
  label,
  count,
  isLoading,
  isMockLoading,
  onNavigate,
  onMock,
  note,
}) {
  return (
    <div className="space-y-5">
      <CountBadge label={label} count={count} isLoading={isLoading} />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onNavigate}>Go to Data Management</Button>
        <Button variant="outline" onClick={onMock} disabled={isMockLoading}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {isMockLoading ? "Loading…" : "Use Mock Data"}
        </Button>
      </div>
    </div>
  );
}

function StepCsvImport({
  label,
  count,
  isLoading,
  isMockLoading,
  onMock,
  importState,
  onFileChange,
  onPreview,
  onCommit,
  onDownload,
}) {
  const summary = importState.previewResult?.data?.summary;
  const commitData = importState.commitResult?.data;

  return (
    <div className="space-y-5">
      <CountBadge label={label} count={count} isLoading={isLoading} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Template CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onMock}
          disabled={isMockLoading}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {isMockLoading ? "Loading…" : "Use Mock Data"}
        </Button>
      </div>

      <FileDropZone
        label={label}
        file={importState.file}
        onChange={onFileChange}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onPreview}
          disabled={importState.isPreviewing || !importState.file}
        >
          {importState.isPreviewing ? "Previewing…" : "Preview"}
        </Button>
        <Button
          variant="outline"
          onClick={onCommit}
          disabled={importState.isCommitting || !importState.file}
        >
          {importState.isCommitting ? "Importing…" : "Commit Import"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: summary.totalRows },
            { label: "Valid", value: summary.validRows },
            { label: "Invalid", value: summary.invalidRows },
            { label: "Duplicate", value: summary.duplicateRowsInDatabase },
          ].map(({ label: l, value }) => (
            <div
              key={l}
              className="rounded-xl border border-border bg-muted/40 p-3"
            >
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {commitData && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">
            Inserted:{" "}
            <span className="font-semibold text-foreground">
              {commitData.inserted ?? 0}
            </span>
          </p>
          <p className="text-muted-foreground">
            Skipped:{" "}
            <span className="font-semibold text-foreground">
              {commitData.skipped ?? 0}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const { confirm, ConfirmDialog } = useConfirm();

  const [currentStep, setCurrentStep] = useState(0);
  const [stepperOpen, setStepperOpen] = useState(false);

  const [counts, setCounts] = useState({
    rooms: null,
    instructors: null,
    courses: null,
    students: null,
    enrollments: null,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isLoadingMock, setIsLoadingMock] = useState(false);
  const [stepMockLoading, setStepMockLoading] = useState({
    rooms: false,
    instructors: false,
    courses: false,
    students: false,
    enrollments: false,
  });

  const [coursesImport, setCoursesImport] = useState(initialImportState);
  const [studentsImport, setStudentsImport] = useState(initialImportState);
  const [enrollmentsImport, setEnrollmentsImport] =
    useState(initialImportState);

  // Academic Terms
  const [academicTerms, setAcademicTerms] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [isSavingTerm, setIsSavingTerm] = useState(false);

  async function loadAcademicTerms() {
    try {
      const res = await getAcademicTerms();
      setAcademicTerms(res?.data || []);
    } catch {}
  }

  async function handleCellSave() {
    if (!editingCell) return;
    setIsSavingTerm(true);
    try {
      const payload = {
        academic_year: editingCell.year,
        term: editingCell.term,
        semester_start: editingCell.startDate,
        semester_end: editingCell.endDate,
      };
      if (editingCell.termId) {
        await updateAcademicTerm(editingCell.termId, payload);
        toast.success("Term updated");
      } else {
        await createAcademicTerm(payload);
        toast.success("Term added");
      }
      setEditingCell(null);
      await loadAcademicTerms();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save term"));
    } finally {
      setIsSavingTerm(false);
    }
  }

  async function handleCellDelete(id, label) {
    if (!id) return;
    const ok = await confirm({
      title: `Delete "${label}"?`,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteAcademicTerm(id);
      toast.success("Term deleted");
      setEditingCell(null);
      await loadAcademicTerms();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete term"));
    }
  }

  async function loadCounts() {
    try {
      setIsLoadingCounts(true);
      const [roomsRes, instructorsRes, summaryRes] = await Promise.all([
        getRooms(),
        getInstructors(),
        getValidationSummary(),
      ]);
      setCounts({
        rooms: roomsRes?.data?.length ?? 0,
        instructors: instructorsRes?.data?.length ?? 0,
        courses: summaryRes?.courses ?? 0,
        students: summaryRes?.students ?? 0,
        enrollments: summaryRes?.enrollments ?? 0,
      });
    } catch {
    } finally {
      setIsLoadingCounts(false);
    }
  }

  useEffect(() => {
    loadCounts();
    loadAcademicTerms();
  }, []);

  const stepCounts = [
    counts.rooms,
    counts.instructors,
    counts.courses,
    counts.students,
    counts.enrollments,
  ];

  async function handleLoadMockData() {
    const ok = await confirm({
      title: "Load CE mock dataset?",
      description:
        "This will add 10 rooms, 18 instructors, 14 courses, and 490 students to your account.",
      confirmLabel: "Load",
    });
    if (!ok) return;
    try {
      setIsLoadingMock(true);
      const result = await generateCEMockDataset();
      toast.success(result?.message || "CE mock dataset loaded");
      await loadCounts();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load mock dataset"));
    } finally {
      setIsLoadingMock(false);
    }
  }

  async function handleStepMock(stepId, apiFn) {
    setStepMockLoading((p) => ({ ...p, [stepId]: true }));
    try {
      const result = await apiFn();
      toast.success(result?.message || "Mock data loaded");
      await loadCounts();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load mock data"));
    } finally {
      setStepMockLoading((p) => ({ ...p, [stepId]: false }));
    }
  }

  async function handleDownloadTemplate(templateKey, filename) {
    try {
      const blob = await downloadTemplate(templateKey);
      downloadBlob(blob, filename);
      toast.success(`${filename} downloaded`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to download template"));
    }
  }

  function handleFileChange(setter, event) {
    const file = event.target.files?.[0] || null;
    setter((p) => ({ ...p, file, previewResult: null, commitResult: null }));
  }

  async function handlePreview(importState, setter, previewFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }
    try {
      setter((p) => ({
        ...p,
        isPreviewing: true,
        previewResult: null,
        commitResult: null,
      }));
      const result = await previewFn(importState.file);
      setter((p) => ({ ...p, previewResult: result }));
      toast.success(result?.message || `${label} preview ready`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Failed to preview ${label}`));
    } finally {
      setter((p) => ({ ...p, isPreviewing: false }));
    }
  }

  async function handleCommit(importState, setter, commitFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }
    try {
      setter((p) => ({ ...p, isCommitting: true, commitResult: null }));
      const result = await commitFn(importState.file);
      setter((p) => ({ ...p, commitResult: result }));
      toast.success(result?.message || `${label} import completed`);
      await loadCounts();
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Failed to import ${label}`));
    } finally {
      setter((p) => ({ ...p, isCommitting: false }));
    }
  }

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  const doneCount = stepCounts.filter((c) => c !== null && c > 0).length;

  return (
    <div className="space-y-8">
      {ConfirmDialog}
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Setup
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">
            Data Setup
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Populate your account with the data required to run the scheduler.
            Complete all five steps or load the CE mock dataset to get started
            instantly.
          </p>
        </div>

        <QuickStartBox
          counts={counts}
          isLoading={isLoadingCounts}
          isLoadingMock={isLoadingMock}
          onLoadMock={handleLoadMockData}
          onDemoSeeded={loadCounts}
          confirm={confirm}
        />
      </div>

      {/* ── Academic Calendar ── */}
      <PageSection
        title="Academic Calendar"
        description="Click any cell to set semester dates. Exam windows (midterms at week 8, finals and makeups after the last class day) are calculated automatically."
      >
        <AcademicCalendarGrid
          academicTerms={academicTerms}
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          onSave={handleCellSave}
          onDelete={handleCellDelete}
          isSaving={isSavingTerm}
        />
      </PageSection>

      {/* ── Setup Steps (collapsible) ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setStepperOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/30"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-foreground">
              Setup Steps
            </span>

            {/* Step status pills */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => {
                const count = stepCounts[idx];
                const done = count !== null && count > 0;
                return (
                  <span
                    key={s.id}
                    title={`${s.label}${done ? " ✓" : ""}`}
                    className={cn(
                      "transition-colors",
                      done ? "text-emerald-500" : "text-muted-foreground/40",
                    )}
                  >
                    {isLoadingCounts ? (
                      <Circle className="h-3.5 w-3.5 animate-pulse" />
                    ) : done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                );
              })}
            </div>

            {!isLoadingCounts && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {doneCount}/{STEPS.length}
              </span>
            )}
          </div>

          <motion.span
            animate={shouldReduce ? {} : { rotate: stepperOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {stepperOpen && (
            <motion.div
              initial={shouldReduce ? {} : { height: 0, opacity: 0 }}
              animate={shouldReduce ? {} : { height: "auto", opacity: 1 }}
              exit={shouldReduce ? {} : { height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border p-5">
                <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
                  {/* Step navigator */}
                  <nav className="space-y-1">
                    {STEPS.map((s, idx) => {
                      const count = stepCounts[idx];
                      const done = count !== null && count > 0;
                      const active = idx === currentStep;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setCurrentStep(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                            active
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              done
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : active
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              idx + 1
                            )}
                          </span>
                          <span className="flex-1">{s.label}</span>
                          {!isLoadingCounts && count !== null && count > 0 && (
                            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  {/* Step content */}
                  <div className="space-y-4">
                    <PageSection
                      title={`Step ${currentStep + 1} — ${step.label}`}
                      description={step.description}
                    >
                      {step.id === "rooms" && (
                        <StepManualOnly
                          label="rooms"
                          count={counts.rooms}
                          isLoading={isLoadingCounts}
                          isMockLoading={stepMockLoading.rooms}
                          onNavigate={() => navigate("/data/management")}
                          onMock={() => handleStepMock("rooms", loadMockRooms)}
                        />
                      )}

                      {step.id === "instructors" && (
                        <StepManualOnly
                          label="instructors"
                          count={counts.instructors}
                          isLoading={isLoadingCounts}
                          isMockLoading={stepMockLoading.instructors}
                          onNavigate={() => navigate("/data/management")}
                          onMock={() =>
                            handleStepMock("instructors", loadMockInstructors)
                          }
                          note="Instructors are split into faculty (course owners) and assistants (exam supervisors)."
                        />
                      )}

                      {step.id === "courses" && (
                        <StepCsvImport
                          label="courses"
                          count={counts.courses}
                          isLoading={isLoadingCounts}
                          isMockLoading={stepMockLoading.courses}
                          onMock={() =>
                            handleStepMock("courses", loadMockCourses)
                          }
                          importState={coursesImport}
                          onFileChange={(e) =>
                            handleFileChange(setCoursesImport, e)
                          }
                          onPreview={() =>
                            handlePreview(
                              coursesImport,
                              setCoursesImport,
                              previewCourseImport,
                              "courses",
                            )
                          }
                          onCommit={() =>
                            handleCommit(
                              coursesImport,
                              setCoursesImport,
                              commitCourseImport,
                              "courses",
                            )
                          }
                          onDownload={() =>
                            handleDownloadTemplate(
                              step.templateKey,
                              step.templateFile,
                            )
                          }
                        />
                      )}

                      {step.id === "students" && (
                        <StepCsvImport
                          label="students"
                          count={counts.students}
                          isLoading={isLoadingCounts}
                          isMockLoading={stepMockLoading.students}
                          onMock={() =>
                            handleStepMock("students", loadMockStudents)
                          }
                          importState={studentsImport}
                          onFileChange={(e) =>
                            handleFileChange(setStudentsImport, e)
                          }
                          onPreview={() =>
                            handlePreview(
                              studentsImport,
                              setStudentsImport,
                              previewStudentImport,
                              "students",
                            )
                          }
                          onCommit={() =>
                            handleCommit(
                              studentsImport,
                              setStudentsImport,
                              commitStudentImport,
                              "students",
                            )
                          }
                          onDownload={() =>
                            handleDownloadTemplate(
                              step.templateKey,
                              step.templateFile,
                            )
                          }
                        />
                      )}

                      {step.id === "enrollments" && (
                        <StepCsvImport
                          label="enrollments"
                          count={counts.enrollments}
                          isLoading={isLoadingCounts}
                          isMockLoading={stepMockLoading.enrollments}
                          onMock={() =>
                            handleStepMock("enrollments", loadMockEnrollments)
                          }
                          importState={enrollmentsImport}
                          onFileChange={(e) =>
                            handleFileChange(setEnrollmentsImport, e)
                          }
                          onPreview={() =>
                            handlePreview(
                              enrollmentsImport,
                              setEnrollmentsImport,
                              previewEnrollmentImport,
                              "enrollments",
                            )
                          }
                          onCommit={() =>
                            handleCommit(
                              enrollmentsImport,
                              setEnrollmentsImport,
                              commitEnrollmentImport,
                              "enrollments",
                            )
                          }
                          onDownload={() =>
                            handleDownloadTemplate(
                              step.templateKey,
                              step.templateFile,
                            )
                          }
                        />
                      )}
                    </PageSection>

                    {/* Prev / Next */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        disabled={isFirst}
                        onClick={() => setCurrentStep((p) => p - 1)}
                      >
                        Previous
                      </Button>

                      {isLast ? (
                        <Button onClick={() => navigate("/exams/new")}>
                          Go to Exam Setup →
                        </Button>
                      ) : (
                        <Button onClick={() => setCurrentStep((p) => p + 1)}>
                          Next →
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
