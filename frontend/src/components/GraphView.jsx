import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { NODE_TYPES, LEGEND_ORDER, nodeColor } from "../theme";
import "./GraphView.css";

// edge key helper (matches the backend path/edge identity)
const edgeKey = (s, t) => `${s}->${t}`;

/**
 * Reusable interactive knowledge-graph canvas.
 *
 * props:
 *   data       { nodes:[{id,label,type}], edges:[{source,target,label}] }
 *   highlight  { nodes:Set<id>, edges:Set<"src->tgt">, tone:"danger"|"vital" }
 *   loading, error, locked  — presentational states
 *   emptyHint  — body text shown when the record has no nodes yet
 */
export default function GraphView({ data, highlight, loading, error, locked, emptyHint }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [selected, setSelected] = useState(null);

  // Responsive sizing.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Transform backend shape -> force-graph shape.
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label,
      })),
    };
  }, [data]);

  // Reset view + spread the layout out so labels have room to breathe.
  useEffect(() => {
    setSelected(null);
    const fg = fgRef.current;
    if (fg) {
      fg.d3Force("charge")?.strength(-320);
      fg.d3Force("link")?.distance(78);
      fg.d3ReheatSimulation?.();
    }
    const t = setTimeout(() => {
      fgRef.current?.zoomToFit?.(600, 80);
    }, 700);
    return () => clearTimeout(t);
  }, [graphData]);

  const hlNodes = highlight?.nodes;
  const hlEdges = highlight?.edges;
  const hlTone = highlight?.tone === "danger" ? "#d9503c" : "#e8a33d";
  const dimming = !!(hlNodes && hlNodes.size);

  const drawNode = (node, ctx, scale) => {
    const isPatient = node.type === "patient";
    const r = isPatient ? 8 : 5.5;
    const color = nodeColor(node.type);
    const isHot = hlNodes?.has(node.id);
    const isSel = selected?.id === node.id;
    const faded = dimming && !isHot;

    ctx.globalAlpha = faded ? 0.22 : 1;

    // glow for highlighted / selected
    if (isHot || isSel) {
      ctx.shadowColor = isHot ? hlTone : "#7fa69b";
      ctx.shadowBlur = 20;
    }
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // thin light halo separates the dot from links passing behind it
    ctx.lineWidth = 1.4 / scale;
    ctx.strokeStyle = "rgba(248,250,249,0.95)";
    ctx.beginPath();
    ctx.arc(node.x, node.y, r + 0.4, 0, 2 * Math.PI);
    ctx.stroke();

    if (isPatient) {
      ctx.lineWidth = 1.6 / scale;
      ctx.strokeStyle = "rgba(13,61,59,0.5)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3.5 / scale + 1, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (isHot) {
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = hlTone;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Label — gated so minor nodes stay quiet at overview zoom, and set on a
    // porcelain pill so overlapping labels never merge into unreadable text.
    const showLabel =
      isPatient || isHot || isSel || ALWAYS_LABEL.has(node.type) || scale >= 1.2;
    if (!showLabel) {
      ctx.globalAlpha = 1;
      return;
    }

    const label = truncate(node.label, 20);
    const fontSize = Math.max(4, 10.5 / scale);
    ctx.font = `${isPatient ? 600 : 500} ${fontSize}px "Figtree", sans-serif`;
    const textW = ctx.measureText(label).width;
    const padX = 5 / scale;
    const padY = 3 / scale;
    const boxW = textW + padX * 2;
    const boxH = fontSize + padY * 2;
    const bx = node.x - boxW / 2;
    const by = node.y + r + 3 / scale;

    ctx.fillStyle = faded ? "rgba(248,250,249,0.4)" : "rgba(248,250,249,0.92)";
    roundRect(ctx, bx, by, boxW, boxH, 3.5 / scale);
    ctx.fill();

    ctx.fillStyle = faded
      ? "rgba(86,113,107,0.5)"
      : isPatient
        ? "#0d3d3b"
        : "#33443f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, node.x, by + boxH / 2);
    ctx.globalAlpha = 1;
  };

  // Hit area radius comes from nodeVal + nodeRelSize (default circular hit test).
  const nodeVal = (node) => (node.type === "patient" ? 4 : 2.4);

  const linkColorFn = (link) => {
    const k = edgeKey(idOf(link.source), idOf(link.target));
    if (hlEdges?.has(k)) return hlTone;
    if (dimming) return "rgba(13,61,59,0.08)";
    return "rgba(13,61,59,0.2)";
  };
  const linkWidthFn = (link) => {
    const k = edgeKey(idOf(link.source), idOf(link.target));
    return hlEdges?.has(k) ? 2.6 : 1;
  };

  const drawLinkLabel = (link, ctx, scale) => {
    const s = link.source, t = link.target;
    if (typeof s !== "object" || typeof t !== "object") return;
    const k = edgeKey(idOf(s), idOf(t));
    const hot = hlEdges?.has(k);
    // Relationship labels only appear when the danger path is lit or the user
    // zooms in — at overview they'd just be noise between the nodes.
    if (!hot && scale < 2.1) return;
    if (dimming && !hot) return;
    if (!link.label) return;

    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2;
    const label = truncate(link.label, 16);
    const fs = Math.max(3, 8.5 / scale);
    ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
    const tw = ctx.measureText(label).width;

    ctx.fillStyle = "rgba(248,250,249,0.92)";
    roundRect(ctx, mx - tw / 2 - 3 / scale, my - fs / 2 - 2 / scale, tw + 6 / scale, fs + 4 / scale, 2.5 / scale);
    ctx.fill();

    ctx.fillStyle = hot ? hlTone : "rgba(74,90,86,0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my);
  };

  const hasData = data && data.nodes && data.nodes.length > 0;

  const dangerFrame = highlight?.tone === "danger" && highlight?.nodes?.size;

  return (
    <div className={`graph-wrap${dangerFrame ? " graph-danger" : ""}`} ref={wrapRef}>
      {locked ? (
        <Overlay
          icon="lock"
          title="Access locked"
          body="This patient's record is protected. Request access, and it unlocks the moment the patient approves."
        />
      ) : loading ? (
        <Overlay icon="pulse" title="Loading record" body="Reading the knowledge graph…" />
      ) : error ? (
        <Overlay icon="alert" title="Couldn't load graph" body={error} />
      ) : !hasData ? (
        <Overlay
          icon="empty"
          title="No graph yet"
          body={emptyHint || "Enter a patient code to begin."}
        />
      ) : (
        <>
          <ForceGraph2D
            ref={fgRef}
            width={size.w}
            height={size.h}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            cooldownTicks={140}
            d3VelocityDecay={0.32}
            nodeRelSize={4}
            nodeVal={nodeVal}
            nodeCanvasObject={drawNode}
            onNodeClick={(n) => setSelected(n)}
            onBackgroundClick={() => setSelected(null)}
            linkColor={linkColorFn}
            linkWidth={linkWidthFn}
            linkDirectionalArrowLength={3.2}
            linkDirectionalArrowRelPos={0.9}
            linkDirectionalParticles={0}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={drawLinkLabel}
          />

          <Legend types={presentTypes(data)} />

          <div className="graph-hint mono">drag · scroll to zoom · click a node</div>

          {selected && (
            <NodePopover node={selected} onClose={() => setSelected(null)} />
          )}
        </>
      )}
    </div>
  );
}

const idOf = (x) => (typeof x === "object" ? x.id : x);

// Node types that always carry a label — the clinically meaningful ones.
// Minor types (visit, date, lab, other) only label when zoomed in.
const ALWAYS_LABEL = new Set([
  "patient", "drug", "diagnosis", "reaction", "doctor", "hospital", "person",
]);

const truncate = (s, n) =>
  s && s.length > n ? `${s.slice(0, n - 1)}…` : s || "";

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function presentTypes(data) {
  const set = new Set(data.nodes.map((n) => n.type));
  return LEGEND_ORDER.filter((t) => set.has(t));
}

function Legend({ types }) {
  if (!types.length) return null;
  return (
    <div className="legend">
      {types.map((t) => (
        <span className="legend-item" key={t}>
          <span className="legend-dot" style={{ background: NODE_TYPES[t].color }} />
          {NODE_TYPES[t].label}
        </span>
      ))}
    </div>
  );
}

function NodePopover({ node, onClose }) {
  const meta = NODE_TYPES[node.type] || NODE_TYPES.other;
  return (
    <div className="node-pop">
      <button className="node-pop-close" onClick={onClose} aria-label="Close">×</button>
      <div className="node-pop-type" style={{ color: meta.color }}>
        <span className="legend-dot" style={{ background: meta.color }} />
        {meta.label}
      </div>
      <div className="node-pop-title">{node.label}</div>
      <div className="node-pop-id mono">{String(node.id).slice(0, 8)}</div>
    </div>
  );
}

function Overlay({ icon, title, body }) {
  return (
    <div className="graph-overlay">
      <div className={`overlay-glyph glyph-${icon}`} aria-hidden />
      <div className="overlay-title">{title}</div>
      <div className="overlay-body">{body}</div>
    </div>
  );
}
