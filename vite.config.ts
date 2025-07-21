import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        // Automatically open the app in the browser on server start.
        // We provide the path with the required query parameter.
        open: '/?config=samples/config.json'
    }
});