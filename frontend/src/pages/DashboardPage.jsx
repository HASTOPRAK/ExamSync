import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import PageSection from "@/components/common/PageSection";
import { getValidationSummary, getRecentExamPeriods } from "@/api/dashboardApi";
import { getApiErrorMessage } from "@/api/axios";
import { formatDate } from "@/utils/formatDate";

const emptySummary = {
  students: 0,
  courses: 0,
  enrollments: 0,
  rooms: 0,
  examPeriods: 0,
  timeSlots: 0,
  exams: 0,
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [examPeriods, setExamPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard() {
    try {
      setIsLoading(true);

      const [summaryRes, periodsRes] = await Promise.all([
        getValidationSummary(),
        getRecentExamPeriods(),
      ]);

      setSummary(summaryRes || emptySummary);
      setExamPeriods(periodsRes?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load dashboard"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const statCards = useMemo(
    () => [
      { title: "Students", value: summary.students },
      { title: "Courses", value: summary.courses },
      { title: "Enrollments", value: summary.enrollments },
      { title: "Rooms", value: summary.rooms },
      { title: "Exam Periods", value: summary.examPeriods },
      { title: "Time Slots", value: summary.timeSlots },
      { title: "Exams", value: summary.exams },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
          Dashboard
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          System overview
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Quick snapshot of dataset size and the latest exam periods.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{item.title}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {isLoading ? "--" : item.value}
            </p>
          </div>
        ))}
      </section>

      <PageSection
        title="Recent exam periods"
        description="Latest exam periods from the backend."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Academic Year</th>
                <th className="px-3 py-3 font-medium">Term</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Range</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {!isLoading && examPeriods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-slate-500">
                    No exam periods found yet.
                  </td>
                </tr>
              ) : (
                examPeriods.slice(0, 6).map((period) => (
                  <tr
                    key={period.id}
                    className="border-b border-slate-900 text-slate-200"
                  >
                    <td className="px-3 py-3">{period.name}</td>
                    <td className="px-3 py-3">{period.academic_year}</td>
                    <td className="px-3 py-3">{period.term}</td>
                    <td className="px-3 py-3">{period.exam_type}</td>
                    <td className="px-3 py-3">
                      {formatDate(period.start_date)} -{" "}
                      {formatDate(period.end_date)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs capitalize text-slate-300">
                        {period.status}
                      </span>
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
