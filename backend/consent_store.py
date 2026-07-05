"""
Patient-controlled consent, stored in a plain JSON file (no DB, no real auth).

A "grant" is one doctor's access to one patient, moving through:
    pending -> approved -> revoked   (or pending -> denied)

The patient is always in control: they approve, deny, or revoke.
"""
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
CONSENT_FILE = DATA_DIR / "consent.json"

# The single demo clinician identity (prototype has no real auth / accounts).
DEMO_DOCTOR_ID = "DR-7788"

_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _load():
    if not CONSENT_FILE.exists():
        return {"grants": []}
    try:
        return json.loads(CONSENT_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"grants": []}


def _save(state):
    CONSENT_FILE.write_text(json.dumps(state, indent=2))


def _find(grants, doctor_id, patient_code):
    for g in grants:
        if g["doctorId"] == doctor_id and g["patientCode"] == patient_code:
            return g
    return None


def create_request(doctor_id: str, patient_code: str) -> dict:
    """Doctor asks a patient for access. Idempotent per (doctor, patient):
    reuses the existing grant unless it was denied/revoked (then re-opens)."""
    with _lock:
        state = _load()
        g = _find(state["grants"], doctor_id, patient_code)
        if g and g["status"] in ("pending", "approved"):
            return g
        if g:
            # previously denied/revoked -> re-open as pending
            g["status"] = "pending"
            g["updatedAt"] = _now()
        else:
            g = {
                "requestId": f"req_{uuid.uuid4().hex[:12]}",
                "doctorId": doctor_id,
                "patientCode": patient_code,
                "status": "pending",
                "createdAt": _now(),
                "updatedAt": _now(),
            }
            state["grants"].append(g)
        _save(state)
        return g


def list_requests(patient_code: str) -> list:
    """Every grant that concerns this patient (for their consent panel)."""
    state = _load()
    items = [g for g in state["grants"] if g["patientCode"] == patient_code]
    items.sort(key=lambda g: g["updatedAt"], reverse=True)
    return items


def set_status(request_id: str, status: str) -> dict | None:
    with _lock:
        state = _load()
        for g in state["grants"]:
            if g["requestId"] == request_id:
                g["status"] = status
                g["updatedAt"] = _now()
                _save(state)
                return g
    return None


def get_status(doctor_id: str, patient_code: str) -> str:
    """Effective access status for a (doctor, patient) pair."""
    g = _find(_load()["grants"], doctor_id, patient_code)
    return g["status"] if g else "none"


def is_approved(doctor_id: str, patient_code: str) -> bool:
    return get_status(doctor_id, patient_code) == "approved"


def ensure_preapproved(doctor_id: str, patient_code: str):
    """Seed a standing approved grant (idempotent) for a smooth demo."""
    with _lock:
        state = _load()
        g = _find(state["grants"], doctor_id, patient_code)
        if g:
            return
        state["grants"].append({
            "requestId": f"req_{uuid.uuid4().hex[:12]}",
            "doctorId": doctor_id,
            "patientCode": patient_code,
            "status": "approved",
            "createdAt": _now(),
            "updatedAt": _now(),
            "preapproved": True,
        })
        _save(state)
