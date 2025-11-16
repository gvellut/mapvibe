import { createRoot } from 'react-dom/client';
import App from './App';
import './spa.scss';

const container = document.getElementById('map')!;
const root = createRoot(container);
root.render(<App />);
