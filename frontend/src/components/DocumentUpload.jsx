import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import "./DocumentUpload.css";

const ACCEPT = ".txt,.md,.csv,.pdf,.png,.jpg,.jpeg,.webp";

/**
 * Lets a patient grow their own graph: paste a note or upload a report, and
 * it's folded into their Cognee dataset. Shows what's already been added.
 *
 * props:
 *   code      patient code documents are added to
 *   onAdded   called after a successful add, so the parent can reload the graph
 */
export default function DocumentUpload({ code, onAdded }) {
  const [mode, setMode] = useState("text"); // "text" | "file"
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const fileInputRef = useRef(null);

  const loadDocs = useCallback(async () => {
    try {
      setDocs(await api.listDocuments(code));
    } catch {
      /* ignore — the list is a nice-to-have, not load-bearing */
    }
  }, [code]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === "text" && !text.trim()) return;
    if (mode === "file" && !file) return;

    setBusy(true);
    try {
      if (mode === "text") {
        await api.addDocumentText(code, text.trim());
        setText("");
      } else {
        await api.addDocumentFile(code, file);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      await loadDocs();
      onAdded?.();
    } catch (err) {
      setError(err.message || "Couldn't add that — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel upload-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Add to your record</div>
          <div className="panel-sub">Paste a note or upload a report — it joins your graph</div>
        </div>
      </div>

      <div className="upload-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "text"}
          className={`upload-tab${mode === "text" ? " is-active" : ""}`}
          onClick={() => setMode("text")}
        >
          Paste text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "file"}
          className={`upload-tab${mode === "file" ? " is-active" : ""}`}
          onClick={() => setMode("file")}
        >
          Upload a file
        </button>
      </div>

      <form onSubmit={submit} className="upload-form">
        {mode === "text" ? (
          <textarea
            className="input input-body upload-textarea"
            placeholder="e.g. Clinical note from Dr. Rao, 12 March 2025: diagnosed with..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            disabled={busy}
          />
        ) : (
          <label className="upload-file-drop">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
            <span className="upload-file-icon" aria-hidden>⤒</span>
            <span className="upload-file-text">
              {file ? file.name : "Choose a report — PDF, image, or text"}
            </span>
          </label>
        )}

        <button
          className="btn btn-primary upload-submit"
          type="submit"
          disabled={busy || (mode === "text" ? !text.trim() : !file)}
        >
          {busy ? "Adding to your graph…" : "Add to my record"}
        </button>
        {busy && (
          <p className="upload-wait-hint">
            This reads the document and links it into your graph — it can take up to a
            minute.
          </p>
        )}
        {error && <p className="upload-error">{error}</p>}
      </form>

      {docs.length > 0 && (
        <div className="upload-history">
          <div className="upload-history-label mono">Already added</div>
          {docs.map((d) => (
            <div className="upload-history-row" key={d.id}>
              <span className="upload-history-icon" aria-hidden>
                {d.kind === "file" ? "📄" : "📝"}
              </span>
              <span className="upload-history-name">
                {d.kind === "file" ? d.filename : d.preview || "Note"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
