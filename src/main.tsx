import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('map')!;
const root = createRoot(container);
root.render(<App />);
