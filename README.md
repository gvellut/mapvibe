# MapVibe: Embeddable Map Interface

A static, client-side map application for embedding interactive maps in blog posts or websites (similar to Google My Maps). Uses [MapLibre GL JS](https://maplibre.org/) and a single JSON config file for all map setup.

## Configuration

- The config file follows the [MapLibre Style Spec](https://maplibre.org/maplibre-gl-js-docs/style-spec/) with an extra `customUi` object.
- `customUi.backgroundLayers` defines which raster layers can be toggled as backgrounds (only one visible at a time; others must have `layout.visibility: none`).
- Other layers (lines, points, polygons) use standard MapLibre definitions.
- UI controls, panel color/width, and layer chooser are set in `customUi`.

## Usage

- Host the `/dist` output and your config file on your server.
- Embed with an `<iframe src=".../index.html?config=.../config.json" ...>` in your page.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs static files to `/dist` for deployment.

## License
MIT