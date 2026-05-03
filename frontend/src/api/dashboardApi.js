import api from "@/api/axios";

export async function getValidationSummary() {
  const { data } = await api.get("/validation/summary");
  return data;
}

export async function getRecentExamPeriods() {
  const { data } = await api.get("/exam-periods");
  return data;
}
