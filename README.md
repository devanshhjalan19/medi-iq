# Medi-IQ

A patient-controlled medical knowledge graph, powered by [Cognee](https://www.cognee.ai/)
(self-hosted, local mode). Two interfaces in one web app — **Doctor** and **Patient**.

A doctor requests access to a patient's graph via a patient code; the patient approves;
the doctor can then explore the patient's full cross-hospital history, run a **Silent
Guardian** drug-safety check that highlights the exact danger path on the graph, and chat
with an AI agent about the patient.

> Prototype using synthetic data. **Not a medical device.**

---

## Architecture

- **`/backend`** — Python + FastAPI + Cognee. All Cognee / LLM / logic lives here.
- **`/frontend`** — React + Vite + `react-force-graph-2d`. Only ever calls the backend's
  JSON API (base URL from `VITE_API_BASE_URL`). It never talks to Cognee or an LLM directly.

The two projects run independently.

## Requirements

- Python 3.11 (3.9–3.12 should work)
- Node 18+
- An LLM API key. Defaults to **Google Gemini** (chat + embeddings from one key).
  OpenAI also works out of the box; Anthropic / OpenRouter need a separate OpenAI
  embedding key.

---

## Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv/Scripts/python -m pip install fastapi "uvicorn[standard]" python-dotenv python-multipart cognee
```

Create `backend/.env` (see `.env.example`):

```
LLM_PROVIDER=gemini
LLM_API_KEY=your_key_here
EMBEDDING_API_KEY=your_key_here      # same key for gemini/openai; OpenAI key for anthropic/openrouter
LLM_MODEL=gemini/gemini-3.1-flash-lite
EMBEDDING_MODEL=gemini/gemini-embedding-001
```

Run it:

```bash
.venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

On first start it ingests the synthetic seed data into Cognee (one LLM/embedding pass,
persisted to `backend/.cognee_system` and `backend/.data_storage`). Later starts detect
the `backend/data/seeded_v1.flag` marker and **skip** ingestion, so restarts are instant
and don't spend the key. To rebuild the graph, delete that flag (or call the ingest with
`force=True`).

## Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

`frontend/.env` holds one variable: `VITE_API_BASE_URL=http://localhost:8000`.

---

## Demo (two browser windows, one laptop)

Patient codes: **PT-4821** (hero case), PT-7003 (pre-approved), PT-5567, PT-3120.

1. **Doctor** window → *I'm a Doctor* → enter `PT-4821` → **Request access** → graph is locked.
2. **Patient** window → *I'm a Patient* → enter `PT-4821` → **Consent panel** shows the request →
   **Approve**. The doctor's graph unlocks live (no refresh).
3. Doctor → **Silent Guardian** → check `penicillin` → **DANGER**, with the reason and the
   exact 2021 danger path (logged by a *different* doctor) glowing on the graph.
4. Doctor → **Ask about this patient** → e.g. "Any past drug reactions?" / "What conditions
   run in the family?" — answers come from the patient's real graph.
5. Back in the Patient window, **Revoke** → the doctor's view re-locks live.

## API

All JSON, prefixed `/api`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/session` | demo identity for a role |
| GET  | `/api/patients` | demo patient directory |
| GET  | `/api/patients/{code}/graph` | patient graph (`?doctorId=` enforces consent) |
| POST | `/api/access/request` | doctor requests access |
| GET  | `/api/access/status` | current access status for a (doctor, patient) |
| GET  | `/api/patients/{code}/requests` | patient's consent list |
| POST | `/api/access/{id}/approve` \| `/deny` \| `/revoke` | patient controls access |
| POST | `/api/guardian/check` | drug-safety check → `{risk, reason, path}` |
| POST | `/api/chat` | AI Q&A grounded in the graph |

Consent is stored in `backend/data/consent.json` (no database, no real auth).
```
