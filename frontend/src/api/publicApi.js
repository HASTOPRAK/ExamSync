import api from "./axios";

export async function getPublicSchedule(studentNo) {
  const { data } = await api.get(`/public/schedule/${encodeURIComponent(studentNo)}`);
  return data; // { success, student, data: [...] }
}

export async function getPublicInstructorSchedule(name) {
  const { data } = await api.get(`/public/instructor-schedule`, { params: { name } });
  return data; // { success, instructors: [...], data: [...] }
}
