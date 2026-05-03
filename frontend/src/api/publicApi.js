import api from "./axios";

export async function getPublicSchedule(studentNo) {
  const { data } = await api.get(`/public/schedule/${encodeURIComponent(studentNo)}`);
  return data; // { success, student, data: [...] }
}
