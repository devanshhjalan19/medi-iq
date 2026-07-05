"""
Central place that turns the simple 3-line .env into the full set of
environment variables Cognee (via LiteLLM) needs for chat + embeddings.

The frontend never touches any of this — all LLM/Cognee logic lives here.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent

# Load the simple .env the user edits.
load_dotenv(BACKEND_DIR / ".env")

PROVIDER = (os.getenv("LLM_PROVIDER") or "gemini").strip().lower()
LLM_API_KEY = (os.getenv("LLM_API_KEY") or "").strip()
EMBEDDING_API_KEY = (os.getenv("EMBEDDING_API_KEY") or "").strip()

# Optional overrides from .env (blank -> provider default below).
LLM_MODEL_OVERRIDE = (os.getenv("LLM_MODEL") or "").strip()
EMBEDDING_MODEL_OVERRIDE = (os.getenv("EMBEDDING_MODEL") or "").strip()


def _set(name: str, value: str):
    if value is not None and value != "":
        os.environ[name] = value


def configure_environment():
    """Translate LLM_PROVIDER + keys into the env vars Cognee reads."""

    if not LLM_API_KEY or LLM_API_KEY.startswith("PASTE_"):
        raise RuntimeError(
            "LLM_API_KEY is not set. Edit backend/.env and paste your key."
        )

    # ---- Chat model ----
    if PROVIDER == "gemini":
        _set("LLM_PROVIDER", "gemini")
        _set("LLM_MODEL", LLM_MODEL_OVERRIDE or "gemini/gemini-3.1-flash-lite")
        _set("LLM_API_KEY", LLM_API_KEY)
        # LiteLLM reads GEMINI_API_KEY for both chat and embeddings.
        _set("GEMINI_API_KEY", LLM_API_KEY)
        # Embeddings via Gemini (same key). gemini-embedding-001 -> 3072 dims.
        _set("EMBEDDING_PROVIDER", "gemini")
        _set("EMBEDDING_MODEL", EMBEDDING_MODEL_OVERRIDE or "gemini/gemini-embedding-001")
        _set("EMBEDDING_DIMENSIONS", "3072")
        _set("EMBEDDING_MAX_TOKENS", "2048")
        _set("EMBEDDING_API_KEY", LLM_API_KEY)

    elif PROVIDER == "openai":
        _set("LLM_PROVIDER", "openai")
        _set("LLM_MODEL", "gpt-4o-mini")
        _set("LLM_API_KEY", LLM_API_KEY)
        _set("OPENAI_API_KEY", LLM_API_KEY)
        _set("EMBEDDING_PROVIDER", "openai")
        _set("EMBEDDING_MODEL", "text-embedding-3-small")
        _set("EMBEDDING_DIMENSIONS", "1536")
        _set("EMBEDDING_API_KEY", LLM_API_KEY)

    elif PROVIDER in ("anthropic", "openrouter"):
        # Chat provider has no embeddings -> use OpenAI embeddings.
        if PROVIDER == "anthropic":
            _set("LLM_PROVIDER", "anthropic")
            _set("LLM_MODEL", "claude-3-5-sonnet-20241022")
            _set("ANTHROPIC_API_KEY", LLM_API_KEY)
        else:  # openrouter
            _set("LLM_PROVIDER", "openrouter")
            _set("LLM_MODEL", "openrouter/openai/gpt-4o-mini")
            _set("OPENROUTER_API_KEY", LLM_API_KEY)
        _set("LLM_API_KEY", LLM_API_KEY)

        if not EMBEDDING_API_KEY:
            raise RuntimeError(
                f"LLM_PROVIDER={PROVIDER} has no embeddings. "
                "Set EMBEDDING_API_KEY (an OpenAI key) in backend/.env."
            )
        _set("EMBEDDING_PROVIDER", "openai")
        _set("EMBEDDING_MODEL", "text-embedding-3-small")
        _set("EMBEDDING_DIMENSIONS", "1536")
        _set("EMBEDDING_API_KEY", EMBEDDING_API_KEY)
        _set("OPENAI_API_KEY", EMBEDDING_API_KEY)

    else:
        raise RuntimeError(f"Unknown LLM_PROVIDER: {PROVIDER}")

    # Prototype: no real auth / multi-user. Disable Cognee's access control
    # so add()/cognify()/search() work with the default user.
    _set("ENABLE_BACKEND_ACCESS_CONTROL", "false")

    # We validate the embedding/LLM connection ourselves; Cognee's built-in
    # 30s pre-flight probe is flaky against Gemini's async endpoint.
    _set("COGNEE_SKIP_CONNECTION_TEST", "true")

    # Keep all Cognee data inside the backend folder so it's easy to reset.
    _set("DATA_ROOT_DIRECTORY", str(BACKEND_DIR / ".data_storage"))
    _set("SYSTEM_ROOT_DIRECTORY", str(BACKEND_DIR / ".cognee_system"))

    return PROVIDER


def apply_cognee_settings():
    """Belt-and-suspenders: push key settings through the cognee.config API
    too, in case env-var names differ across cognee versions. Call this AFTER
    `import cognee`."""
    import cognee

    cognee.config.system_root_directory(str(BACKEND_DIR / ".cognee_system"))
    cognee.config.data_root_directory(str(BACKEND_DIR / ".data_storage"))

    # Run Kuzu/vector DB in-process. The subprocess workers can orphan on an
    # unclean shutdown and hold a file lock on the graph DB, which then blocks
    # the next startup. In-process avoids that for a single-server prototype.
    try:
        cognee.config.set_graph_database_subprocess_enabled(False)
        cognee.config.set_vector_db_subprocess_enabled(False)
    except Exception:
        pass

    cognee.config.set_llm_provider(os.environ["LLM_PROVIDER"])
    cognee.config.set_llm_model(os.environ["LLM_MODEL"])
    cognee.config.set_llm_api_key(os.environ["LLM_API_KEY"])

    cognee.config.set_embedding_provider(os.environ["EMBEDDING_PROVIDER"])
    cognee.config.set_embedding_model(os.environ["EMBEDDING_MODEL"])
    cognee.config.set_embedding_dimensions(int(os.environ["EMBEDDING_DIMENSIONS"]))
    cognee.config.set_embedding_api_key(os.environ["EMBEDDING_API_KEY"])
