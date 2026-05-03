import { useEffect, useState } from "react";
import { toast } from "sonner";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getApiErrorMessage } from "@/api/axios";
import {
  clearGeneratedCourses,
  clearGeneratedDataset,
  commitCourseImport,
  commitEnrollmentImport,
  commitStudentImport,
  downloadTemplate,
  generateDemoCourses,
  generateDemoDataset,
  getConflictsPreview,
  getValidationSummary,
  previewCourseImport,
  previewEnrollmentImport,
  previewStudentImport,
} from "@/api/importsApi";
import { downloadBlob } from "@/utils/downloadBlob";

const initialDatasetForm = {
  studentCount: 300,
  minCoursesPerStudent: 4,
  maxCoursesPerStudent: 6,
  studentNoPrefix: "2026",
  courseCodePrefix: "",
  courseFilterMode: "all",
};

const initialCourseGenForm = {
  courseCount: 20,
  courseCodePrefix: "TST",
  startNumber: 101,
  minDuration: 60,
  maxDuration: 90,
};

const initialImportState = {
  file: null,
  previewResult: null,
  commitResult: null,
  isPreviewing: false,
  isCommitting: false,
};

export default function ImportsValidationPage() {
  const [summary, setSummary] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [totalConflictPairs, setTotalConflictPairs] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [studentsImport, setStudentsImport] = useState(initialImportState);
  const [coursesImport, setCoursesImport] = useState(initialImportState);
  const [enrollmentsImport, setEnrollmentsImport] =
    useState(initialImportState);

  const [datasetForm, setDatasetForm] = useState(initialDatasetForm);
  const [courseGenForm, setCourseGenForm] = useState(initialCourseGenForm);

  const [isGeneratingDataset, setIsGeneratingDataset] = useState(false);
  const [isClearingDataset, setIsClearingDataset] = useState(false);
  const [isGeneratingCourses, setIsGeneratingCourses] = useState(false);
  const [isClearingCourses, setIsClearingCourses] = useState(false);

  async function loadPageData() {
    try {
      setIsLoadingPage(true);

      const [summaryRes, conflictsRes] = await Promise.all([
        getValidationSummary(),
        getConflictsPreview(),
      ]);

      setSummary(summaryRes || null);
      setConflicts(conflictsRes?.conflicts || []);
      setTotalConflictPairs(conflictsRes?.totalConflictPairs || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load imports page"));
    } finally {
      setIsLoadingPage(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  function updateImportState(setter, updates) {
    setter((prev) => ({
      ...prev,
      ...updates,
    }));
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

  async function handleDownloadTemplate(type, filename) {
    try {
      const blob = await downloadTemplate(type);
      downloadBlob(blob, filename);
      toast.success(`${filename} downloaded`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to download template"));
    }
  }

  async function handlePreviewImport(importState, setter, previewFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }

    try {
      updateImportState(setter, {
        isPreviewing: true,
        previewResult: null,
        commitResult: null,
      });

      const result = await previewFn(importState.file);

      updateImportState(setter, {
        previewResult: result,
      });

      toast.success(result?.message || `${label} preview ready`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to preview ${label}`));
    } finally {
      updateImportState(setter, {
        isPreviewing: false,
      });
    }
  }

  async function handleCommitImport(importState, setter, commitFn, label) {
    if (!importState.file) {
      toast.error(`Select a ${label} CSV first`);
      return;
    }

    try {
      updateImportState(setter, {
        isCommitting: true,
        commitResult: null,
      });

      const result = await commitFn(importState.file);

      updateImportState(setter, {
        commitResult: result,
      });

      toast.success(result?.message || `${label} import completed`);
      await loadPageData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to commit ${label}`));
    } finally {
      updateImportState(setter, {
        isCommitting: false,
      });
    }
  }

  function handleDatasetFormChange(event) {
    const { name, value } = event.target;

    setDatasetForm((prev) => ({
      ...prev,
      [name]: [
        "studentCount",
        "minCoursesPerStudent",
        "maxCoursesPerStudent",
      ].includes(name)
        ? Number(value)
        : value,
    }));
  }

  function handleCourseGenFormChange(event) {
    const { name, value } = event.target;

    setCourseGenForm((prev) => ({
      ...prev,
      [name]: [
        "courseCount",
        "startNumber",
        "minDuration",
        "maxDuration",
      ].includes(name)
        ? Number(value)
        : value,
    }));
  }

  async function handleGenerateDataset() {
    try {
      setIsGeneratingDataset(true);

      const result = await generateDemoDataset(datasetForm);
      toast.success(result?.message || "Demo dataset generated");

      await loadPageData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate dataset"));
    } finally {
      setIsGeneratingDataset(false);
    }
  }

  async function handleClearDataset() {
    try {
      setIsClearingDataset(true);

      const result = await clearGeneratedDataset({
        studentNoPrefix: datasetForm.studentNoPrefix,
      });

      toast.success(result?.message || "Generated dataset cleared");
      await loadPageData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to clear dataset"));
    } finally {
      setIsClearingDataset(false);
    }
  }

  async function handleGenerateCourses() {
    try {
      setIsGeneratingCourses(true);

      const result = await generateDemoCourses(courseGenForm);
      toast.success(result?.message || "Demo courses generated");

      await loadPageData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate demo courses"));
    } finally {
      setIsGeneratingCourses(false);
    }
  }

  async function handleClearCourses() {
    try {
      setIsClearingCourses(true);

      const result = await clearGeneratedCourses({
        courseCodePrefix: courseGenForm.courseCodePrefix,
      });

      toast.success(result?.message || "Generated courses cleared");
      await loadPageData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to clear demo courses"));
    } finally {
      setIsClearingCourses(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-white">
          Imports & Validation
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          CSV imports and data checks
        </h2>
        <p className="mt-2 text-sm text-white">
          Preview, commit, validate, and generate sample data from one page.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Students", value: summary?.students ?? "--" },
          { title: "Courses", value: summary?.courses ?? "--" },
          { title: "Enrollments", value: summary?.enrollments ?? "--" },
          {
            title: "Conflict Pairs",
            value: isLoadingPage ? "--" : totalConflictPairs,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-white">{item.title}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <PageSection
        title="Template downloads"
        description="Use backend-generated CSV templates so column names match exactly."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() =>
              handleDownloadTemplate("students", "students_template.csv")
            }
          >
            Download Students Template
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              handleDownloadTemplate("courses", "courses_template.csv")
            }
          >
            Download Courses Template
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              handleDownloadTemplate("enrollments", "enrollments_template.csv")
            }
          >
            Download Enrollments Template
          </Button>
        </div>
      </PageSection>

      <div className="grid gap-6 xl:grid-cols-3">
        <ImportCard
          title="Students import"
          state={studentsImport}
          onFileChange={(event) => handleFileChange(setStudentsImport, event)}
          onPreview={() =>
            handlePreviewImport(
              studentsImport,
              setStudentsImport,
              previewStudentImport,
              "students",
            )
          }
          onCommit={() =>
            handleCommitImport(
              studentsImport,
              setStudentsImport,
              commitStudentImport,
              "students",
            )
          }
        />

        <ImportCard
          title="Courses import"
          state={coursesImport}
          onFileChange={(event) => handleFileChange(setCoursesImport, event)}
          onPreview={() =>
            handlePreviewImport(
              coursesImport,
              setCoursesImport,
              previewCourseImport,
              "courses",
            )
          }
          onCommit={() =>
            handleCommitImport(
              coursesImport,
              setCoursesImport,
              commitCourseImport,
              "courses",
            )
          }
        />

        <ImportCard
          title="Enrollments import"
          state={enrollmentsImport}
          onFileChange={(event) =>
            handleFileChange(setEnrollmentsImport, event)
          }
          onPreview={() =>
            handlePreviewImport(
              enrollmentsImport,
              setEnrollmentsImport,
              previewEnrollmentImport,
              "enrollments",
            )
          }
          onCommit={() =>
            handleCommitImport(
              enrollmentsImport,
              setEnrollmentsImport,
              commitEnrollmentImport,
              "enrollments",
            )
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageSection
          title="Demo dataset tools"
          description="Generate students and enrollments against existing courses."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="studentCount">Student Count</Label>
              <Input
                id="studentCount"
                name="studentCount"
                type="number"
                value={datasetForm.studentCount}
                onChange={handleDatasetFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="studentNoPrefix">Student No Prefix</Label>
              <Input
                id="studentNoPrefix"
                name="studentNoPrefix"
                value={datasetForm.studentNoPrefix}
                onChange={handleDatasetFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="minCoursesPerStudent">
                Min Courses / Student
              </Label>
              <Input
                id="minCoursesPerStudent"
                name="minCoursesPerStudent"
                type="number"
                value={datasetForm.minCoursesPerStudent}
                onChange={handleDatasetFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="maxCoursesPerStudent">
                Max Courses / Student
              </Label>
              <Input
                id="maxCoursesPerStudent"
                name="maxCoursesPerStudent"
                type="number"
                value={datasetForm.maxCoursesPerStudent}
                onChange={handleDatasetFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="courseCodePrefix">Course Code Prefix</Label>
              <Input
                id="courseCodePrefix"
                name="courseCodePrefix"
                value={datasetForm.courseCodePrefix}
                onChange={handleDatasetFormChange}
                placeholder="Optional for include/exclude mode"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="courseFilterMode">Course Filter Mode</Label>
              <select
                id="courseFilterMode"
                name="courseFilterMode"
                value={datasetForm.courseFilterMode}
                onChange={handleDatasetFormChange}
                className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="all">all</option>
                <option value="include">include</option>
                <option value="exclude">exclude</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleGenerateDataset}
              disabled={isGeneratingDataset}
            >
              {isGeneratingDataset ? "Generating..." : "Generate Dataset"}
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={handleClearDataset}
              disabled={isClearingDataset}
            >
              {isClearingDataset ? "Clearing..." : "Clear Generated Dataset"}
            </Button>
          </div>
        </PageSection>

        <PageSection
          title="Demo course tools"
          description="Generate test courses quickly for import and scheduling demos."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="courseCount">Course Count</Label>
              <Input
                id="courseCount"
                name="courseCount"
                type="number"
                value={courseGenForm.courseCount}
                onChange={handleCourseGenFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="courseCodePrefixGen">Course Code Prefix</Label>
              <Input
                id="courseCodePrefixGen"
                name="courseCodePrefix"
                value={courseGenForm.courseCodePrefix}
                onChange={handleCourseGenFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startNumber">Start Number</Label>
              <Input
                id="startNumber"
                name="startNumber"
                type="number"
                value={courseGenForm.startNumber}
                onChange={handleCourseGenFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="minDuration">Min Duration</Label>
              <Input
                id="minDuration"
                name="minDuration"
                type="number"
                value={courseGenForm.minDuration}
                onChange={handleCourseGenFormChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="maxDuration">Max Duration</Label>
              <Input
                id="maxDuration"
                name="maxDuration"
                type="number"
                value={courseGenForm.maxDuration}
                onChange={handleCourseGenFormChange}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleGenerateCourses}
              disabled={isGeneratingCourses}
            >
              {isGeneratingCourses ? "Generating..." : "Generate Demo Courses"}
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={handleClearCourses}
              disabled={isClearingCourses}
            >
              {isClearingCourses ? "Clearing..." : "Clear Generated Courses"}
            </Button>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="Conflict preview"
        description="Top shared-student conflict pairs from enrollment data."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-white">
              <tr>
                <th className="px-3 py-3 font-medium">Course 1</th>
                <th className="px-3 py-3 font-medium">Course 2</th>
                <th className="px-3 py-3 font-medium">Shared Students</th>
              </tr>
            </thead>

            <tbody>
              {!isLoadingPage && conflicts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-white">
                    No conflict pairs found.
                  </td>
                </tr>
              ) : (
                conflicts.map((item, index) => (
                  <tr
                    key={`${item.course_1_id}-${item.course_2_id}-${index}`}
                    className="border-b border-slate-900"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-white">
                        {item.course_1_code}
                      </div>
                      <div className="text-xs text-white">
                        {item.course_1_name}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-medium text-white">
                        {item.course_2_code}
                      </div>
                      <div className="text-xs text-white">
                        {item.course_2_name}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-white">
                      {item.shared_students}
                    </td>
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

function ImportCard({ title, state, onFileChange, onPreview, onCommit }) {
  const summary = state.previewResult?.data?.summary;
  const preview = state.previewResult?.data?.preview || [];
  const errors = state.previewResult?.data?.errors || [];
  const commitData = state.commitResult?.data;

  return (
    <PageSection
      title={title}
      description="Pick a CSV, preview the result, then commit when it looks clean."
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>{title} CSV</Label>
          <Input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onPreview}
            disabled={state.isPreviewing}
          >
            {state.isPreviewing ? "Previewing..." : "Preview"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onCommit}
            disabled={state.isCommitting}
          >
            {state.isCommitting ? "Importing..." : "Commit Import"}
          </Button>
        </div>

        {summary ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-sm text-white">Total Rows</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {summary.totalRows}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-sm text-white">Valid Rows</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {summary.validRows}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-sm text-white">Invalid Rows</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {summary.invalidRows}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-sm text-white">Duplicates In DB</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {summary.duplicateRowsInDatabase}
              </p>
            </div>
          </div>
        ) : null}

        {commitData ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-white">
            <p>
              <span className="font-medium">Inserted:</span>{" "}
              {commitData.inserted ?? 0}
            </p>
            <p>
              <span className="font-medium">Skipped:</span>{" "}
              {commitData.skipped ?? 0}
            </p>
          </div>
        ) : null}

        {preview.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-white">Preview rows</p>
            <div className="max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <pre className="whitespace-pre-wrap text-xs text-white">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-white">Errors</p>
            <div className="max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <pre className="whitespace-pre-wrap text-xs text-white">
                {JSON.stringify(errors, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}
