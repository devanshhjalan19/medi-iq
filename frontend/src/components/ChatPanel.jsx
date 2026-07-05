import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { NODE_TYPES } from "../theme";
import "./ChatPanel.css";

const SUGGESTIONS = [
  "Any past drug reactions?",
  "What conditions run in the family?",
  "Summarise this patient's history.",
];

export default function ChatPanel({ code, doctorId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // reset the thread when switching patients
    setMessages([]);
    setInput("");
  }, [code]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.chat(code, msg, history, doctorId);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, cited: res.citedNodes || [] }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠ ${err.message}`, cited: [] }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send();
  };

  return (
    <div className="panel chat-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Ask about this patient</div>
          <div className="panel-sub">Grounded in their knowledge graph</div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="hint-text">Ask a question about the record. For example:</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
            {m.role === "assistant" && m.cited?.length > 0 && (
              <div className="chat-cited">
                {m.cited.map((c) => (
                  <span className="chat-chip" key={c.id}>
                    <span className="legend-dot" style={{ background: (NODE_TYPES[c.type] || NODE_TYPES.other).color }} />
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="chat-msg chat-assistant">
            <div className="chat-bubble chat-typing"><span></span><span></span><span></span></div>
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={onSubmit}>
        <input
          className="input"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
