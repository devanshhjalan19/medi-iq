import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: no StrictMode. React 19's double-mount in dev makes react-force-graph
// stack two canvases, and the top (dead) one swallows node clicks.
createRoot(document.getElementById('root')).render(<App />)
