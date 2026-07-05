import { useState } from "react";
import "./GuardianPanel.css";

const RISK = {
  danger:  { label: "Danger", cls: "risk-danger", glyph: "⚠" },
  caution: { label: "Caution", cls: "risk-caution", glyph: "!" },
  none:    { label: "Clear", cls: "risk-none", glyph: "✓" },
};

export default function GuardianPanel({ result, checking, onRun, onClear }) {
  const [drug, setDrug] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const d = drug.trim();
    if (d) onRun(d);
  };

  const risk = result && (RISK[result.risk] || RISK.none);

  return (
    <div className="panel guardian-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">
            <span className="guardian-shield" aria-hidden>🛡</span> Silent Guardian
          </div>
          <div className="panel-sub">Cross-hospital drug-safety check</div>
        </div>
      </div>

      <form onSubmit={submit} className="guardian-form">
        <input
          className="input"
          placeholder="Drug to prescribe, e.g. penicillin"
          value={drug}
          onChange={(e) => setDrug(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={checking || !drug.trim()}>
          {checking ? "Checking…" : "Check"}
        </button>
      </form>

      {result && (
        <div className={`guardian-result ${risk.cls}`}>
          <div className="guardian-risk-row">
            <span className="guardian-risk-badge">
              <span className="guardian-risk-glyph">{risk.glyph}</span> {risk.label}
            </span>
            <span className="guardian-drug mono">{result.drug}</span>
            {result.risk !== "none" && (
              <button className="guardian-clear" onClick={onClear} type="button">clear</button>
            )}
          </div>
          <p className="guardian-reason">{result.reason}</p>
          {result.risk === "danger" && result.path?.length > 0 && (
            <p className="guardian-trace mono">↳ danger path highlighted on the graph</p>
          )}
        </div>
      )}
    </div>
  );
}
