import { useCallback, useEffect, useRef, useState } from "react";
import GraphView from "../components/GraphView.jsx";
import DocumentUpload from "../components/DocumentUpload.jsx";
import { useGraph } from "../hooks/useGraph";
import { api } from "../api";
import "./consent.css";

const LAST_CODE_KEY = "mediiq_last_patient_code";

export default function PatientView() {
  const [entered, setEntered] = useState("");
  const [code, setCode] = useState("");
  const [justRegistered, setJustRegistered] = useState(false);

  // Registration (new-patient) flow.
  const [registering, setRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState(null);

  const { data, loading, error, reload } = useGraph(code, !!code);

  useEffect(() => {
    const remembered = localStorage.getItem(LAST_CODE_KEY);
    if (remembered) setEntered(remembered);
  }, []);

  const openCode = (c) => {
    const clean = c.trim().toUpperCase();
    if (!clean) return;
    setCode(clean);
    localStorage.setItem(LAST_CODE_KEY, clean);
  };

  const submit = (e) => {
    e.preventDefault();
    setJustRegistered(false);
    openCode(entered);
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    const name = regName.trim();
    if (!name) return;
    setRegBusy(true);
    setRegError(null);
    try {
      const r = await api.registerPatient(name);
      setEntered(r.code);
      openCode(r.code);
      setJustRegistered(true);
      setRegistering(false);
      setRegName("");
    } catch (err) {
      setRegError(err.message || "Couldn't create your record — please try again.");
    } finally {
      setRegBusy(false);
    }
  };

  const reset = () => {
    setCode("");
    setEntered("");
    setJustRegistered(false);
  };

  return (
    <div className="view">
      <div className="view-head">
        <h1 className="view-title">Patient portal</h1>
        <p className="view-subtitle">
          Your complete medical history as one graph. You decide who can see it.
        </p>
      </div>

      <div className="console">
        <div className="console-side">
          {!code ? (
            <div className="panel">
              <form onSubmit={submit}>
                <label className="field-label" htmlFor="pt-code">Your patient code</label>
                <input
                  id="pt-code"
                  className="input"
                  placeholder="e.g. PT-4821"
                  value={entered}
                  onChange={(e) => setEntered(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} type="submit">
                  Open my record
                </button>
              </form>

              <div className="entry-divider"><span>or</span></div>

              {!registering ? (
                <button
                  className="btn btn-ghost"
                  style={{ width: "100%" }}
                  type="button"
                  onClick={() => setRegistering(true)}
                >
                  New here? Create my patient record
                </button>
              ) : (
                <form onSubmit={submitRegister}>
                  <label className="field-label" htmlFor="pt-name">Your name</label>
                  <input
                    id="pt-name"
                    className="input input-body"
                    placeholder="Full name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 12, width: "100%" }}
                    type="submit"
                    disabled={regBusy || !regName.trim()}
                  >
                    {regBusy ? "Creating…" : "Create my record"}
                  </button>
                  {regError && <p className="upload-error" style={{ marginTop: 10 }}>{regError}</p>}
                </form>
              )}
            </div>
          ) : (
            <div className="panel">
              {justRegistered && (
                <div className="new-code-callout">
                  <div className="new-code-label mono">Your patient code — save it</div>
                  <div className="new-code-row">
                    <span className="new-code-value mono">{code}</span>
                    <CopyButton value={code} />
                  </div>
                  <p className="new-code-hint">
                    This is how doctors will find your record. It only unlocks after you
                    approve their request.
                  </p>
                </div>
              )}
              <p className="status-line">
                <span className="dot dot-approved" /> Viewing&nbsp;<span className="mono">{code}</span>
              </p>
              <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }} type="button" onClick={reset}>
                Switch patient code
              </button>
            </div>
          )}

          {code && <ConsentPanel code={code} />}
          {code && <DocumentUpload code={code} onAdded={reload} />}
        </div>

        <div className="console-graph">
          <GraphView
            data={data}
            loading={loading}
            error={error}
            emptyHint="Add a document on the left to start building your graph."
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard API unavailable — silently ignore */
    }
  };
  return (
    <button className="btn btn-ghost btn-sm" type="button" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ConsentPanel({ code }) {
  const [requests, setRequests] = useState([]);
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setRequests(await api.listRequests(code));
    } catch {
      /* ignore */
    }
  }, [code]);

  const timer = useRef(null);
  useEffect(() => {
    load();
    timer.current = setInterval(load, 2500);
    return () => clearInterval(timer.current);
  }, [load]);

  const act = async (id, action) => {
    setActingId(id);
    try {
      await api[action](id);
      await load();
    } finally {
      setActingId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const active = requests.filter((r) => r.status === "approved");
  const past = requests.filter((r) => r.status === "denied" || r.status === "revoked");

  return (
    <div className="panel consent-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Consent panel</div>
          <div className="panel-sub">Who can see your record</div>
        </div>
        <span className="consent-live mono">● live</span>
      </div>

      {pending.length === 0 && active.length === 0 && (
        <p className="hint-text">
          No access requests yet. When a doctor requests your record, it appears here for
          you to approve or deny.
        </p>
      )}

      {pending.map((r) => (
        <div className="consent-row consent-pending" key={r.requestId}>
          <div className="consent-row-main">
            <span className="dot dot-pending" />
            <div>
              <div className="consent-doctor mono">{r.doctorId}</div>
              <div className="consent-meta">is requesting access</div>
            </div>
          </div>
          <div className="consent-actions">
            <button className="btn btn-approve btn-sm" disabled={actingId === r.requestId}
                    onClick={() => act(r.requestId, "approve")}>Approve</button>
            <button className="btn btn-ghost btn-sm" disabled={actingId === r.requestId}
                    onClick={() => act(r.requestId, "deny")}>Deny</button>
          </div>
        </div>
      ))}

      {active.map((r) => (
        <div className="consent-row consent-active" key={r.requestId}>
          <div className="consent-row-main">
            <span className="dot dot-approved" />
            <div>
              <div className="consent-doctor mono">{r.doctorId}</div>
              <div className="consent-meta">has active access{r.preapproved ? " · pre-approved" : ""}</div>
            </div>
          </div>
          <div className="consent-actions">
            <button className="btn btn-danger btn-sm" disabled={actingId === r.requestId}
                    onClick={() => act(r.requestId, "revoke")}>Revoke</button>
          </div>
        </div>
      ))}

      {past.map((r) => (
        <div className="consent-row consent-past" key={r.requestId}>
          <div className="consent-row-main">
            <span className={`dot dot-${r.status}`} />
            <div>
              <div className="consent-doctor mono">{r.doctorId}</div>
              <div className="consent-meta">{r.status}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
