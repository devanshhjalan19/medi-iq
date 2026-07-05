"""
Real, user-registered patients — stored in a plain JSON file (no DB, no auth).

seed_data.py holds the synthetic demo patients baked into the code for the
pitch. This module is for real patients: someone registers, we hand them a
fresh PT-#### code, and they build their own graph by adding documents.
"""
import json
import random
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
STORE_FILE = DATA_DIR / "patients.json"
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _load():
    if not STORE_FILE.exists():
        return {"patients": []}
    try:
        return json.loads(STORE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"patients": []}


def _save(state):
    STORE_FILE.write_text(json.dumps(state, indent=2))


def _generate_code(known_codes: set) -> str:
    while True:
        code = f"PT-{random.randint(1000, 9999)}"
        if code not in known_codes:
            return code


def create_patient(name: str, known_codes: set) -> dict:
    """Register a brand-new real patient and hand them a fresh, unique code."""
    with _lock:
        state = _load()
        existing = set(known_codes) | {p["code"] for p in state["patients"]}
        code = _generate_code(existing)
        record = {
            "code": code,
            "name": name.strip(),
            "createdAt": _now(),
            "documents": [],
        }
        state["patients"].append(record)
        _save(state)
        return record


def get_patient(code: str) -> dict | None:
    for p in _load()["patients"]:
        if p["code"] == code:
            return p
    return None


def patient_name(code: str) -> str | None:
    p = get_patient(code)
    return p["name"] if p else None


def add_document(code: str, meta: dict) -> dict | None:
    """Append one document's metadata (never its content) to a patient."""
    with _lock:
        state = _load()
        for p in state["patients"]:
            if p["code"] == code:
                doc = {"id": f"doc_{uuid.uuid4().hex[:10]}", "addedAt": _now(), **meta}
                p["documents"].append(doc)
                _save(state)
                return doc
    return None


def list_documents(code: str) -> list:
    p = get_patient(code)
    return p["documents"] if p else []
