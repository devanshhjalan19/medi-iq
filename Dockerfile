# Medi-IQ backend — built for Google Cloud Run.
# Lives at the repo root so the build is self-contained regardless of how the
# hosting platform points at the repo (no reliance on a "root directory" UI
# setting) — it just copies the backend/ folder in explicitly below.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies first so Docker can cache this layer between deploys.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the actual application code.
COPY backend/ .

ENV PYTHONUNBUFFERED=1
ENV PORT=8080
EXPOSE 8080

# Cloud Run injects PORT at runtime; `exec` ensures uvicorn receives shutdown
# signals directly instead of a wrapping shell swallowing them.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
