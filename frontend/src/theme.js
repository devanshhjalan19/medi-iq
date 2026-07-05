// Node-type visual language. The graph colours and the on-screen legend both
// read from here, so the palette stays in sync everywhere.
// Saturated inks chosen for legibility on the porcelain (light) canvas.

export const NODE_TYPES = {
  patient:   { color: "#0d3d3b", label: "Patient" },
  drug:      { color: "#b96a1f", label: "Drug" },
  diagnosis: { color: "#6d5bb8", label: "Diagnosis" },
  reaction:  { color: "#d9503c", label: "Reaction / allergy" },
  visit:     { color: "#2e7fa3", label: "Visit" },
  hospital:  { color: "#5b6b66", label: "Hospital" },
  doctor:    { color: "#2f8f6b", label: "Doctor" },
  lab:       { color: "#4e9e86", label: "Lab result" },
  date:      { color: "#8a948f", label: "Date" },
  person:    { color: "#3d7ea8", label: "Family / person" },
  other:     { color: "#9aa5a0", label: "Other" },
};

export const nodeColor = (type) =>
  (NODE_TYPES[type] || NODE_TYPES.other).color;

// Types worth showing in the compact legend, in a sensible reading order.
export const LEGEND_ORDER = [
  "patient", "diagnosis", "drug", "reaction",
  "person", "doctor", "hospital", "visit", "lab",
];
