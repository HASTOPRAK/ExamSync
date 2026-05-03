import api from "./axios";

export async function loginUser({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data; // { token, user, profile }
}

export async function registerTeacher({ full_name, email, password }) {
  const { data } = await api.post("/auth/register/teacher", { full_name, email, password });
  return data; // { token, user, instructor }
}

export async function registerStudent({ student_no, password }) {
  const { data } = await api.post("/auth/register/student", { student_no, password });
  return data; // { token, user, student }
}

export async function getMe(token) {
  const { data } = await api.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data; // { user, profile }
}

export async function getMySchedule() {
  const { data } = await api.get("/students/my-schedule");
  return data; // { success, data: [...] }
}
