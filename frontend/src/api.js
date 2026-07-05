// The only place the frontend talks to the backend. Everything is JSON over the
// base URL from VITE_API_BASE_URL.

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function readOrThrow(res) {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep status text */
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return readOrThrow(res);
}

// For multipart bodies (file uploads) — no Content-Type header, the browser
// sets the multipart boundary itself.
async function requestForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData });
  return readOrThrow(res);
}

export const api = {
  base: BASE,
  health: () => request("/api/health"),
  listPatients: () => request("/api/patients"),
  getGraph: (code) => request(`/api/patients/${encodeURIComponent(code)}/graph`),

  // Consent (Phase 3)
  createSession: (role, id) =>
    request("/api/session", { method: "POST", body: JSON.stringify({ role, id }) }),
  requestAccess: (doctorId, patientCode) =>
    request("/api/access/request", {
      method: "POST",
      body: JSON.stringify({ doctorId, patientCode }),
    }),
  listRequests: (code) =>
    request(`/api/patients/${encodeURIComponent(code)}/requests`),
  approve: (requestId) => request(`/api/access/${requestId}/approve`, { method: "POST" }),
  deny: (requestId) => request(`/api/access/${requestId}/deny`, { method: "POST" }),
  revoke: (requestId) => request(`/api/access/${requestId}/revoke`, { method: "POST" }),
  accessStatus: (doctorId, patientCode) =>
    request(
      `/api/access/status?doctorId=${encodeURIComponent(doctorId)}&patientCode=${encodeURIComponent(patientCode)}`
    ),

  // Real patients — self-registration + document upload
  registerPatient: (name) =>
    request("/api/patients/register", { method: "POST", body: JSON.stringify({ name }) }),
  listDocuments: (code) => request(`/api/patients/${encodeURIComponent(code)}/documents`),
  addDocumentText: (code, text) => {
    const form = new FormData();
    form.append("text", text);
    return requestForm(`/api/patients/${encodeURIComponent(code)}/documents`, form);
  },
  addDocumentFile: (code, file) => {
    const form = new FormData();
    form.append("file", file);
    return requestForm(`/api/patients/${encodeURIComponent(code)}/documents`, form);
  },

  // Guardian (Phase 4)
  guardianCheck: (patientCode, newDrug, doctorId) =>
    request("/api/guardian/check", {
      method: "POST",
      body: JSON.stringify({ patientCode, newDrug, doctorId }),
    }),

  // Chat (Phase 5)
  chat: (patientCode, message, history, doctorId) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ patientCode, message, history, doctorId }),
    }),
};
