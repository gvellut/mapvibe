# Mapvibe

A static map interface for embedding in blog posts or websites, as a Google My Maps replacement. Runs fully client-side, loads configuration from a single JSON file.

## Technology

- TypeScript
- React: Simple component
- Vite

On top of the component, the project also has an application consisting of loading the component (to be used inside an iframe from another page).

## Running

```bash
npm run dev
```

Some simple `config.json` samples can be found in folder `samples`. To load one of them, use something like

`http://localhost:5173/mapvibe?config=samples/sample1/config.json`
