"""
Medi-IQ backend — FastAPI + Cognee (local mode).

The frontend only ever talks to this JSON API; all Cognee/LLM logic is here.
"""
import cognee_config  # noqa: F401  (must run before importing cognee)

PROVIDER = cognee_config.configure_environment()

import cognee  # noqa: E402
from cognee import SearchType  # noqa: E402

cognee_config.apply_cognee_settings()

import uuid  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
from pathlib import Path  # noqa: E402

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import cognee_service  # noqa: E402
import consent_store  # noqa: E402
import patient_store  # noqa: E402
import seed_data  # noqa: E402

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB — generous for a scanned report

# One patient is pre-approved for the demo doctor so the console works out of
# the box; PT-4821 is deliberately left unapproved to show live approval.
PREAPPROVED_PATIENT = "PT-7003"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ingest the synthetic seed data once (persisted; skipped on later starts).
    result = await cognee_service.ingest_seed()
    print(f"[Medi-IQ] seed ingestion: {result}")
    consent_store.ensure_preapproved(consent_store.DEMO_DOCTOR_ID, PREAPPROVED_PATIENT)
    yield


app = FastAPI(title="Medi-IQ Backend", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "provider": PROVIDER}


@app.get("/api/patients")
async def list_patients():
    """Directory of demo patients (code + name)."""
    return [{"code": p["code"], "name": p["name"]} for p in seed_data.PATIENTS]


def _require_known_patient(code: str) -> str:
    code = code.upper()
    if code in seed_data.PATIENTS_BY_CODE or patient_store.get_patient(code):
        return code
    raise HTTPException(status_code=404, detail=f"Unknown patient code: {code}")


@app.get("/api/patients/{code}/graph")
async def patient_graph(code: str, doctorId: str | None = None):
    """Patients always see their own graph (no doctorId). A doctor must pass
    their doctorId and have an approved grant, else 403."""
    code = _require_known_patient(code)
    if doctorId and not consent_store.is_approved(doctorId, code):
        raise HTTPException(
            status_code=403,
            detail=f"Access to {code} is not approved. Request consent first.",
        )
    graph = await cognee_service.get_patient_graph(code)
    return {
        "code": code,
        "name": seed_data.patient_name(code) or patient_store.patient_name(code),
        "nodes": graph["nodes"],
        "edges": graph["edges"],
    }


# ---------------------------------------------------------------------------
# Real patient registration + document upload
# ---------------------------------------------------------------------------

class RegisterPatientBody(BaseModel):
    name: str


@app.post("/api/patients/register")
async def register_patient(body: RegisterPatientBody):
    """Give someone a brand-new patient code — no demo data, just a blank
    graph they'll build by adding their own documents."""
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    record = patient_store.create_patient(name, set(seed_data.PATIENT_CODES))
    return {"code": record["code"], "name": record["name"]}


@app.get("/api/patients/{code}/documents")
async def list_documents(code: str):
    """Metadata only (filename/preview/timestamp) — not the full stored text."""
    code = _require_known_patient(code)
    return [
        {k: v for k, v in d.items() if k != "text"}
        for d in patient_store.list_documents(code)
    ]


@app.post("/api/patients/{code}/documents")
async def add_document(
    code: str,
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    """Add one report/document to a patient's own record. Pasted text or an
    uploaded file (txt/pdf/csv/image) both get folded into their Cognee graph."""
    code = _require_known_patient(code)
    text = (text or "").strip()
    if not text and not file:
        raise HTTPException(status_code=400, detail="Provide some text or a file")

    if file:
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="That file is empty")
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File is too large (max 15 MB)")
        name = file.filename or "upload"
        suffix = Path(name).suffix
        dest = patient_store.UPLOAD_DIR / f"{code}_{uuid.uuid4().hex[:8]}{suffix}"
        dest.write_bytes(raw)

        # Pull the document's full text so the AI agent has everything, then
        # ingest that text into the graph. If we can't extract text (e.g. a
        # scanned PDF), fall back to letting Cognee ingest the file itself.
        extracted = await cognee_service.extract_text_from_file(dest, name)
        try:
            if extracted.strip():
                await cognee_service.ingest_document(code, text=extracted)
            else:
                await cognee_service.ingest_document(code, file_path=str(dest.resolve()))
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Couldn't read that file: {e}")
        meta = {
            "kind": "file",
            "filename": name,
            "text": extracted,
            "preview": (extracted[:80].strip() or name),
        }
    else:
        try:
            await cognee_service.ingest_document(code, text=text)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Couldn't process that note: {e}")
        meta = {"kind": "text", "filename": None, "text": text, "preview": text[:80]}

    doc = patient_store.add_document(code, meta)
    # Don't echo the full document text back to the client — keep the response light.
    return {"document": {k: v for k, v in doc.items() if k != "text"}}


# ---------------------------------------------------------------------------
# Session + consent (Phase 3)
# ---------------------------------------------------------------------------

class SessionBody(BaseModel):
    role: str
    id: str | None = None


class AccessRequestBody(BaseModel):
    doctorId: str
    patientCode: str


class GuardianBody(BaseModel):
    patientCode: str
    newDrug: str
    doctorId: str | None = None


class ChatBody(BaseModel):
    patientCode: str
    message: str
    history: list | None = None
    doctorId: str | None = None


def _require_doctor_access(doctor_id: str | None, code: str):
    """A doctor action requires an approved grant; patient self-actions don't."""
    if doctor_id and not consent_store.is_approved(doctor_id, code):
        raise HTTPException(
            status_code=403,
            detail=f"Access to {code} is not approved.",
        )


@app.post("/api/session")
async def create_session(body: SessionBody):
    """Hand out a demo identity. The prototype has a single demo clinician."""
    if body.role == "doctor":
        ident = consent_store.DEMO_DOCTOR_ID
    else:
        ident = body.id or "patient"
    return {"role": body.role, "id": ident, "token": f"demo-{ident}"}


@app.post("/api/access/request")
async def access_request(body: AccessRequestBody):
    code = _require_known_patient(body.patientCode)
    grant = consent_store.create_request(body.doctorId, code)
    return {"requestId": grant["requestId"], "status": grant["status"]}


@app.get("/api/access/status")
async def access_status(doctorId: str, patientCode: str):
    code = _require_known_patient(patientCode)
    return {"doctorId": doctorId, "patientCode": code,
            "status": consent_store.get_status(doctorId, code)}


@app.get("/api/patients/{code}/requests")
async def patient_requests(code: str):
    code = _require_known_patient(code)
    return consent_store.list_requests(code)


@app.post("/api/access/{request_id}/approve")
async def approve(request_id: str):
    return _set_status_or_404(request_id, "approved")


@app.post("/api/access/{request_id}/deny")
async def deny(request_id: str):
    return _set_status_or_404(request_id, "denied")


@app.post("/api/access/{request_id}/revoke")
async def revoke(request_id: str):
    return _set_status_or_404(request_id, "revoked")


def _set_status_or_404(request_id: str, status: str):
    grant = consent_store.set_status(request_id, status)
    if not grant:
        raise HTTPException(status_code=404, detail="Unknown request id")
    return {"requestId": grant["requestId"], "status": grant["status"]}


# ---------------------------------------------------------------------------
# Silent Guardian (Phase 4)
# ---------------------------------------------------------------------------

@app.post("/api/guardian/check")
async def guardian_check(body: GuardianBody):
    code = _require_known_patient(body.patientCode)
    _require_doctor_access(body.doctorId, code)
    if not body.newDrug or not body.newDrug.strip():
        raise HTTPException(status_code=400, detail="newDrug is required")
    return await cognee_service.guardian_check(code, body.newDrug.strip())


# ---------------------------------------------------------------------------
# AI chat (Phase 5)
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(body: ChatBody):
    code = _require_known_patient(body.patientCode)
    _require_doctor_access(body.doctorId, code)
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    return await cognee_service.chat(code, body.message.strip(), body.history)
