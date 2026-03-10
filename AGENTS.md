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

## Config Notes

Mapvibe config files are based on the MapLibre style JSON format, but they also include Mapvibe-specific fields that are not part of the base MapLibre style spec.

- Standard MapLibre style fields still live at the top level: `version`, `sources`, `sprite`, `glyphs`, `layers`, `center`, `zoom`, `bounds`, and so on.
- `customUi` is a Mapvibe extension. It controls the layer chooser, panel, background layer list, data layer list, optional zoom bounds, and imported background styles.
- `customUi.backgroundLayers` is not the same thing as the raw `layers` array from MapLibre. It is a UI-facing list of selectable background targets.
- A `backgroundLayers` entry can point to:
  - a real top-level style layer id
  - an import id from `customUi.imports`
  - a group id from `customUi.groups`
- `backgroundLayers[].visible` is a Mapvibe-only initial-selection flag for the radio chooser. It does not come from the MapLibre style spec.

### Imports

- `customUi.imports` uses entries shaped like `{ "id": "...", "url": "..." }`.
- These imports are not native MapLibre style imports. Mapvibe fetches the style JSON asynchronously and materializes the imported sources/layers/sprites into the live map.
- Imported runtime ids are namespaced with the `__imports_<id>_` prefix to avoid collisions with the top style.
- The top style remains authoritative for map title, initial center/zoom/bounds, and the main style document. Imported styles contribute background layers plus their own supporting sources/sprites/glyphs.
- Imports behave as a single background virtual layer choice in the UI even though they may expand to many concrete layers at runtime.

### Groups

- `customUi.groups` defines virtual background entries that combine multiple layer ids and/or import ids in a specific order.
- Group ids can be used anywhere a `backgroundLayers[].id` is expected.
- Groups are for background selection only; they are not part of the underlying MapLibre style spec.


## AGENTS.md

When finishing the work, update this AGENTS.md with consideration for future work.