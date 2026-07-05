import { useEffect, useRef } from "react";

/**
 * The Lifeline, rendered as a living DNA double-helix that runs down the page
 * gutter and lights up as you scroll — one continuous strand from the hero to
 * the contact section. Two teal strands weave over and under each other, joined
 * by base-pair rungs (a few tinted like record types). Ties the whole page to
 * the product's genomic / hereditary story.
 *
 * Canvas-based, fixed to the viewport, drawing only the visible slice. Respects
 * prefers-reduced-motion (static, no twist). Pauses when the tab is hidden.
 */

// A few rungs are tinted like graph record-types — a quiet nod to the data.
const RUNG_TINTS = ["#b96a1f", "#6d5bb8", "#2e7fa3", "#2f8f6b", "#d9503c"];

export default function DnaThread({ boundsRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const bounds = boundsRef?.current;
    if (!canvas || !bounds) return;

    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Helix geometry (document space)
    const A = 15;            // strand amplitude
    const PERIOD = 138;      // px per full turn
    const FREQ = (Math.PI * 2) / PERIOD;
    const RUNG_GAP = PERIOD / 6;
    const OMEGA = reduced ? 0 : 0.0012; // twist speed (rad/ms)

    let cx = 60;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let vw = 0;
    let vh = 0;
    let raf = 0;
    let disposed = false;
    const mountedAt = performance.now();
    let lastInteract = mountedAt;
    const IDLE_MS = 4500; // settle the twist when the reader isn't interacting

    const resize = () => {
      vw = document.documentElement.clientWidth;
      vh = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // match the CSS lifeline-x: max(30px, 50% - 540px)
      cx = Math.max(30, vw / 2 - 540);
    };

    const draw = (now) => {
      if (disposed) return;
      const t = now - mountedAt;
      ctx.clearRect(0, 0, vw, vh);

      // hide on narrow screens (matches the CSS breakpoint)
      if (vw < 900) {
        if (!reduced) raf = requestAnimationFrame(draw);
        return;
      }

      const scrollY = window.scrollY || window.pageYOffset || 0;
      const rect = bounds.getBoundingClientRect();
      const topDoc = rect.top + scrollY + 20;
      const botDoc = rect.top + scrollY + rect.height - 40;

      // scroll progress "lights up" the traveled portion
      const progressPx = Math.min(scrollY + vh * 0.62, botDoc);

      const visTop = Math.max(topDoc, scrollY - 40);
      const visBot = Math.min(botDoc, scrollY + vh + 40);
      if (visBot <= visTop) {
        if (!reduced) raf = requestAnimationFrame(draw);
        return;
      }

      // sample the two strands across the visible slice
      const samples = [];
      for (let docY = visTop; docY <= visBot; docY += 4) {
        const phase = docY * FREQ + t * OMEGA;
        const s = Math.sin(phase);
        samples.push({
          cy: docY - scrollY,
          docY,
          phase,
          x1: cx + A * s,
          x2: cx - A * s,
        });
      }

      drawStrand(ctx, samples, "x1", 1, progressPx);
      drawStrand(ctx, samples, "x2", -1, progressPx);

      // base-pair rungs
      const firstRung = Math.ceil(visTop / RUNG_GAP) * RUNG_GAP;
      let ri = Math.round(firstRung / RUNG_GAP);
      for (let r = firstRung; r <= visBot; r += RUNG_GAP, ri++) {
        const phase = r * FREQ + t * OMEGA;
        const s = Math.sin(phase);
        const x1 = cx + A * s;
        const x2 = cx - A * s;
        const cy = r - scrollY;
        const spread = Math.abs(s);           // 1 = strands far apart, 0 = edge-on
        const traveled = r < progressPx;
        const tint = ri % 7 === 3 ? RUNG_TINTS[ri % RUNG_TINTS.length] : null;

        ctx.lineWidth = 1.4;
        if (tint && traveled) {
          ctx.strokeStyle = withAlpha(tint, 0.2 + spread * 0.5);
        } else if (traveled) {
          ctx.strokeStyle = `rgba(42,106,100,${0.12 + spread * 0.42})`;
        } else {
          ctx.strokeStyle = `rgba(122,150,142,${0.08 + spread * 0.2})`;
        }
        ctx.beginPath();
        ctx.moveTo(x1, cy);
        ctx.lineTo(x2, cy);
        ctx.stroke();
      }

      // Keep the twist alive briefly after load and while the reader is active;
      // settle to a still frame once idle (saves CPU, and lets the paint rest).
      // Never leave a frame pending while hidden — it would stall consumers
      // waiting on animation-frame flush (and rAF won't fire in a hidden tab).
      const idle = t > 1600 && now - lastInteract > IDLE_MS;
      const visible = document.visibilityState === "visible";
      raf = !reduced && !idle && visible ? requestAnimationFrame(draw) : 0;
    };

    const wake = () => {
      lastInteract = performance.now();
      if (reduced) {
        draw(lastInteract);
      } else if (!raf && !disposed && document.visibilityState === "visible") {
        raf = requestAnimationFrame(draw);
      }
    };
    const onResize = () => { resize(); wake(); };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      // Repaint a single current frame on return, but don't resume the ambient
      // loop — real motion is driven by scroll/pointer, which call wake().
      if (document.visibilityState === "visible") draw(performance.now());
    };

    resize();
    // Paint one complete frame synchronously so the helix is present even
    // before rAF schedules (and in backgrounded tabs, where rAF never fires).
    // draw() itself schedules the next rAF while animating, so no extra call.
    draw(mountedAt + 2000);

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [boundsRef]);

  return <canvas className="dna-canvas" ref={canvasRef} aria-hidden />;
}

/* Draw one strand as depth-shaded segments — front segments brighter/thicker. */
function drawStrand(ctx, samples, key, zSign, progressPx) {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const z = Math.cos(b.phase) * zSign; // >0 = weaving in front
    const depth = (z + 1) / 2;           // 0..1
    const alpha = 0.3 + depth * 0.7;
    const traveled = b.docY < progressPx;
    ctx.strokeStyle = traveled
      ? `rgba(30,82,78,${alpha})`
      : `rgba(122,150,142,${alpha * 0.45})`;
    ctx.lineWidth = 1.5 + depth * 1.7;
    ctx.beginPath();
    ctx.moveTo(a[key], a.cy);
    ctx.lineTo(b[key], b.cy);
    ctx.stroke();
  }
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
