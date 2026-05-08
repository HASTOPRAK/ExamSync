import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import PageSection from "@/components/common/PageSection";
import { Button } from "@/components/ui/button";
import { getValidationSummary } from "@/api/dashboardApi";
import { getExamPeriods } from "@/api/schedulingApi";
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
  const navigate = useNavigate();
  const [summary,     setSummary]     = useState(emptySummary);
  const [examPeriods, setExamPeriods] = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      const [summaryRes, periodsRes] = await Promise.all([
        getValidationSummary(),
        getExamPeriods(),
      ]);
      setSummary(summaryRes || emptySummary);
      setExamPeriods(periodsRes?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load dashboard"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const statCards = useMemo(
    () => [
      { title: "Students",     value: summary.students },
      { title: "Courses",      value: summary.courses },
      { title: "Enrollments",  value: summary.enrollments },
      { title: "Rooms",        value: summary.rooms },
      { title: "Exam Periods", value: summary.examPeriods },
      { title: "Exams",        value: summary.exams },
    ],
    [summary],
  );

  const qualityColor = (score) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 75) return "text-green-500 dark:text-green-400";
    if (score >= 50) return "text-amber-500 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Dashboard</p>
        <h2 className="font-display mt-2 text-3xl font-bold text-foreground">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick snapshot of your data and exam periods.
        </p>
      </div>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {item.title}
            </p>
            <p className="font-display mt-3 text-4xl font-bold text-foreground">
              {isLoading ? (
                <span className="inline-block h-10 w-16 animate-pulse rounded bg-muted" />
              ) : (
                item.value.toLocaleString()
              )}
            </p>
          </div>
        ))}
      </section>

      {/* Exam periods */}
      <PageSection
        title="Exam Periods"
        description="Click a row to view its schedule."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Term</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Range</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>

            <tbody>
              {!isLoading && examPeriods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No exam periods yet.
                  </td>
                </tr>
              ) : isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                examPeriods.map((period) => (
                  <tr
                    key={period.id}
                    onClick={() => navigate(`/exams/${period.id}`)}
                    className="cursor-pointer border-b border-border text-foreground transition-colors hover:bg-accent/50"
                  >
                    <td className="px-3 py-3 font-medium">{period.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{period.academic_year}</td>
                    <td className="px-3 py-3 text-muted-foreground">{period.term}</td>
                    <td className="px-3 py-3 text-muted-foreground">{period.exam_type}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(period.start_date)} – {formatDate(period.end_date)}
                    </td>
                    <td className="px-3 py-3">
                      {period.schedule_quality_score != null ? (
                        <span className={`font-bold text-base ${qualityColor(Number(period.schedule_quality_score))}`}>
                          {Number(period.schedule_quality_score).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-foreground/70">
                        {period.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <Button onClick={() => navigate("/exams/new")}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            New Exam Period
          </Button>
        </div>
      </PageSection>
    </div>
  );
}
