import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    publicDir: false,
    build: {
        lib: {
            entry: 'src/lib/index.tsx',
            name: 'MapVibe',
            formats: ['es', 'cjs'],
            fileName: (format) => `mapvibe.${format === 'es' ? 'mjs' : 'cjs'}`
        },
        rollupOptions: {
            // Externalize dependencies that shouldn't be bundled into the library
            external: ['react', 'react-dom', 'maplibre-gl'],
            output: {
                // Provide global variables to use in the UMD build for externalized deps
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    'maplibre-gl': 'maplibregl'
                },
                // Preserve CSS as a separate file
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'mapvibe.css';
                    return assetInfo.name || '';
                }
            }
        },
        cssCodeSplit: false,
        // Sourcemaps for better debugging
        sourcemap: true,
        // Target modern browsers
        target: 'es2020'
    }
});
