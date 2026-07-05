import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

// Fetches a patient's graph. `enabled=false` keeps it idle (e.g. while access
// is locked). `reloadKey` forces a refetch when it changes.
export function useGraph(code, enabled = true, reloadKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!code || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const g = await api.getGraph(code);
      setData(g);
    } catch (e) {
      setError(e.message || "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [code, enabled, reloadKey]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      return;
    }
    load();
  }, [load, enabled]);

  return { data, loading, error, reload: load };
}
