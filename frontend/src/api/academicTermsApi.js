import api from "@/api/axios";

export async function getAcademicTerms() {
  const { data } = await api.get("/academic-terms");
  return data;
}

export async function createAcademicTerm(payload) {
  const { data } = await api.post("/academic-terms", payload);
  return data;
}

export async function updateAcademicTerm(id, payload) {
  const { data } = await api.put(`/academic-terms/${id}`, payload);
  return data;
}

export async function deleteAcademicTerm(id) {
  const { data } = await api.delete(`/academic-terms/${id}`);
  return data;
}
