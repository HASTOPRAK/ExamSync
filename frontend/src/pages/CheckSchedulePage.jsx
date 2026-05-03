import { useState } from "react";
import { CalendarCheck, Clock, MapPin, Search } from "lucide-react";
import { getPublicSchedule } from "@/api/publicApi";
import { getApiErrorMessage } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/utils/formatDate";
import logoUrl from "@/assets/logo-dark.svg";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
      <CalendarCheck className="mb-4 h-12 w-12 text-slate-600" />
      <h3 className="text-lg font-medium text-slate-200">No scheduled exams yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        No published exams were found for this student. Check back later.
      </p>
    </div>
  );
}

export default function CheckSchedulePage() {
  const [studentNo, setStudentNo]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [result, setResult]         = useState(null); // { student, data }

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
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <img src={logoUrl} alt="ExamSync" className="h-14 w-auto rounded-xl" />
        </div>

        {/* Search card */}
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

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-6">
            {/* Student info */}
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
              <EmptyState />
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
      </div>
    </div>
  );
}
