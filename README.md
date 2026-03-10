# MapVibe

A static map interface for embedding in blog posts or websites, as a Google My Maps replacement. Runs fully client-side, loads configuration from a single JSON file.

Made with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) and React in TypeScript.

## Configuration

- Uses the [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/) for sources, layers, and styling.
- The config file must include a `customUi` object:
  - `customUi.imports`: Optional list of imported style fragments using Mapbox-style `{ id, url }` entries. Imported styles are fetched asynchronously and inserted below non-background top-style overlay/data layers. It is similar to the *Imports* in the Mapbox SDK v2 (after the Maplibre fork).
  - `customUi.backgroundLayers`: List of selectable backgrounds shown in the layer chooser.
    - Each entry uses its own `id` / `name` plus a required `layerIds` array.
    - `backgroundLayers[].id` is a `customUi` id, separate from top-style layer ids and import ids.
    - `backgroundLayers[].layerIds` references top-style layer ids and/or import ids in bottom-to-top order.
    - Set `visible: true` on one entry to choose the initial GUI selection. If multiple entries set it, MapVibe warns and uses the first. If none set it, MapVibe selects the first background entry.
    - Background entries default to not selected unless `visible: true` is set.
  - `customUi.dataLayers`: List of data layers (lines, points, polygons) for toggling visibility.
    - `dataLayers[].layerIds` references top-style layer ids.
    - Data layers default to visible. Set `visible: false` to start hidden.
    - Set `interactive: true` to make a data layer clickable.
    - Add `openUrl: true` on an interactive data layer to open each clicked feature's `url` property in a new tab instead of showing the info panel.
  - `customUi.panel`: Panel color and width.
    - Optional `imageSizeIsMax: true` uses each feature's `imageSize` as the maximum image box size in the info panel. Default is `false`, which keeps the current full-width behavior.
    - Info panel features can also provide `imageBackgroundColor` as a hex color string such as `#000000` to fill the image wrapper behind the image.
  - `customUi.controls`: Which UI controls to show (zoom, scale, layer chooser, fullscreen, attribution).
  - `customUi.globalMinZoom` / `globalMaxZoom`: Clamp zoom range for all backgrounds.
- On startup, MapVibe hides all top-style layers first, then applies visibility from `customUi.backgroundLayers` and `customUi.dataLayers`. Raw top-style `layout.visibility` does not control initial visibility.
- The layer chooser still uses a single selected background at a time. Selecting a background entry hides the other managed backgrounds and restores that entry's top-style/import members as one virtual background.

### Notes

In `"customUi" > "panel"`,  to recenter marker when it would be covered by info panel, add:

```js
"marginRecenterOnOpen": 10,
"recenterOnOpen": true
```

To enable cooperativeGestures (`ctrl + scroll` to zoom on desktop + 2 finger pan on mobile), add `cooperativeGestures=y` to URL. That parameter will be removed when opening the map in fullscreen using the fullscreen button.

To remember the last map position, use `rlp=page` or `rlp=domain` in the standalone `/mapvibe` URL:
- `rlp=page` remembers pan/zoom per host + path
- `rlp=domain` remembers pan/zoom per host across paths
- `rlp=1` is the same as `rlp=page`
- `rlp=0` disables the feature and ignores any saved position

When enabled, the remembered position takes precedence over `center`, `zoom`, `bounds`, and auto-fit-to-data on reload.

When an imported background is selected, MapVibe may switch the map `glyphs` URL to the imported style's `glyphs` URL. For background entries with multiple imported styles declaring different `glyphs` URLs, MapVibe warns and uses the last imported member in the entry's order.

## Usage

- Host the `dist` output (see the doc on [Build](#build)) in folder `/mapvibe`.
  - You will have to create a config JSON file and host it on the same server (see the `samples` folder for examples for `config.json` files).
  - Your config JSON file can refer to icons other than the included ones: Host them on your server.
  - The config can refer to your own GeoJSON data layers: Also host them on your server.
- Embed in your page with `<iframe src="/mapvibe/?config=.../config.json" ...>`.

### Deployment in Hugo

The `dist` output can be added under `static/mapvibe` in the Hugo folder, for later deployment on your server.

Create a new `mapvibe` shortcode in `layouts/shortcodes/mapvibe.html`. For example:

```html
<iframe loading="lazy" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" 
    src="/mapvibe/?config={{ .Page.RelPermalink }}config.json" 
    width="100%" height="{{ .Get 1 }}"></iframe>
```

This assumes the post is a page bundle with the `config.json` hosted inside (so `RelPermalink` is actually a folder in Hugo).

The map can be embedded in a Hugo content using:

```html
{{< mapvibe "640" "480" >}}
```

### Example

Hugo blog:

https://blog.vellut.com/2025/07/hike-to-pointe-noire-de-pormenaz/ (scroll a little to see the map)

`MapVibe` was meant to replace something like:

https://blog.vellut.com/2025/06/hike-to-pointe-des-aravis-aiguille-de-borderan/ (Google My Maps)

## Development

```bash
npm install
npm run dev
```

Some simple `config.json` samples can be found in folder `samples`. To load one of them, use something like

`http://localhost:5173/mapvibe/?config=samples/sample1/config.json`

as the URL for testing. For imports and multi-layer backgrounds, file `samples/sample4/config.json` has a sample of use.

Or, since the project will be used inside an iframe (with limited width and height), use :

`http://localhost:5173/mapvibe/iframe.html?config=samples/sample2/config.json`

## Build

### Building the Website

```bash
npm run build
```

This will output static files to `dist` for hosting as a standalone website.

Before building:
- The hosting path can be customized in `vite.config.ts` (the CSS will load some assets using that path so it should correspond to where it will be hosted).
- The favicon can also be changed.
- New icons can be added in `public/assets/markers` (but they can be loaded from any place so not really needed except convenience).

### Building the Library

To build MapVibe as an npm library:

```bash
npm run build:lib
```

This will generate:
- `dist/mapvibe.mjs` - ES module build
- `dist/mapvibe.cjs` - CommonJS build
- `dist/mapvibe.css` - Compiled CSS styles
- `dist/lib.d.ts` - TypeScript declarations for autocomplete and type checking

## Publishing to NPM

To publish the library to npm:

1. Update the version in `package.json`
2. Ensure you're logged in to npm: `npm login`
3. Run: `npm publish`

The `prepublishOnly` script will automatically run `npm run build:lib` before publishing.

## Using MapVibe as a Library

### Installation

```bash
npm install mapvibe
```

### Peer Dependencies

MapVibe requires the following peer dependencies:
- `react` (^18.0.0 || ^19.0.0)
- `react-dom` (^18.0.0 || ^19.0.0)
- `maplibre-gl` (^4.0.0 || ^5.0.0)

Make sure to install them if not already present:

```bash
npm install react react-dom maplibre-gl
```

### Basic Usage

```tsx
import { MapVibeMap, type AppConfig } from 'mapvibe';
import 'mapvibe/style.css';

function App({ config }: { config: AppConfig }) {
  return <MapVibeMap config={config} rememberLastPosition="page" />;
}
```

`MapVibeMap` is the embeddable component for host applications. If you want the standalone app that reads a `config` URL parameter, use the built website output described earlier in this README.

`rememberLastPosition` accepts `false | 0 | true | 1 | "page" | "domain"`.
- `false` / `0`: disabled, never load saved pan/zoom even if one exists
- `true` / `1` / `"page"`: remember pan/zoom per host + path
- `"domain"`: remember pan/zoom per host across paths

When a remembered position exists, it overrides `config.center`, `config.zoom`, `config.bounds`, and the automatic fit-to-sources fallback.

### Accessing the MapLibre Instance

`MapVibeMap` exposes the underlying `maplibregl.Map` instance through a React ref so the embedding app can wire custom globals such as `window.goto`.

The handle also exposes:
- `getLayerIdsForBackgroundLayer(id)` to resolve a `customUi.backgroundLayers[].id` to the concrete runtime layer ids currently associated with it
- `getImportInfo(id)` to inspect a loaded import's original URL and namespaced layer/source/sprite ids

```tsx
import { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MapVibeMap, type AppConfig, type MapVibeMapHandle } from 'mapvibe';
import 'mapvibe/style.css';

const mapRef = createRef<MapVibeMapHandle>();
const root = createRoot(document.getElementById('map')!);

declare global {
  interface Window {
    goto?: (lat: number, lon: number) => void;
  }
}

window.goto = (lat: number, lon: number) => {
  mapRef.current?.getMap()?.flyTo({ center: [lon, lat] });
};

root.render(
  <MapVibeMap
    ref={mapRef}
    config={config}
  />
);
```

### Importing CSS and Assets

When impoorting the library published on NPM (TBD):

**CSS**: The library exports a compiled CSS file that must be imported in your application:

```tsx
import 'mapvibe/style.css';
```

Alternatively, you can import it in your main CSS file:
 
```css
@import 'mapvibe/style.css';
```

**Icons and Assets**: The library includes UI icons (layers, close, fullscreen) in the compiled CSS (by default Vite inline the referenced icons smaller than 4kB: These are embedded as data URIs). When using the library:

1. If you're using custom marker icons, host them on your server and reference them in your config.json
2. The default UI icons (layer chooser, close button, fullscreen) are bundled with the CSS

### TypeScript Support

MapVibe is written in TypeScript and includes full type definitions. When using the library in a TypeScript project, you'll get:

- Full autocomplete for the `MapVibeMap` component
- Type definitions for configuration interfaces:
  - `AppConfig`
  - `BackgroundLayerConfig`
  - `StyleImportConfig`
  - `DataLayerConfig`
  - `CustomUiConfig`
  - `InfoPanelData`
  - `MapVibeImportInfo`
  - `MapVibeMapHandle`

Example with types:

```tsx
import { MapVibeMap, AppConfig } from 'mapvibe';
import 'mapvibe/style.css';

// TypeScript will provide autocomplete for config structure
const config: AppConfig = {
  title: "My Map",
  center: [6.8665, 45.9237],
  zoom: 12,
  // ... rest of config with full type checking
};
```

For `openUrl` layers, each clicked feature is expected to expose a string `url` property in its GeoJSON `properties`. If `url` is missing, MapVibe logs a warning in the console and does not open a popup.


## Notes

### Upgrade dev deps

`npx npm-check-updates -u --dep dev`

## License

MIT
