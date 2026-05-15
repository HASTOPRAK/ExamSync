import { useState } from "react";
import { CalendarCheck, Clock, MapPin, Search, User } from "lucide-react";
import { getPublicSchedule, getPublicInstructorSchedule } from "@/api/publicApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/utils/formatDate";
import logoUrl from "@/assets/logo-dark.svg";

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
      <CalendarCheck className="mb-4 h-12 w-12 text-slate-600" />
      <h3 className="text-lg font-medium text-slate-200">No scheduled exams yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {message ?? "No published exams were found. Check back later."}
      </p>
    </div>
  );
}

function RoleBadge({ role }) {
  return role === "faculty" ? (
    <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
      Faculty
    </span>
  ) : (
    <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      Supervisor
    </span>
  );
}

// ── Student schedule ───────────────────────────────────────────────────────────

function StudentTab() {
  const [studentNo, setStudentNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = studentNo.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getPublicSchedule(trimmed);
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, "Student not found. Please check your student number."));
    } finally {
      setLoading(false);
    }
  }

  const grouped = (result?.data ?? []).reduce((acc, exam) => {
    const key = exam.exam_period_name ?? "Unknown Period";
    (acc[key] ??= []).push(exam);
    return acc;
  }, {});

  return (
    <>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h2 className="mb-1 text-xl font-semibold text-white">Check Your Exam Schedule</h2>
        <p className="mb-6 text-sm text-slate-400">
          Enter your student number to view your published exam schedule.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="student-no" className="sr-only">Student Number</Label>
            <Input
              id="student-no"
              type="text"
              placeholder="e.g. 202631009"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              required
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !studentNo.trim()}
            className="bg-white text-slate-900 hover:bg-slate-100"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4">
            <p className="text-lg font-medium text-white">{result.student.full_name}</p>
            <p className="mt-0.5 text-sm text-slate-400">
              {result.student.student_no}
              {result.student.class_no && (
                <> &mdash; Class {result.student.class_no},{" "}
                  {result.student.education_type === "first" ? "First Education" : "Secondary Education"}
                </>
              )}
            </p>
          </div>

          {result.data.length === 0 ? (
            <EmptyState message="No published exams were found for this student. Check back later." />
          ) : (
            Object.entries(grouped).map(([period, exams]) => (
              <section key={period}>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                  {period}
                </h2>
                <div className="space-y-2">
                  {exams.map((exam, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs font-medium text-slate-400">
                          {exam.course_code}
                        </span>
                        <h3 className="mt-0.5 text-base font-medium text-white">
                          {exam.course_name}
                        </h3>
                        {exam.notes && (
                          <p className="mt-1 text-xs text-slate-500">{exam.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-slate-400 sm:flex-col sm:items-end sm:gap-1">
                        {exam.slot_date ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                              {formatDate(exam.slot_date)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              {exam.start_time?.slice(0, 5)} – {exam.end_time?.slice(0, 5)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Date TBA</span>
                        )}
                        {exam.rooms && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {exam.rooms}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </>
  );
}

// ── Instructor schedule ────────────────────────────────────────────────────────

function InstructorTab() {
  const [nameQuery, setNameQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = nameQuery.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getPublicInstructorSchedule(trimmed);
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, "No instructor found with that name."));
    } finally {
      setLoading(false);
    }
  }

  // Group by exam period
  const grouped = (result?.data ?? []).reduce((acc, exam) => {
    const key = exam.exam_period_name ?? "Unknown Period";
    (acc[key] ??= []).push(exam);
    return acc;
  }, {});

  // If multiple instructors matched, show a note
  const matchedInstructors = result?.instructors ?? [];

  return (
    <>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h2 className="mb-1 text-xl font-semibold text-white">Check Instructor Schedule</h2>
        <p className="mb-6 text-sm text-slate-400">
          Enter an instructor's name to view their faculty and supervision duties.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="instructor-name" className="sr-only">Instructor Name</Label>
            <Input
              id="instructor-name"
              type="text"
              placeholder="e.g. Dr. Jane Doe"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              required
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !nameQuery.trim()}
            className="bg-white text-slate-900 hover:bg-slate-100"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="mt-8 space-y-6">
          {/* Matched instructor(s) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4">
            {matchedInstructors.length === 1 ? (
              <>
                <p className="text-lg font-medium text-white">{matchedInstructors[0].full_name}</p>
                <p className="mt-0.5 text-sm capitalize text-slate-400">
                  {matchedInstructors[0].instructor_type}
                  {matchedInstructors[0].email ? ` · ${matchedInstructors[0].email}` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-300">
                  {matchedInstructors.length} instructors matched
                </p>
                <ul className="mt-1 space-y-0.5">
                  {matchedInstructors.map((i) => (
                    <li key={i.id} className="text-sm text-slate-400">
                      {i.full_name}
                      <span className="ml-1.5 capitalize text-slate-500">({i.instructor_type})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {result.data.length === 0 ? (
            <EmptyState message="No published exam duties found for this instructor." />
          ) : (
            Object.entries(grouped).map(([period, exams]) => (
              <section key={period}>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                  {period}
                </h2>
                <div className="space-y-2">
                  {exams.map((exam, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-slate-400">
                            {exam.course_code}
                          </span>
                          <RoleBadge role={exam.role} />
                        </div>
                        <h3 className="mt-0.5 text-base font-medium text-white">
                          {exam.course_name}
                        </h3>
                        {matchedInstructors.length > 1 && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {exam.instructor_name}
                          </p>
                        )}
                        {exam.notes && (
                          <p className="mt-1 text-xs text-slate-500">{exam.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-slate-400 sm:flex-col sm:items-end sm:gap-1">
                        {exam.slot_date ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                              {formatDate(exam.slot_date)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              {exam.start_time?.slice(0, 5)} – {exam.end_time?.slice(0, 5)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Date TBA</span>
                        )}
                        {exam.room_code && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {exam.room_code}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CheckSchedulePage() {
  const [mode, setMode] = useState("student");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <img src={logoUrl} alt="ExamSync" className="h-14 w-auto rounded-xl" />
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setMode("student")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "student"
                ? "bg-white text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Student Schedule
          </button>
          <button
            type="button"
            onClick={() => setMode("instructor")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "instructor"
                ? "bg-white text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Instructor Schedule
          </button>
        </div>

        {mode === "student" ? <StudentTab /> : <InstructorTab />}
      </div>
    </div>
  );
}
