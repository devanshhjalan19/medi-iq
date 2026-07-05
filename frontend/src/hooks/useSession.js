import { useEffect, useState } from "react";
import { api } from "../api";

// Grabs a demo identity for a role once. The prototype's clinician is a single
// shared demo doctor, so this mostly returns a stable id.
export function useSession(role) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .createSession(role)
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession({ role, id: role === "doctor" ? "DR-7788" : "patient" }));
    return () => {
      alive = false;
    };
  }, [role]);

  return session;
}
