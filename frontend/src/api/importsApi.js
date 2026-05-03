import api from "@/api/axios";

function buildFormData(file) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export async function downloadTemplate(type) {
  const { data } = await api.get(`/imports/templates/${type}`, {
    responseType: "blob",
  });

  return data;
}

export async function previewStudentImport(file) {
  const { data } = await api.post(
    "/imports/students/preview",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function commitStudentImport(file) {
  const { data } = await api.post(
    "/imports/students/commit",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function previewCourseImport(file) {
  const { data } = await api.post(
    "/imports/courses/preview",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function commitCourseImport(file) {
  const { data } = await api.post(
    "/imports/courses/commit",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function previewEnrollmentImport(file) {
  const { data } = await api.post(
    "/imports/enrollments/preview",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function commitEnrollmentImport(file) {
  const { data } = await api.post(
    "/imports/enrollments/commit",
    buildFormData(file),
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function getValidationSummary() {
  const { data } = await api.get("/validation/summary");
  return data;
}

export async function getConflictsPreview() {
  const { data } = await api.get("/validation/conflicts-preview");
  return data;
}

export async function generateDemoDataset(payload) {
  const { data } = await api.post("/imports/dev/generate-dataset", payload);
  return data;
}

export async function clearGeneratedDataset(payload) {
  const { data } = await api.delete("/imports/dev/clear-generated-data", {
    data: payload,
  });
  return data;
}

export async function generateDemoCourses(payload) {
  const { data } = await api.post("/imports/dev/generate-courses", payload);
  return data;
}

export async function clearGeneratedCourses(payload) {
  const { data } = await api.delete("/imports/dev/clear-generated-courses", {
    data: payload,
  });
  return data;
}
