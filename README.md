# MapVibe

A static map interface for embedding in blog posts or websites, as a Google My Maps replacement. Runs fully client-side, loads configuration from a single JSON file.

Made with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) and React in TypeScript.

## Configuration

- Uses the [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/) for sources, layers, and styling.
- The config file must include a `customUi` object:
  - `customUi.backgroundLayers`: List of raster layers that can be toggled as backgrounds.
  - `customUi.dataLayers`: List of data layers (lines, points, polygons) for toggling visibility.
  - `customUi.panel`: Panel color and width.
  - `customUi.controls`: Which UI controls to show (zoom, scale, layer chooser, fullscreen, attribution).
  - `customUi.globalMinZoom` / `globalMaxZoom`: Clamp zoom range for all backgrounds.
- Only one background layer should be visible at a time (including load time ie with `layout.visibility: visible`). Other layers follow standard MapLibre definitions.

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

`http://localhost:5173/?config=samples/sample1/config.json`

as the URL for testing.

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
import { MapVibeApp } from 'mapvibe';
import 'mapvibe/style.css';

function App() {
  return <MapVibeApp />;
}
```

The `MapVibeApp` component expects a URL parameter `config` pointing to a configuration JSON file, similar to the standalone website usage.

### Importing CSS and Assets

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

**MapLibre GL CSS**: Don't forget to also import MapLibre GL's CSS for proper map styling:

```tsx
import 'maplibre-gl/dist/maplibre-gl.css';
```

### TypeScript Support

MapVibe is written in TypeScript and includes full type definitions. When using the library in a TypeScript project, you'll get:

- Full autocomplete for the `MapVibeApp` component
- Type definitions for configuration interfaces:
  - `AppConfig`
  - `BackgroundLayerConfig`
  - `DataLayerConfig`
  - `CustomUiConfig`
  - `InfoPanelData`

Example with types:

```tsx
import { MapVibeApp, AppConfig } from 'mapvibe';
import 'mapvibe/style.css';

// TypeScript will provide autocomplete for config structure
const config: AppConfig = {
  title: "My Map",
  center: [6.8665, 45.9237],
  zoom: 12,
  // ... rest of config with full type checking
};
```



## License

MIT