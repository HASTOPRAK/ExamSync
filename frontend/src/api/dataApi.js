import api from "@/api/axios";

export async function getStudents() {
  const { data } = await api.get("/students");
  return data;
}

export async function getStudentSchedule(studentId) {
  const { data } = await api.get(`/students/${studentId}/schedule`);
  return data;
}

export async function getRooms() {
  const { data } = await api.get("/rooms");
  return data;
}

export async function createRoom(payload) {
  const { data } = await api.post("/rooms", payload);
  return data;
}

export async function updateRoom(id, payload) {
  const { data } = await api.put(`/rooms/${id}`, payload);
  return data;
}

export async function toggleRoomActive(id) {
  const { data } = await api.patch(`/rooms/${id}/toggle-active`);
  return data;
}

export async function deleteRoom(id) {
  const { data } = await api.delete(`/rooms/${id}`);
  return data;
}

export async function getCourses() {
  const { data } = await api.get("/courses");
  return data;
}

export async function getInstructors() {
  const { data } = await api.get("/instructors");
  return data;
}

export async function createInstructor(payload) {
  const { data } = await api.post("/instructors", payload);
  return data;
}

export async function updateInstructor(id, payload) {
  const { data } = await api.put(`/instructors/${id}`, payload);
  return data;
}

export async function deleteInstructor(id) {
  const { data } = await api.delete(`/instructors/${id}`);
  return data;
}

export async function getAssignmentsByCourse(courseId) {
  const { data } = await api.get(`/course-instructors/course/${courseId}`);
  return data;
}

export async function assignInstructorToCourse(payload) {
  const { data } = await api.post("/course-instructors", payload);
  return data;
}

export async function removeInstructorFromCourse(courseId, instructorId) {
  const { data } = await api.delete(
    `/course-instructors/course/${courseId}/instructor/${instructorId}`,
  );
  return data;
}
