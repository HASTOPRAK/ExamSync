import { useEffect, useState } from "react";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { getMySchedule } from "@/api/authApi";
import { getApiErrorMessage } from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/utils/formatDate";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 py-20 text-center">
      <CalendarCheck className="mb-4 h-12 w-12 text-slate-600" />
      <h3 className="text-lg font-medium text-slate-200">No exam schedule yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Your exam schedule will appear here once your institution publishes it. Check back later.
      </p>
    </div>
  );
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const [exams, setExams]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMySchedule()
      .then((res) => setExams(res.data ?? []))
      .catch((err) => toast.error(getApiErrorMessage(err, "Failed to load schedule")))
      .finally(() => setLoading(false));
  }, []);

  const grouped = exams.reduce((acc, exam) => {
    const key = exam.exam_period_name ?? "Unknown Period";
    (acc[key] ??= []).push(exam);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">My Exam Schedule</h1>
        {profile && (
          <p className="mt-1 text-sm text-slate-400">
            {profile.full_name} &mdash; Class {profile.class_no},{" "}
            {profile.education_type === "first" ? "First Education" : "Secondary Education"}
          </p>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      )}

      {!loading && exams.length === 0 && <EmptyState />}

      {!loading &&
        Object.entries(grouped).map(([period, periodExams]) => (
          <section key={period}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-400">
              {period}
            </h2>
            <div className="space-y-2">
              {periodExams.map((exam, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Course info */}
                  <div>
                    <span className="text-xs font-mono font-medium text-slate-400">
                      {exam.course_code}
                    </span>
                    <h3 className="mt-0.5 text-base font-medium text-white">
                      {exam.course_name}
                    </h3>
                    {exam.notes && (
                      <p className="mt-1 text-xs text-slate-500">{exam.notes}</p>
                    )}
                  </div>

                  {/* Date / time / room */}
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
        ))}
    </div>
  );
}
