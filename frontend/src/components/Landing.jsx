import { useEffect, useRef, useState } from "react";
import DnaThread from "./DnaThread.jsx";
import "./Landing.css";

/* ------------------------------------------------------------------ */
/* Scroll-reveal: adds .in once the element enters the viewport.       */
/* ------------------------------------------------------------------ */
function Reveal({ as: Tag = "div", className = "", children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Landing — the whole marketing page: Home · Features · FAQ · Contact */
/* ------------------------------------------------------------------ */
export default function Landing({ onPick }) {
  const pageRef = useRef(null);

  return (
    <div className="landing" ref={pageRef}>
      {/* The Lifeline — a living DNA helix stitching every section together */}
      <DnaThread boundsRef={pageRef} />

      <Hero onPick={onPick} />
      <Features />
      <Faq />
      <Contact />
    </div>
  );
}

/* ================================ HERO ============================== */

function Hero({ onPick }) {
  return (
    <section className="section hero" id="home">
      <span className="lifeline-node" aria-hidden />
      <div className="section-inner">
        <p className="eyebrow hero-eyebrow">One record · owned by the patient</p>

        <BrandWordmark />

        <p className="hero-tagline">
          Your whole life of care, woven into{" "}
          <span className="hero-title-accent">one record you control.</span>
        </p>

        <p className="hero-lede">
          A hospital in 2021. A clinic in 2023. A health centre in 2025. None of them talk
          to each other — so doctors prescribe blind. Medi-IQ threads every diagnosis,
          drug, doctor, and visit into a single living knowledge graph, and a Silent
          Guardian watches over every new prescription.
        </p>

        <div className="hero-entry">
          <button className="entry-card entry-doctor" onClick={() => onPick("doctor")}>
            <span className="entry-icon" aria-hidden>
              <IconStethoscope />
            </span>
            <span className="entry-kicker mono">For clinicians</span>
            <span className="entry-title">I am a Doctor</span>
            <span className="entry-body">
              Request a patient's consent, see their full cross-hospital history, and run
              a drug-safety check before you prescribe.
            </span>
            <span className="entry-cta">Open the Doctor console <span className="entry-arrow">→</span></span>
          </button>

          <button className="entry-card entry-patient" onClick={() => onPick("patient")}>
            <span className="entry-icon" aria-hidden>
              <IconHeartId />
            </span>
            <span className="entry-kicker mono">It's your record</span>
            <span className="entry-title">I am a Patient</span>
            <span className="entry-body">
              See your own health graph, and approve, deny, or revoke exactly which
              doctors can view it — in real time.
            </span>
            <span className="entry-cta">Open the Patient portal <span className="entry-arrow">→</span></span>
          </button>
        </div>

        <Reveal className="hero-thread">
          <ProvenanceThread />
          <p className="thread-caption">
            A prescription <span className="tc-now">today</span>, checked against a
            reaction logged <span className="tc-past">years ago by a different doctor</span>
            — the Guardian draws the line no single chart could.
          </p>
        </Reveal>

        <div className="landing-index mono">
          <span className="landing-index-label">Demo record index</span>
          <span className="landing-index-codes">
            PT-4821 <span className="idx-note">hero case</span> · PT-7003 · PT-5567 · PT-3120
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * The brand wordmark. A helix strand ("i" dot as a pulsing base node) sits
 * beside "IQ"; the two words rise in on load. Kept deliberately clean — the
 * living DNA spine is where the motion lives.
 */
function BrandWordmark() {
  return (
    <div className="brand-hero">
      <h1 className="brand-hero-mark" aria-label="Medi IQ">
        <span className="bh-word bh-medi" aria-hidden>Medi</span>
        <span className="bh-word bh-iq" aria-hidden>
          IQ
          <span className="bh-node" />
        </span>
      </h1>
    </div>
  );
}

/**
 * The signature scene: a longitudinal time-axis with three real events from the
 * hero patient. A thread draws itself back from a prescription "today" to the
 * 2021 anaphylaxis logged at a different hospital — the Guardian catching the
 * risk. Reduced motion: renders already drawn.
 */
function ProvenanceThread() {
  return (
    <svg
      className="thread-scene"
      viewBox="0 0 960 250"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Timeline: a 2021 penicillin reaction, a 2023 diagnosis, and a 2025
        prescription — with a Guardian thread connecting the 2025 prescription back to the
        2021 reaction."
    >
      {/* baseline */}
      <line className="th-axis" x1="60" y1="176" x2="900" y2="176" />
      {["2021", "2023", "2025"].map((yr, i) => {
        const x = [176, 480, 784][i];
        return (
          <g key={yr} className="th-tick" style={{ "--d": `${0.25 + i * 0.12}s` }}>
            <line x1={x} y1="170" x2={x} y2="182" />
            <text x={x} y="200" className="th-year">{yr}</text>
          </g>
        );
      })}

      {/* the Guardian thread — drawn back from today to 2021 */}
      <path
        className="th-thread"
        d="M784 168 C 700 96, 300 84, 176 160"
        fill="none"
      />
      <g className="th-guardian">
        <rect x="420" y="70" width="120" height="22" rx="6" />
        <text x="480" y="85" className="th-guardian-txt">GUARDIAN ⟶</text>
      </g>

      {/* 2021 · reaction (the origin) */}
      <g className="th-event th-event-past" style={{ "--d": "0.5s" }}>
        <circle className="th-node th-node-danger" cx="176" cy="176" r="7" />
        <g className="th-card" transform="translate(96,108)">
          <rect width="196" height="46" rx="8" />
          <text x="12" y="19" className="th-card-meta">HOSPITAL A · 2021 · DR. RAO</text>
          <text x="12" y="36" className="th-card-title th-title-danger">Penicillin → anaphylaxis</text>
        </g>
      </g>

      {/* 2023 · diagnosis */}
      <g className="th-event" style={{ "--d": "0.66s" }}>
        <circle className="th-node th-node-dx" cx="480" cy="176" r="6" />
        <g className="th-card" transform="translate(398,210)">
          <rect width="164" height="34" rx="8" />
          <text x="12" y="21" className="th-card-meta">CLINIC · 2023 · TYPE-2 DIABETES</text>
        </g>
      </g>

      {/* 2025 · today's action */}
      <g className="th-event" style={{ "--d": "0.82s" }}>
        <circle className="th-node th-node-now th-pulse" cx="784" cy="176" r="7" />
        <g className="th-card" transform="translate(686,108)">
          <rect width="212" height="46" rx="8" className="th-card-now" />
          <text x="12" y="19" className="th-card-meta th-meta-now">PHC · TODAY · DR. MENON</text>
          <text x="12" y="36" className="th-card-title th-title-now">Prescribe penicillin?</text>
        </g>
      </g>
    </svg>
  );
}

/* ============================== FEATURES ============================ */

const FEATURES = [
  {
    icon: <IconGraph />,
    title: "One lifelong record",
    body: "Every diagnosis, prescription, doctor, and visit — from every hospital you've ever walked into — linked in a single knowledge graph instead of a drawer of disconnected files.",
  },
  {
    icon: <IconShield />,
    title: "Silent Guardian",
    body: "Before a new drug is prescribed, it's checked against your entire history. A reaction noted by a different doctor years ago still counts — and the danger path lights up on the graph.",
  },
  {
    icon: <IconKey />,
    title: "Consent, not custody",
    body: "Nothing is shared without your explicit approval. Grant a doctor access in one tap and revoke it just as fast — their view locks the moment you do.",
  },
  {
    icon: <IconChat />,
    title: "Ask the record",
    body: "Doctors ask questions in plain language and get answers grounded in the graph itself — with every claim linked back to the exact node behind it.",
  },
];

function Features() {
  return (
    <section className="section features" id="features">
      <span className="lifeline-node" aria-hidden />
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Capabilities</p>
          <h2 className="section-title">Built to see the whole picture.</h2>
          <p className="section-lede">
            Fragmented records are more than an inconvenience — they're how preventable
            harm happens. Each capability below exists to close that gap.
          </p>
        </Reveal>

        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal className="feature-card" key={f.title} delay={i * 80}>
              <span className="feature-icon" aria-hidden>{f.icon}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-body">{f.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="feature-roadmap">
          <span className="roadmap-chip mono">In development</span>
          <div>
            <h3 className="feature-title">Family Pattern Detector</h3>
            <p className="feature-body">
              When three relatives develop the same condition around the same age, that's a
              pattern no single doctor would ever connect. Linked family graphs will surface
              hereditary risks early — before they become diagnoses.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================ FAQ =============================== */

const FAQS = [
  {
    q: "Who can see my record?",
    a: "No one, until you say so. Doctors request access, and their console stays locked until you approve from your portal. You can revoke access at any moment — their view re-locks live, mid-session.",
  },
  {
    q: "How does my data get into Medi-IQ?",
    a: "Records from each hospital, clinic, and lab are ingested into your personal knowledge graph, where every entity — a drug, a reaction, a doctor — becomes a connected node. This prototype runs on synthetic patient records built for the demo.",
  },
  {
    q: "What exactly is a knowledge graph?",
    a: "Instead of storing your history as separate documents, a knowledge graph stores it as things and relationships: penicillin → caused → anaphylaxis → recorded at → Hospital A. That structure is what lets the system trace a risk back to its origin, years and hospitals away.",
  },
  {
    q: "What happens when I revoke a doctor's access?",
    a: "Their view of your graph locks instantly — no grace period, no cached copy. The doctor sees the record is protected again and would need to send a new request.",
  },
  {
    q: "Can Medi-IQ make treatment decisions?",
    a: "No. It surfaces evidence — a reaction from 2021, a pattern across visits — so the clinician decides with the full picture. This is a prototype using synthetic data, and it is not a medical device.",
  },
  {
    q: "What powers it under the hood?",
    a: "Each patient's graph is built and queried with Cognee, a knowledge-graph memory engine. An AI layer reasons over the graph in real time — answering questions and explaining drug-safety findings in clinical language, always grounded in the actual record.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq" id="faq">
      <span className="lifeline-node" aria-hidden />
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Questions</p>
          <h2 className="section-title">Fair questions, straight answers.</h2>
        </Reveal>

        <div className="faq-list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal className="faq-item-wrap" key={f.q} delay={i * 50}>
                <div className={`faq-item${isOpen ? " open" : ""}`}>
                  <button
                    className="faq-q"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{f.q}</span>
                    <span className="faq-toggle" aria-hidden>{isOpen ? "−" : "+"}</span>
                  </button>
                  <div className="faq-a" hidden={!isOpen}>
                    <p>{f.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================== CONTACT ============================= */

function Contact() {
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section className="section contact" id="contact">
      <span className="lifeline-node lifeline-node-end" aria-hidden />
      <div className="section-inner">
        <div className="contact-grid">
          <Reveal>
            <p className="eyebrow">Contact</p>
            <h2 className="section-title">Talk to us about a pilot.</h2>
            <p className="section-lede">
              We're looking for hospitals, clinics, and health programmes who want to see
              a patient's whole picture. Tell us where fragmented records hurt you most.
            </p>
            <div className="contact-details">
              <div className="contact-row">
                <span className="contact-label mono">EMAIL</span>
                <a href="mailto:hello@medi-iq.health" className="contact-value">hello@medi-iq.health</a>
              </div>
              <div className="contact-row">
                <span className="contact-label mono">PILOTS</span>
                <span className="contact-value">Now onboarding · India · 2026</span>
              </div>
              <div className="contact-row">
                <span className="contact-label mono">DEMO</span>
                <span className="contact-value">Try patient code PT-4821 in either console</span>
              </div>
            </div>
          </Reveal>

          <Reveal className="contact-form-wrap" delay={120}>
            {sent ? (
              <div className="contact-sent">
                <span className="contact-sent-mark" aria-hidden>✓</span>
                <h3 className="feature-title">Message received</h3>
                <p className="feature-body">
                  Thanks for reaching out — we'll reply within two working days.
                </p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={submit}>
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label" htmlFor="c-name">Name</label>
                    <input id="c-name" className="input input-body" placeholder="Dr. A. Sharma" required />
                  </div>
                  <div className="form-field">
                    <label className="field-label" htmlFor="c-email">Email</label>
                    <input id="c-email" type="email" className="input input-body" placeholder="you@hospital.org" required />
                  </div>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="c-org">Organisation</label>
                  <input id="c-org" className="input input-body" placeholder="Hospital, clinic, or programme" />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="c-msg">Message</label>
                  <textarea
                    id="c-msg"
                    className="input input-body contact-textarea"
                    placeholder="What would you like to explore?"
                    rows={4}
                    required
                  />
                </div>
                <button className="btn btn-primary contact-send" type="submit">Send message</button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================ INLINE ICONS ========================== */

function IconStethoscope() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v5a5 5 0 0 0 10 0V3" />
      <path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" />
      <circle cx="19" cy="10.5" r="2.2" />
    </svg>
  );
}
function IconHeartId() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-9.5A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.5C19 15.6 12 20 12 20z" />
      <path d="M8.5 11.5h2l1-1.8 1.5 3.2 1-1.4h1.5" />
    </svg>
  );
}
function IconGraph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="8" r="2.4" /><circle cx="12" cy="18" r="2.4" />
      <path d="M8 7.2 15.7 8.6M7.2 8.1l3.6 7.8M16.8 10.2l-3.5 5.8" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4.6 3 8 7 10 4-2 7-5.4 7-10V6l-7-3z" />
      <path d="m9 12 2 2 4-4.5" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11 20 4M16 6l2.5 2.5M13.5 8.5 16 11" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-5 4V6z" />
      <path d="M8.5 9h7M8.5 12h4.5" />
    </svg>
  );
}
