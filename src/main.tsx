// Website entry point - imports library and initializes the app
import { createRoot } from 'react-dom/client';
import { MapVibeApp } from './lib';

// --- START THE REACT APP ---
const container = document.getElementById('map')!;
const root = createRoot(container);
root.render(<MapVibeApp />);
