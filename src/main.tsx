import { createRoot } from 'react-dom/client';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import App from './App';

// Bundle the MapLibre worker and its shared imports before creating any maps.
setWorkerUrl(workerUrl);

const container = document.getElementById('map')!;
const root = createRoot(container);
root.render(<App />);
