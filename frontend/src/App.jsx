import { useEffect, useState } from "react";
import Landing from "./components/Landing.jsx";
import DoctorView from "./views/DoctorView.jsx";
import PatientView from "./views/PatientView.jsx";
import "./App.css";

const NAV_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "features", label: "Features" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

export default function App() {
  const [view, setView] = useState("landing"); // landing | doctor | patient
  const [activeSection, setActiveSection] = useState("home");

  // Jump to a landing section — switching back to the landing page first if needed.
  const goSection = (id) => {
    if (view !== "landing") {
      setView("landing");
      // wait one frame for the landing DOM to exist, then scroll
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const openConsole = (v) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  // Track which landing section is in view, so the nav can reflect it.
  useEffect(() => {
    if (view !== "landing") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    for (const s of NAV_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [view]);

  return (
    <div className="app">
      <TopBar
        view={view}
        activeSection={activeSection}
        onNav={goSection}
        onHome={() => {
          setView("landing");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <main className="app-main">
        {view === "landing" && <Landing onPick={openConsole} />}
        {view === "doctor" && <DoctorView />}
        {view === "patient" && <PatientView />}
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-name footer-brand-name">
              Medi<span className="brand-iq">IQ</span>
            </span>
            <p className="footer-tag">
              Your whole life of care, as one record you control.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Footer">
            {NAV_SECTIONS.map((s) => (
              <button key={s.id} className="footer-link" onClick={() => goSection(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="footer-note">
            <span className="mono">MEDI-IQ · PROTOTYPE</span>
            <span>Synthetic data only. Not a medical device.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TopBar({ view, activeSection, onNav, onHome }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Medi-IQ home">
        <span className="brand-mark" aria-hidden />
        <span className="brand-name">Medi<span className="brand-iq">IQ</span></span>
      </button>

      <nav className="topnav" aria-label="Main">
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`topnav-link${view === "landing" && activeSection === s.id ? " is-active" : ""}`}
            onClick={() => onNav(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {view !== "landing" && (
        <div className="topbar-right">
          <span className={`role-chip role-${view}`}>
            {view === "doctor" ? "Doctor console" : "Patient portal"}
          </span>
          <button className="btn-ghost" onClick={onHome}>Switch role</button>
        </div>
      )}
    </header>
  );
}
