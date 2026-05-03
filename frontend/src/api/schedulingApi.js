import api from "@/api/axios";

export async function getExamPeriods() {
  const { data } = await api.get("/exam-periods");
  return data;
}

export async function createExamPeriod(payload) {
  const { data } = await api.post("/exam-periods", payload);
  return data;
}

export async function getTimeSlotsByExamPeriod(examPeriodId) {
  const { data } = await api.get(`/time-slots/exam-period/${examPeriodId}`);
  return data;
}

export async function createTimeSlot(payload) {
  const { data } = await api.post("/time-slots", payload);
  return data;
}

export async function generateTimeSlotsForPeriod(payload) {
  const { data } = await api.post("/time-slots/generate", payload);
  return data;
}

export async function generateSchedule(payload) {
  const { data } = await api.post("/schedules/generate", payload);
  return data;
}

export async function resetSchedule(examPeriodId) {
  const { data } = await api.post(`/schedules/${examPeriodId}/reset`);
  return data;
}

export async function getScheduleReport(examPeriodId) {
  const { data } = await api.get(`/schedules/${examPeriodId}/report`);
  return data;
}

export async function getExamsByExamPeriod(examPeriodId) {
  const { data } = await api.get(`/exams/exam-period/${examPeriodId}`);
  return data;
}
