import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckIcon, Sparkles } from "lucide-react";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getApiErrorMessage } from "@/api/axios";
import { getRooms, getInstructors } from "@/api/dataApi";
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

const initialImportState = {
  file: null,
  previewResult: null,
  commitResult: null,
  isPreviewing: false,
  isCommitting: false,
};

export default function SetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
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
  const [enrollmentsImport, setEnrollmentsImport] = useState(initialImportState);

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
      // counts stay null on error
    } finally {
      setIsLoadingCounts(false);
    }
  }

  useEffect(() => {
    loadCounts();
  }, []);

  const stepCounts = [
    counts.rooms,
    counts.instructors,
    counts.courses,
    counts.students,
    counts.enrollments,
  ];

  async function handleLoadMockData() {
    if (
      !window.confirm(
        "This will load the full CE mock dataset — rooms, instructors, 14 courses, and 490 students. Continue?",
      )
    )
      return;

    try {
      setIsLoadingMock(true);
      const result = await generateCEMockDataset();
      toast.success(result?.message || "CE mock dataset loaded");
      await loadCounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load mock dataset"));
    } finally {
      setIsLoadingMock(false);
    }
  }

  async function handleStepMock(stepId, apiFn) {
    setStepMockLoading((prev) => ({ ...prev, [stepId]: true }));
    try {
      const result = await apiFn();
      toast.success(result?.message || "Mock data loaded");
      await loadCounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load mock data"));
    } finally {
      setStepMockLoading((prev) => ({ ...prev, [stepId]: false }));
    }
  }

  async function handleDownloadTemplate(templateKey, filename) {
    try {
      const blob = await downloadTemplate(templateKey);
      downloadBlob(blob, filename);
      toast.success(`${filename} downloaded`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to download template"));
    }
  }

  function handleFileChange(setter, event) {
    const file = event.target.files?.[0] || null;
    setter((prev) => ({
      ...prev,
      file,
      previewResult: null,
      commitResult: null,
    }));
  }

  async function handlePreview(importState, setter, previewFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }
    try {
      setter((prev) => ({
        ...prev,
        isPreviewing: true,
        previewResult: null,
        commitResult: null,
      }));
      const result = await previewFn(importState.file);
      setter((prev) => ({ ...prev, previewResult: result }));
      toast.success(result?.message || `${label} preview ready`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to preview ${label}`));
    } finally {
      setter((prev) => ({ ...prev, isPreviewing: false }));
    }
  }

  async function handleCommit(importState, setter, commitFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }
    try {
      setter((prev) => ({ ...prev, isCommitting: true, commitResult: null }));
      const result = await commitFn(importState.file);
      setter((prev) => ({ ...prev, commitResult: result }));
      toast.success(result?.message || `${label} import completed`);
      await loadCounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to import ${label}`));
    } finally {
      setter((prev) => ({ ...prev, isCommitting: false }));
    }
  }

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
          Setup
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Data Setup</h2>
        <p className="mt-2 text-sm text-slate-400">
          Populate your account with the data required to run the scheduler.
          Complete all five steps or load the mock dataset to get started
          instantly.
        </p>
      </div>

      {/* Quick start banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4 sm:flex-row sm:items-center">
        <Sparkles className="h-5 w-5 shrink-0 text-slate-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">Quick Start</p>
          <p className="mt-1 text-sm text-slate-400">
            Load the CE mock dataset — a realistic Computer Engineering scenario
            with 10 rooms, 8 faculty + 10 assistants, 14 courses, and 490
            students across all class groups with enrollments.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleLoadMockData}
          disabled={isLoadingMock}
          className="shrink-0"
        >
          {isLoadingMock ? "Loading..." : "Load Mock Data"}
        </Button>
      </div>

      {/* Stepper layout */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-green-600 bg-green-600/10 text-green-400"
                      : active
                        ? "border-slate-500 bg-slate-700 text-white"
                        : "border-slate-700 text-slate-500"
                  }`}
                >
                  {done ? <CheckIcon className="h-3.5 w-3.5" /> : idx + 1}
                </span>

                <span className="flex-1">{s.label}</span>

                {!isLoadingCounts && count !== null && (
                  <span className="text-xs text-slate-500">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Current step panel */}
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
                onNavigate={() => navigate("/data-management")}
                onMock={() => handleStepMock("rooms", loadMockRooms)}
              />
            )}

            {step.id === "instructors" && (
              <StepManualOnly
                label="instructors"
                count={counts.instructors}
                isLoading={isLoadingCounts}
                isMockLoading={stepMockLoading.instructors}
                onNavigate={() => navigate("/data-management")}
                onMock={() => handleStepMock("instructors", loadMockInstructors)}
                note="Instructors are split into faculty (course owners) and assistants (exam supervisors)."
              />
            )}

            {step.id === "courses" && (
              <StepCsvImport
                label="courses"
                count={counts.courses}
                isLoading={isLoadingCounts}
                isMockLoading={stepMockLoading.courses}
                onMock={() => handleStepMock("courses", loadMockCourses)}
                importState={coursesImport}
                onFileChange={(e) => handleFileChange(setCoursesImport, e)}
                onPreview={() =>
                  handlePreview(coursesImport, setCoursesImport, previewCourseImport, "courses")
                }
                onCommit={() =>
                  handleCommit(coursesImport, setCoursesImport, commitCourseImport, "courses")
                }
                onDownload={() => handleDownloadTemplate(step.templateKey, step.templateFile)}
              />
            )}

            {step.id === "students" && (
              <StepCsvImport
                label="students"
                count={counts.students}
                isLoading={isLoadingCounts}
                isMockLoading={stepMockLoading.students}
                onMock={() => handleStepMock("students", loadMockStudents)}
                importState={studentsImport}
                onFileChange={(e) => handleFileChange(setStudentsImport, e)}
                onPreview={() =>
                  handlePreview(studentsImport, setStudentsImport, previewStudentImport, "students")
                }
                onCommit={() =>
                  handleCommit(studentsImport, setStudentsImport, commitStudentImport, "students")
                }
                onDownload={() => handleDownloadTemplate(step.templateKey, step.templateFile)}
              />
            )}

            {step.id === "enrollments" && (
              <StepCsvImport
                label="enrollments"
                count={counts.enrollments}
                isLoading={isLoadingCounts}
                isMockLoading={stepMockLoading.enrollments}
                onMock={() => handleStepMock("enrollments", loadMockEnrollments)}
                importState={enrollmentsImport}
                onFileChange={(e) => handleFileChange(setEnrollmentsImport, e)}
                onPreview={() =>
                  handlePreview(enrollmentsImport, setEnrollmentsImport, previewEnrollmentImport, "enrollments")
                }
                onCommit={() =>
                  handleCommit(enrollmentsImport, setEnrollmentsImport, commitEnrollmentImport, "enrollments")
                }
                onDownload={() => handleDownloadTemplate(step.templateKey, step.templateFile)}
              />
            )}
          </PageSection>

          {/* Prev / Next */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={isFirst}
              onClick={() => setCurrentStep((p) => p - 1)}
            >
              Previous
            </Button>

            {isLast ? (
              <Button onClick={() => navigate("/exam-setup")}>
                Go to Exam Setup →
              </Button>
            ) : (
              <Button onClick={() => setCurrentStep((p) => p + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepManualOnly({ label, count, isLoading, isMockLoading, onNavigate, onMock, note }) {
  return (
    <div className="space-y-4">
      <CountBadge label={label} count={count} isLoading={isLoading} />
      {note && <p className="text-sm text-slate-500">{note}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onNavigate}>
          Go to Data Management
        </Button>
        <Button variant="secondary" onClick={onMock} disabled={isMockLoading}>
          {isMockLoading ? "Loading..." : "Use Mock Data"}
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

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" type="button" onClick={onDownload}>
          Download {label} template
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={onMock} disabled={isMockLoading}>
          {isMockLoading ? "Loading..." : "Use Mock Data"}
        </Button>
      </div>

      <div className="grid gap-2">
        <Label>{label} CSV</Label>
        <Input type="file" accept=".csv,text/csv" onChange={onFileChange} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={onPreview}
          disabled={importState.isPreviewing || !importState.file}
        >
          {importState.isPreviewing ? "Previewing..." : "Preview"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCommit}
          disabled={importState.isCommitting || !importState.file}
        >
          {importState.isCommitting ? "Importing..." : "Commit Import"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total rows", value: summary.totalRows },
            { label: "Valid", value: summary.validRows },
            { label: "Invalid", value: summary.invalidRows },
            { label: "Duplicates", value: summary.duplicateRowsInDatabase },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
            >
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {commitData && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
          <p>
            Inserted:{" "}
            <span className="font-medium text-slate-100">
              {commitData.inserted ?? 0}
            </span>
          </p>
          <p>
            Skipped:{" "}
            <span className="font-medium text-slate-100">
              {commitData.skipped ?? 0}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function CountBadge({ label, count, isLoading }) {
  return (
    <p className="text-sm text-slate-400">
      Currently:{" "}
      <span className="font-medium text-slate-200">
        {isLoading || count === null ? "—" : `${count} ${label}`}
      </span>
    </p>
  );
}
