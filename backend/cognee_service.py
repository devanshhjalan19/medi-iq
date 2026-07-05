"""
All Cognee interaction for Medi-IQ lives here:
  - one-time ingestion of the synthetic seed data (persisted, budget-friendly)
  - reading a per-patient subgraph in react-force-graph shape

The FastAPI layer (main.py) only calls these functions; it never touches
Cognee directly.
"""
import json
import os
import re
from pathlib import Path

import cognee
from cognee.infrastructure.databases.graph import get_graph_engine

import patient_store
import seed_data

# File types we can pull text out of for a patient's record.
_TEXT_EXTS = {".txt", ".md", ".csv", ".json", ".log", ""}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp",
               ".tif", ".tiff", ".heic", ".avif"}

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
SEED_MARKER = DATA_DIR / f"seeded_{seed_data.SEED_VERSION}.flag"

# Cognee node "type" values that are plumbing, not medical content.
_INFRASTRUCTURE_TYPES = {"TextDocument", "DocumentChunk", "TextSummary"}


def _dataset_name(code: str) -> str:
    return "ds_" + re.sub(r"[^a-z0-9]+", "_", code.lower())


def _resolve_patient_name(code: str) -> str | None:
    """Name lookup that covers both synthetic seed patients and real,
    user-registered ones."""
    return seed_data.patient_name(code) or patient_store.patient_name(code)


# ---------------------------------------------------------------------------
# Direct LLM + full-text record access
#
# The chat/guardian-reason answers are grounded in the patient's *complete*
# document text (scoped to exactly one patient), not Cognee's cross-graph
# retrieval — which leaks between patients and only surfaces graph-extracted
# entities. This guarantees the answer is about the logged-in patient and can
# use detail the visual graph never captured.
# ---------------------------------------------------------------------------

async def _llm_complete(messages: list) -> str:
    """One chat completion via the same LLM/keys Cognee is configured with."""
    import litellm

    resp = await litellm.acompletion(model=os.environ["LLM_MODEL"], messages=messages)
    return (resp.choices[0].message.content or "").strip()


async def extract_text_from_file(path, filename: str) -> str:
    """Pull readable text out of an uploaded report so the chat agent can use
    every detail — not just what became a graph node."""
    ext = Path(filename).suffix.lower()
    p = str(path)

    if ext in _TEXT_EXTS:
        return Path(p).read_text(encoding="utf-8", errors="ignore")

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(p)
            return "\n".join((pg.extract_text() or "") for pg in reader.pages).strip()
        except Exception:
            return ""

    if ext in _IMAGE_EXTS:
        try:
            from cognee.infrastructure.llm.LLMGateway import LLMGateway
            res = await LLMGateway.transcribe_image(p)
            return (res.choices[0].message.content or "").strip()
        except Exception:
            return ""

    try:
        return Path(p).read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def get_patient_record_text(code: str) -> str:
    """The patient's complete record as plain text — synthetic seed notes for
    demo patients, or the stored full text of every document a real patient
    uploaded. This is the ground truth the AI agent answers from."""
    seed_p = seed_data.PATIENTS_BY_CODE.get(code)
    if seed_p:
        return "\n\n".join(seed_p["documents"])
    parts = []
    for d in patient_store.list_documents(code):
        txt = (d.get("text") or "").strip()
        if txt:
            parts.append(txt)
    return "\n\n".join(parts)


async def ingest_seed(force: bool = False):
    """Ingest every synthetic patient into Cognee exactly once.

    Guarded by a marker file so restarts don't re-spend the LLM key. Pass
    force=True (or delete the marker) to rebuild.
    """
    if SEED_MARKER.exists() and not force:
        return {"status": "already_seeded", "version": seed_data.SEED_VERSION}

    if force:
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)

    for patient in seed_data.PATIENTS:
        code = patient["code"]
        ds = _dataset_name(code)
        for doc in patient["documents"]:
            await cognee.add(doc, dataset_name=ds, node_set=[code])
        await cognee.cognify(datasets=[ds])

    SEED_MARKER.write_text(
        json.dumps({"version": seed_data.SEED_VERSION, "patients": seed_data.PATIENT_CODES})
    )
    _GRAPH_CACHE["data"] = None  # invalidate
    return {"status": "seeded", "version": seed_data.SEED_VERSION}


async def ingest_document(code: str, *, text: str | None = None, file_path: str | None = None):
    """Fold one new document — pasted text or an uploaded file's absolute path
    — into a real patient's dataset, growing their living graph.

    Unlike ingest_seed (one-time, at startup), this runs on demand whenever a
    patient adds something new. cognee.add() tells a file path apart from raw
    text by whether the string is an existing absolute path, so passing an
    absolute Windows/POSIX path here is enough — no special file:// prefix.
    """
    ds = _dataset_name(code)
    source = file_path if file_path is not None else text
    await cognee.add(source, dataset_name=ds, node_set=[code])
    await cognee.cognify(datasets=[ds])
    _GRAPH_CACHE["data"] = None  # invalidate so the next read sees the new nodes


# ---------------------------------------------------------------------------
# Graph reading
# ---------------------------------------------------------------------------

_GRAPH_CACHE = {"data": None}


async def _load_full_graph(refresh: bool = False):
    """Read the whole Cognee graph once and cache it (static after ingest)."""
    if _GRAPH_CACHE["data"] is not None and not refresh:
        return _GRAPH_CACHE["data"]
    ge = await get_graph_engine()
    nodes, edges = await ge.get_graph_data()
    _GRAPH_CACHE["data"] = (nodes, edges)
    return _GRAPH_CACHE["data"]


def invalidate_graph_cache():
    _GRAPH_CACHE["data"] = None


# Map an EntityType name (or entity name) to a display category used for
# colouring nodes on the frontend.
_TYPE_KEYWORDS = [
    ("drug", ["medication", "medicine", "drug", "antibiotic", "inhaler", "tablet"]),
    ("reaction", ["reaction", "allergy", "allergen", "adverse", "anaphyla"]),
    ("diagnosis", ["condition", "disease", "diagnosis", "disorder", "illness",
                    "syndrome", "infection"]),
    ("lab", ["lab", "test", "result", "measurement", "panel", "reading", "level"]),
    ("hospital", ["hospital", "clinic", "facility", "healthcare", "centre", "center"]),
    ("visit", ["visit", "admission", "encounter", "appointment"]),
    ("doctor", ["doctor", "physician", "clinician", "surgeon"]),
    ("date", ["date", "year", "time", "month"]),
    ("person", ["person", "patient", "human", "family", "relative", "father",
                 "mother", "sister", "brother"]),
]

# Fallback keyword match on the entity's own name.
_NAME_KEYWORDS = [
    ("date", [r"^\d{4}$", r"\bage\b"]),
    ("diagnosis", ["diabetes", "hypertension", "asthma", "migraine", "cholesterol",
                    "hypothyroid", "anemia", "gerd", "rhinitis", "fracture",
                    "infection"]),
    ("reaction", ["anaphyla", "allerg", "reaction"]),
    ("drug", ["penicillin", "amoxicillin", "metformin", "amlodipine", "salbutamol",
               "ibuprofen", "cetirizine", "sumatriptan", "levothyroxine", "ferrous",
               "atorvastatin", "omeprazole"]),
    ("hospital", ["hospital", "healthcare", "vellore", "aiims", "apollo", "fortis",
                   "manipal", "medanta", "narayana", "max"]),
]


def _category_from_type_name(type_name: str) -> str | None:
    t = (type_name or "").lower()
    for cat, kws in _TYPE_KEYWORDS:
        if any(kw in t for kw in kws):
            return cat
    return None


def _category_from_entity_name(name: str) -> str:
    n = (name or "").lower()
    for cat, patterns in _NAME_KEYWORDS:
        for p in patterns:
            if p.startswith("^") or "\\" in p:
                if re.search(p, n):
                    return cat
            elif p in n:
                return cat
    return "other"


def _humanize(rel: str) -> str:
    return (rel or "related").replace("_", " ")


async def get_patient_graph(code: str) -> dict:
    """Return the patient's medical subgraph as {nodes, edges} for
    react-force-graph-2d.

    nodes: {id, label, type}
    edges: {source, target, label}
    """
    nodes, edges = await _load_full_graph()

    node_by_id = {str(nid): props for nid, props in nodes}

    # 1) Entities that belong to this patient.
    patient_entity_ids = set()
    for nid, props in nodes:
        if props.get("type") != "Entity":
            continue
        belongs = props.get("belongs_to_set") or []
        if code in belongs:
            patient_entity_ids.add(str(nid))

    # 2) Map each entity -> its EntityType name via `is_a` edges.
    entitytype_name = {}  # entity_id -> type name string
    for src, tgt, rel, _p in edges:
        if rel == "is_a":
            tprops = node_by_id.get(str(tgt), {})
            if tprops.get("type") == "EntityType":
                entitytype_name[str(src)] = tprops.get("name", "")

    patient_name = (_resolve_patient_name(code) or "").lower()

    # 3) Build display nodes.
    out_nodes = []
    for eid in patient_entity_ids:
        props = node_by_id.get(eid, {})
        name = props.get("name", "") or ""
        cat = _category_from_type_name(entitytype_name.get(eid, "")) \
            or _category_from_entity_name(name)
        # The patient themselves is the anchor node.
        if name and patient_name and name.lower() == patient_name:
            cat = "patient"
        out_nodes.append({
            "id": eid,
            "label": name.title() if name else "(unnamed)",
            "type": cat,
        })

    # 4) Build display edges: semantic relationships among this patient's
    #    entities (skip the is_a edges to EntityType nodes).
    out_edges = []
    seen = set()
    for src, tgt, rel, _p in edges:
        s, t = str(src), str(tgt)
        if rel == "is_a":
            continue
        if s in patient_entity_ids and t in patient_entity_ids and s != t:
            key = (s, t, rel)
            if key in seen:
                continue
            seen.add(key)
            out_edges.append({"source": s, "target": t, "label": _humanize(rel)})

    return {"nodes": out_nodes, "edges": out_edges}


# ---------------------------------------------------------------------------
# Silent Guardian — drug-safety check (Phase 4)
# ---------------------------------------------------------------------------

# Cross-reactive drug classes: an allergy to one member is a danger for all.
_DRUG_CLASSES = [
    {"penicillin", "amoxicillin", "ampicillin", "amoxil", "augmentin",
     "co-amoxiclav", "cloxacillin", "flucloxacillin", "benzylpenicillin",
     "piperacillin"},
    {"ibuprofen", "naproxen", "diclofenac", "aspirin", "ketorolac", "nsaid"},
    {"sulfamethoxazole", "sulfonamide", "sulfa", "co-trimoxazole"},
]

# Edge relationships that signal an allergy / adverse reaction.
_REACTION_EDGE_KEYS = ("allerg", "reaction", "adverse", "contraindicat", "anaphyla")


def _expand_drug_terms(drug: str) -> set:
    d = drug.strip().lower()
    terms = {d}
    for cls in _DRUG_CLASSES:
        if d in cls:
            terms |= cls
    return terms


def _label_matches(label: str, terms: set) -> bool:
    l = (label or "").strip().lower()
    if not l:
        return False
    for t in terms:
        if t == l:
            return True
        if len(t) > 3 and (t in l or l in t):
            return True
    return False


async def _guardian_reason(code: str, new_drug: str) -> str | None:
    """Explain the danger in plain clinical language, grounded ONLY in this
    patient's own record (no cross-patient bleed)."""
    name = _resolve_patient_name(code) or code
    record = get_patient_record_text(code).strip()
    if not record:
        return None
    system = (
        f"You are a clinical drug-safety assistant. Using ONLY {name}'s medical "
        f"record below, explain in 1-2 sentences whether prescribing {new_drug} is "
        f"dangerous because of a documented allergy or past adverse reaction. If it "
        f"is dangerous, name the reaction and, when present, the year and who "
        f"recorded it. Use only this patient's record — never another patient's.\n\n"
        f"=== {name}'s RECORD (code {code}) ===\n{record}\n=== END OF RECORD ==="
    )
    try:
        text = await _llm_complete([
            {"role": "system", "content": system},
            {"role": "user", "content": f"Is prescribing {new_drug} dangerous for {name}?"},
        ])
        return text or None
    except Exception:
        return None


async def guardian_check(code: str, new_drug: str) -> dict:
    """Return {risk, reason, path} for prescribing `new_drug` to a patient.

    risk/path are derived deterministically from the patient's graph so the
    highlighted danger path is reliable; the reason is recalled via Cognee.
    """
    graph = await get_patient_graph(code)
    label_by_id = {n["id"]: n["label"] for n in graph["nodes"]}
    terms = _expand_drug_terms(new_drug)
    name = _resolve_patient_name(code) or code

    # Find allergy/reaction edges that involve the new drug (or its class).
    path_nodes = set()
    culprit_drug = None
    for e in graph["edges"]:
        if not any(k in e["label"].lower() for k in _REACTION_EDGE_KEYS):
            continue
        src_lbl, tgt_lbl = label_by_id.get(e["source"], ""), label_by_id.get(e["target"], "")
        if _label_matches(src_lbl, terms) or _label_matches(tgt_lbl, terms):
            path_nodes.add(e["source"])
            path_nodes.add(e["target"])
            # remember the actual drug name that triggered the flag
            if _label_matches(src_lbl, terms):
                culprit_drug = src_lbl
            elif _label_matches(tgt_lbl, terms):
                culprit_drug = tgt_lbl

    if path_nodes:
        reason = await _guardian_reason(code, new_drug)
        if not reason:
            cross = culprit_drug and culprit_drug.lower() != new_drug.strip().lower()
            reason = (
                f"{name} has a recorded allergy/adverse reaction to "
                f"{culprit_drug or new_drug}"
                + (f", which is cross-reactive with {new_drug}. " if cross else ". ")
                + f"Prescribing {new_drug} risks a repeat reaction."
            )
        return {"risk": "danger", "reason": reason, "path": list(path_nodes)}

    return {
        "risk": "none",
        "reason": (
            f"No recorded allergy or adverse reaction to {new_drug} was found in "
            f"{name}'s history across the linked hospitals. No conflict detected."
        ),
        "path": [],
    }


# ---------------------------------------------------------------------------
# AI chat about the patient (Phase 5)
# ---------------------------------------------------------------------------

async def chat(code: str, message: str, history: list | None = None) -> dict:
    """Answer a doctor's question grounded in the logged-in patient's COMPLETE
    record text — scoped to exactly this patient, and richer than the graph."""
    name = _resolve_patient_name(code) or code
    record = get_patient_record_text(code).strip()

    if not record:
        return {
            "reply": (
                f"There are no documents in {name}'s record yet, so there's nothing "
                f"for me to answer from. Ask the patient to add their reports."
            ),
            "citedNodes": [],
        }

    convo = ""
    if history:
        lines = []
        for h in history[-6:]:
            who = "Doctor" if h.get("role") == "user" else "Assistant"
            lines.append(f"{who}: {h.get('content', '')}")
        convo = "\n\nEarlier in this conversation:\n" + "\n".join(lines)

    system = (
        f"You are a clinical assistant helping a doctor understand patient {name} "
        f"(record code {code}). Answer ONLY from the medical record provided below. "
        f"Never use information about any other patient. If the record does not "
        f"contain the answer, say plainly that it isn't in {name}'s record. Be "
        f"concise, specific, and factual — cite dates, hospitals, doctors, drugs, "
        f"diagnoses, and lab values when they appear in the record.{convo}\n\n"
        f"=== BEGIN {name}'s COMPLETE MEDICAL RECORD (code {code}) ===\n"
        f"{record}\n"
        f"=== END OF RECORD ==="
    )

    try:
        reply = await _llm_complete([
            {"role": "system", "content": system},
            {"role": "user", "content": message},
        ]) or "I couldn't find anything about that in the record."
    except Exception:
        reply = "Sorry — I ran into an error reading the record. Please try again."

    # Cited nodes: graph entities whose name appears in the answer (for UI chips).
    graph = await get_patient_graph(code)
    reply_l = reply.lower()
    cited = [
        {"id": n["id"], "label": n["label"], "type": n["type"]}
        for n in graph["nodes"]
        if n["label"] and len(n["label"]) > 2 and n["label"].lower() in reply_l
    ]
    return {"reply": reply, "citedNodes": cited}
