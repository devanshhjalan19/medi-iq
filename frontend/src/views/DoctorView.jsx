import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GraphView from "../components/GraphView.jsx";
import GuardianPanel from "../components/GuardianPanel.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { useGraph } from "../hooks/useGraph";
import { useSession } from "../hooks/useSession";
import { api } from "../api";

const STATUS_UI = {
  none:     { dot: "dot-locked",   text: "Not requested yet" },
  pending:  { dot: "dot-pending",  text: "Waiting for patient approval…" },
  approved: { dot: "dot-approved", text: "Access approved" },
  denied:   { dot: "dot-denied",   text: "Patient denied access" },
  revoked:  { dot: "dot-revoked",  text: "Access was revoked" },
};

export default function DoctorView() {
  const session = useSession("doctor");
  const doctorId = session?.id;

  const [entered, setEntered] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);

  const approved = status === "approved";
  const { data, loading, error } = useGraph(code, approved, status);

  // Silent Guardian state.
  const [guardian, setGuardian] = useState(null); // {risk, reason, path, drug}
  const [checking, setChecking] = useState(false);

  const runGuardian = async (drug) => {
    setChecking(true);
    try {
      const res = await api.guardianCheck(code, drug, doctorId);
      setGuardian({ ...res, drug });
    } catch (err) {
      alert(err.message);
    } finally {
      setChecking(false);
    }
  };

  // Build the graph highlight from the returned danger path.
  const highlight = useMemo(() => {
    if (!guardian || guardian.risk === "none" || !data) return null;
    const nodes = new Set(guardian.path || []);
    const edges = new Set();
    for (const e of data.edges) {
      if (nodes.has(e.source) && nodes.has(e.target)) edges.add(`${e.source}->${e.target}`);
    }
    return { nodes, edges, tone: "danger" };
  }, [guardian, data]);

  // Poll access status until approved (or the code is cleared).
  const poll = useCallback(async () => {
    if (!code || !doctorId) return;
    try {
      const r = await api.accessStatus(doctorId, code);
      setStatus(r.status);
    } catch {
      /* ignore transient errors */
    }
  }, [code, doctorId]);

  // Keep polling even after approval, so a live revoke re-locks the view.
  const timer = useRef(null);
  useEffect(() => {
    if (!code) return;
    poll();
    timer.current = setInterval(poll, 2500);
    return () => clearInterval(timer.current);
  }, [code, poll]);

  const submit = async (e) => {
    e.preventDefault();
    const c = entered.trim().toUpperCase();
    if (!c || !doctorId) return;
    setCode(c);
    setStatus("pending");
    setBusy(true);
    try {
      const r = await api.requestAccess(doctorId, c);
      setStatus(r.status);
    } catch (err) {
      setStatus("none");
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCode("");
    setStatus("idle");
    setEntered("");
    setGuardian(null);
  };

  const ui = STATUS_UI[status];

  return (
    <div className="view">
      <div className="view-head">
        <h1 className="view-title">Doctor console</h1>
        <p className="view-subtitle">
          Look up a patient by code. You'll see their history only after they approve.
        </p>
      </div>

      <div className="console">
        <div className="console-side">
          <form className="panel" onSubmit={submit}>
            <label className="field-label" htmlFor="dr-code">Patient code</label>
            <input
              id="dr-code"
              className="input"
              placeholder="e.g. PT-4821"
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              disabled={!!code}
              autoFocus
            />
            {!code ? (
              <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }}
                      type="submit" disabled={busy || !doctorId}>
                Request access
              </button>
            ) : (
              <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}
                      type="button" onClick={reset}>
                Look up another patient
              </button>
            )}

            {code && ui && (
              <div className="access-status">
                <span className="status-line">
                  <span className={`dot ${ui.dot}`} />
                  <span><span className="mono">{code}</span> · {ui.text}</span>
                </span>
                {(status === "denied" || status === "revoked") && (
                  <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%" }}
                          type="button" onClick={() => submit(new Event("submit"))}>
                    Request again
                  </button>
                )}
              </div>
            )}
          </form>

          {approved ? (
            <>
              <GuardianPanel
                result={guardian}
                checking={checking}
                onRun={runGuardian}
                onClear={() => setGuardian(null)}
              />
              <ChatPanel code={code} doctorId={doctorId} />
            </>
          ) : (
            <div className="panel hint-panel">
              <div className="panel-title">How consent works</div>
              <p className="hint-text" style={{ marginTop: 8 }}>
                The graph stays locked until the patient approves your request in their
                portal. They can revoke it at any time. Try <span className="mono">PT-4821</span> for
                the live approval demo, or <span className="mono">PT-7003</span> (already approved).
              </p>
            </div>
          )}
        </div>

        <div className="console-graph">
          <GraphView
            data={data}
            loading={loading}
            error={error}
            locked={!!code && !approved}
            highlight={highlight}
          />
        </div>
      </div>
    </div>
  );
}
